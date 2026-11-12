const crypto = require('crypto');
const { HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { requireRegisteredAuth, SPACE_MAX_MEMBERS } = require('./createSpace');

const INVITE_TTL_MS = 2 * 60 * 60 * 1000;
const INVITE_CODE_LENGTH = 8;
const INVITE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const SPACE_INVITES = 'space_invites';
const INVITE_PRIVATE = 'invite_private';
const INVITE_CURRENT = 'current';
const INVITE_ATTEMPTS = 'invite_attempts';
const INVITE_FAIL_LIMIT = 20;
const INVITE_FAIL_WINDOW_MS = 60 * 60 * 1000;
const INVITE_UNAVAILABLE = '초대 코드를 확인할 수 없어요.';

function getPepper(opts) {
  // 운영: 바인딩된 process.env.INVITE_PEPPER만 사용. 없거나 빈 값이면 internal.
  // 에뮬레이터 폴백은 FUNCTIONS_EMULATOR === 'true' 일 때만. 값은 로그하지 않는다.
  if (opts && typeof opts.pepper === 'string' && opts.pepper.length > 0) {
    return opts.pepper;
  }
  if (typeof process.env.INVITE_PEPPER === 'string' && process.env.INVITE_PEPPER.length > 0) {
    return process.env.INVITE_PEPPER;
  }
  if (process.env.FUNCTIONS_EMULATOR === 'true') {
    return 'emulator-invite-pepper';
  }
  throw new HttpsError('internal', '초대 코드를 처리하지 못했어요. 잠시 후 다시 시도해 주세요.');
}

function nowMs(opts) {
  if (opts && typeof opts.nowMs === 'number' && Number.isFinite(opts.nowMs)) {
    return opts.nowMs;
  }
  return Date.now();
}

function parseSpaceId(raw) {
  if (typeof raw !== 'string' || raw.trim().length === 0 || raw.includes('/')) {
    throw new HttpsError('invalid-argument', '공간을 확인할 수 없어요.');
  }
  return raw.trim();
}

function normalizeInviteCode(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().toUpperCase().replace(/[\s-]/g, '');
}

function hashInviteCode(code, pepper) {
  return crypto.createHmac('sha256', pepper).update(normalizeInviteCode(code), 'utf8').digest('hex');
}

function generateInviteCode() {
  let out = '';
  for (let i = 0; i < INVITE_CODE_LENGTH; i += 1) {
    out += INVITE_ALPHABET[crypto.randomInt(INVITE_ALPHABET.length)];
  }
  return out;
}

function buildLookupRecord({ spaceId, codeHash, createdByUid, createdAt, expiresAt }) {
  return {
    spaceId,
    codeHash,
    createdByUid,
    createdAt,
    expiresAt,
    revokedAt: null,
    status: 'active',
  };
}

function buildPrivateRecord({ inviteId, code, createdByUid, createdAt, expiresAt }) {
  return {
    inviteId,
    code,
    createdByUid,
    createdAt,
    expiresAt,
    revokedAt: null,
    status: 'active',
  };
}

function timestampMillis(value) {
  if (!value) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  return null;
}

function isLookupInviteValid(lookupData, now) {
  if (!lookupData || lookupData.status !== 'active') return false;
  if (lookupData.revokedAt) return false;
  const expires = timestampMillis(lookupData.expiresAt);
  return expires != null && expires > now;
}

function isInviteCurrentlyValid(lookupData, privateData, now) {
  if (!isLookupInviteValid(lookupData, now)) return false;
  if (!privateData || privateData.status !== 'active') return false;
  if (typeof privateData.code !== 'string' || privateData.code.length === 0) return false;
  if (privateData.inviteId !== lookupData.codeHash) return false;
  return true;
}

function parseInviteCode(raw) {
  const code = normalizeInviteCode(raw);
  if (code.length !== INVITE_CODE_LENGTH) {
    throw new HttpsError('invalid-argument', INVITE_UNAVAILABLE);
  }
  for (let i = 0; i < code.length; i += 1) {
    if (!INVITE_ALPHABET.includes(code[i])) {
      throw new HttpsError('invalid-argument', INVITE_UNAVAILABLE);
    }
  }
  return code;
}

function attemptsRef(db, uid) {
  return db.collection(INVITE_ATTEMPTS).doc(uid);
}

function isInviteRateLimited(data, now) {
  if (!data) return false;
  if (typeof data.windowStartMs !== 'number' || typeof data.failCount !== 'number') return false;
  if (now - data.windowStartMs >= INVITE_FAIL_WINDOW_MS) return false;
  return data.failCount >= INVITE_FAIL_LIMIT;
}

/**
 * 초대 실패 횟수 제한 (preview·join 공통)
 *
 * 저장 위치: invite_attempts/{uid}
 *   { windowStartMs, failCount } 만 기록. 코드 원문·해시는 저장하지 않는다.
 *
 * 시간창: 서버 시각 기준 1시간. 창이 끝나면 failCount를 1로 다시 시작한다.
 * 한도: 같은 UID가 창 안에서 실패 20회. 초과 시 HMAC 조회 전에 resource-exhausted.
 *
 * 증가 시점: 인증 직후, 코드 조회 전에 예약을 1 올린다. 같은 UID 문서를
 * 트랜잭션으로 다루므로 동시 요청도 20회를 넘기기 전에 차단된다.
 *
 * 유지(추측 실패): 형식 오류, 없음·만료·취소·공간 없음
 *   (invalid-argument / not-found)
 * 해제(성공·비추측): 미리보기·참여 성공, 이미 멤버, 정원 초과, 비활성 공간, 내부 오류
 *
 * UID 단위 제한이며 다중 계정 공격까지 막지는 않는다.
 */
async function beginInviteAttempt(db, uid, now) {
  await db.runTransaction(async (transaction) => {
    const ref = attemptsRef(db, uid);
    const snap = await transaction.get(ref);
    const data = snap.exists ? snap.data() : null;
    if (isInviteRateLimited(data, now)) {
      throw new HttpsError('resource-exhausted', '잠시 후 다시 시도해 주세요.');
    }
    if (!data || now - data.windowStartMs >= INVITE_FAIL_WINDOW_MS) {
      transaction.set(ref, {
        windowStartMs: now,
        failCount: 1,
      });
      return;
    }
    transaction.update(ref, { failCount: data.failCount + 1 });
  });
}

async function releaseInviteAttempt(db, uid, now) {
  await db.runTransaction(async (transaction) => {
    const ref = attemptsRef(db, uid);
    const snap = await transaction.get(ref);
    if (!snap.exists) return;
    const data = snap.data();
    if (typeof data.windowStartMs !== 'number' || now - data.windowStartMs >= INVITE_FAIL_WINDOW_MS) {
      return;
    }
    const next = Math.max(0, (typeof data.failCount === 'number' ? data.failCount : 1) - 1);
    transaction.update(ref, { failCount: next });
  });
}

function shouldReleaseInviteAttempt(error) {
  if (!(error instanceof HttpsError)) return true;
  return error.code !== 'not-found' && error.code !== 'invalid-argument';
}

async function withInviteAttempt({ db, uid, now }, work) {
  await beginInviteAttempt(db, uid, now);
  try {
    const result = await work();
    await releaseInviteAttempt(db, uid, now);
    return result;
  } catch (error) {
    if (shouldReleaseInviteAttempt(error)) {
      try {
        await releaseInviteAttempt(db, uid, now);
      } catch (_releaseError) {
        // 예약 해제 실패는 본래 오류를 가리지 않는다.
      }
    }
    throw error;
  }
}

function spaceMaxMembers(space) {
  return typeof space?.maxMembers === 'number' && space.maxMembers > 0
    ? space.maxMembers
    : SPACE_MAX_MEMBERS;
}

function publicSpacePreview(space, reason) {
  return {
    name: typeof space.name === 'string' ? space.name : '',
    type: typeof space.type === 'string' ? space.type : '',
    canJoin: reason === 'ok',
    reason,
  };
}

function toInviteResponse(privateData) {
  const expires = timestampMillis(privateData.expiresAt);
  return {
    code: privateData.code,
    expiresAt: new Date(expires).toISOString(),
  };
}

function privateRef(db, spaceId) {
  return db.collection('spaces').doc(spaceId).collection(INVITE_PRIVATE).doc(INVITE_CURRENT);
}

function inviteRef(db, inviteId) {
  return db.collection(SPACE_INVITES).doc(inviteId);
}

async function requireOwnedActiveSpace(transaction, db, spaceId, uid) {
  const spaceRef = db.collection('spaces').doc(spaceId);
  const spaceSnap = await transaction.get(spaceRef);
  if (!spaceSnap.exists) {
    throw new HttpsError('not-found', '공간을 찾을 수 없어요.');
  }
  const space = spaceSnap.data();
  if (space.ownerUid !== uid) {
    throw new HttpsError('permission-denied', '공간 소유자만 초대 코드를 다룰 수 있어요.');
  }
  if (space.status !== 'active') {
    throw new HttpsError('failed-precondition', '현재 이용할 수 없는 공간이에요.');
  }
  return { spaceRef, space };
}

async function readCurrentInvite(transaction, db, spaceId) {
  const currentRef = privateRef(db, spaceId);
  const currentSnap = await transaction.get(currentRef);
  if (!currentSnap.exists) {
    return { currentRef, currentSnap, lookupRef: null, lookupSnap: null };
  }
  const inviteId = currentSnap.data()?.inviteId;
  if (typeof inviteId !== 'string' || inviteId.length === 0) {
    return { currentRef, currentSnap, lookupRef: null, lookupSnap: null };
  }
  const lookupRef = inviteRef(db, inviteId);
  const lookupSnap = await transaction.get(lookupRef);
  return { currentRef, currentSnap, lookupRef, lookupSnap };
}

function revokeLookup(transaction, lookupRef, lookupSnap, now) {
  if (!lookupRef || !lookupSnap || !lookupSnap.exists) return;
  const data = lookupSnap.data();
  if (data.status === 'revoked') return;
  transaction.update(lookupRef, {
    status: 'revoked',
    revokedAt: admin.firestore.Timestamp.fromMillis(now),
  });
}

async function mintUniqueCode(db, pepper) {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = generateInviteCode();
    const inviteId = hashInviteCode(code, pepper);
    const snap = await db.collection(SPACE_INVITES).doc(inviteId).get();
    if (!snap.exists) return { code, inviteId };
  }
  throw new HttpsError('internal', '초대 코드를 만들지 못했어요. 잠시 후 다시 시도해 주세요.');
}

function writeNewInvite(transaction, db, { spaceId, uid, code, inviteId, now }) {
  const createdAt = admin.firestore.Timestamp.fromMillis(now);
  const expiresAt = admin.firestore.Timestamp.fromMillis(now + INVITE_TTL_MS);
  const lookup = buildLookupRecord({
    spaceId,
    codeHash: inviteId,
    createdByUid: uid,
    createdAt,
    expiresAt,
  });
  if (Object.prototype.hasOwnProperty.call(lookup, 'code')) {
    throw new HttpsError('internal', '초대 코드를 만들지 못했어요. 잠시 후 다시 시도해 주세요.');
  }
  transaction.set(inviteRef(db, inviteId), lookup);
  transaction.set(
    privateRef(db, spaceId),
    buildPrivateRecord({
      inviteId,
      code,
      createdByUid: uid,
      createdAt,
      expiresAt,
    }),
  );
  return { code, expiresAt: expiresAt.toDate().toISOString() };
}

async function createSpaceInviteHandler({ auth, data, db, ...opts }) {
  const uid = requireRegisteredAuth(auth);
  const spaceId = parseSpaceId(data?.spaceId);
  const pepper = getPepper(opts);
  const now = nowMs(opts);
  const minted = await mintUniqueCode(db, pepper);

  try {
    return await db.runTransaction(async (transaction) => {
      await requireOwnedActiveSpace(transaction, db, spaceId, uid);
      const current = await readCurrentInvite(transaction, db, spaceId);
      const mintedRef = inviteRef(db, minted.inviteId);
      const mintedSnap = await transaction.get(mintedRef);
      const lookupData = current.lookupSnap?.exists ? current.lookupSnap.data() : null;
      const privateData = current.currentSnap?.exists ? current.currentSnap.data() : null;

      if (isInviteCurrentlyValid(lookupData, privateData, now)) {
        return toInviteResponse(privateData);
      }

      if (mintedSnap.exists) {
        throw new HttpsError('aborted', '초대 코드를 만들지 못했어요. 잠시 후 다시 시도해 주세요.');
      }

      revokeLookup(transaction, current.lookupRef, current.lookupSnap, now);
      return writeNewInvite(transaction, db, {
        spaceId,
        uid,
        code: minted.code,
        inviteId: minted.inviteId,
        now,
      });
    });
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('[createSpaceInvite]', { spaceId, uid });
    throw new HttpsError('internal', '초대 코드를 만들지 못했어요. 잠시 후 다시 시도해 주세요.');
  }
}

async function getSpaceInviteHandler({ auth, data, db, ...opts }) {
  const uid = requireRegisteredAuth(auth);
  const spaceId = parseSpaceId(data?.spaceId);
  const now = nowMs(opts);

  try {
    return await db.runTransaction(async (transaction) => {
      await requireOwnedActiveSpace(transaction, db, spaceId, uid);
      const current = await readCurrentInvite(transaction, db, spaceId);
      const lookupData = current.lookupSnap?.exists ? current.lookupSnap.data() : null;
      const privateData = current.currentSnap?.exists ? current.currentSnap.data() : null;
      if (!isInviteCurrentlyValid(lookupData, privateData, now)) {
        throw new HttpsError('not-found', '유효한 초대 코드가 없어요.');
      }
      return toInviteResponse(privateData);
    });
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('[getSpaceInvite]', { spaceId, uid });
    throw new HttpsError('internal', '초대 코드를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.');
  }
}

async function rotateSpaceInviteHandler({ auth, data, db, ...opts }) {
  const uid = requireRegisteredAuth(auth);
  const spaceId = parseSpaceId(data?.spaceId);
  const pepper = getPepper(opts);
  const now = nowMs(opts);
  const minted = await mintUniqueCode(db, pepper);

  try {
    return await db.runTransaction(async (transaction) => {
      await requireOwnedActiveSpace(transaction, db, spaceId, uid);
      const current = await readCurrentInvite(transaction, db, spaceId);
      const mintedRef = inviteRef(db, minted.inviteId);
      const mintedSnap = await transaction.get(mintedRef);
      if (mintedSnap.exists) {
        throw new HttpsError('aborted', '초대 코드를 만들지 못했어요. 잠시 후 다시 시도해 주세요.');
      }

      revokeLookup(transaction, current.lookupRef, current.lookupSnap, now);
      return writeNewInvite(transaction, db, {
        spaceId,
        uid,
        code: minted.code,
        inviteId: minted.inviteId,
        now,
      });
    });
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('[rotateSpaceInvite]', { spaceId, uid });
    throw new HttpsError('internal', '초대 코드를 재발급하지 못했어요. 잠시 후 다시 시도해 주세요.');
  }
}

async function revokeSpaceInviteHandler({ auth, data, db, ...opts }) {
  const uid = requireRegisteredAuth(auth);
  const spaceId = parseSpaceId(data?.spaceId);
  const now = nowMs(opts);

  try {
    await db.runTransaction(async (transaction) => {
      await requireOwnedActiveSpace(transaction, db, spaceId, uid);
      const current = await readCurrentInvite(transaction, db, spaceId);
      revokeLookup(transaction, current.lookupRef, current.lookupSnap, now);
      if (current.currentSnap.exists) {
        transaction.set(current.currentRef, {
          inviteId: current.currentSnap.data()?.inviteId ?? null,
          createdByUid: uid,
          createdAt: current.currentSnap.data()?.createdAt ?? admin.firestore.Timestamp.fromMillis(now),
          expiresAt: current.currentSnap.data()?.expiresAt ?? admin.firestore.Timestamp.fromMillis(now),
          status: 'revoked',
          revokedAt: admin.firestore.Timestamp.fromMillis(now),
        });
      }
    });
    return { revoked: true };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('[revokeSpaceInvite]', { spaceId, uid });
    throw new HttpsError('internal', '초대 코드를 취소하지 못했어요. 잠시 후 다시 시도해 주세요.');
  }
}

async function loadInviteLookup(db, code, pepper) {
  const inviteId = hashInviteCode(code, pepper);
  const snap = await inviteRef(db, inviteId).get();
  return { inviteId, snap, data: snap.exists ? snap.data() : null };
}

async function previewSpaceInviteHandler({ auth, data, db, ...opts }) {
  const uid = requireRegisteredAuth(auth);
  const pepper = getPepper(opts);
  const now = nowMs(opts);

  try {
    return await withInviteAttempt({ db, uid, now }, async () => {
      const code = parseInviteCode(data?.code);
      const lookup = await loadInviteLookup(db, code, pepper);
      if (!isLookupInviteValid(lookup.data, now) || typeof lookup.data.spaceId !== 'string') {
        throw new HttpsError('not-found', INVITE_UNAVAILABLE);
      }

      const spaceId = lookup.data.spaceId;
      const spaceRef = db.collection('spaces').doc(spaceId);
      const spaceSnap = await spaceRef.get();
      if (!spaceSnap.exists) {
        throw new HttpsError('not-found', INVITE_UNAVAILABLE);
      }

      const space = spaceSnap.data();
      if (space.status !== 'active') {
        throw new HttpsError('failed-precondition', '현재 이용할 수 없는 공간이에요.');
      }

      const memberSnap = await spaceRef.collection('space_members').doc(uid).get();
      if (memberSnap.exists) {
        return publicSpacePreview(space, 'already-member');
      }

      const membersSnap = await spaceRef.collection('space_members').get();
      if (membersSnap.size >= spaceMaxMembers(space)) {
        return publicSpacePreview(space, 'full');
      }
      return publicSpacePreview(space, 'ok');
    });
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('[previewSpaceInvite]', { uid });
    throw new HttpsError('internal', '초대 코드를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.');
  }
}

async function joinSpaceByInviteHandler({ auth, data, db, ...opts }) {
  const uid = requireRegisteredAuth(auth);
  const pepper = getPepper(opts);
  const now = nowMs(opts);

  try {
    return await withInviteAttempt({ db, uid, now }, async () => {
      const code = parseInviteCode(data?.code);
      const inviteId = hashInviteCode(code, pepper);

      return db.runTransaction(async (transaction) => {
        const lookupRef = inviteRef(db, inviteId);
        const lookupSnap = await transaction.get(lookupRef);
        const lookup = lookupSnap.exists ? lookupSnap.data() : null;
        const spaceId = typeof lookup?.spaceId === 'string' ? lookup.spaceId : null;
        const spaceRef = spaceId ? db.collection('spaces').doc(spaceId) : null;
        const spaceSnap = spaceRef ? await transaction.get(spaceRef) : null;
        const memberRef = spaceRef ? spaceRef.collection('space_members').doc(uid) : null;
        const memberSnap = memberRef ? await transaction.get(memberRef) : null;
        const space = spaceSnap?.exists ? spaceSnap.data() : null;

        if (!isLookupInviteValid(lookup, now)) {
          throw new HttpsError('not-found', INVITE_UNAVAILABLE);
        }
        if (!spaceSnap || !spaceSnap.exists) {
          throw new HttpsError('not-found', INVITE_UNAVAILABLE);
        }
        if (space.status !== 'active') {
          throw new HttpsError('failed-precondition', '현재 이용할 수 없는 공간이에요.');
        }
        if (memberSnap.exists) {
          return { spaceId };
        }

        const countedMembers = await transaction.get(spaceRef.collection('space_members'));
        if (countedMembers.size >= spaceMaxMembers(space)) {
          throw new HttpsError('failed-precondition', '이 공간은 참여 인원이 가득 찼어요.');
        }

        transaction.set(memberRef, {
          uid,
          role: 'member',
          joinedAt: admin.firestore.FieldValue.serverTimestamp(),
          invitedByUid: typeof lookup.createdByUid === 'string' ? lookup.createdByUid : null,
        });
        transaction.update(spaceRef, {
          memberCount: countedMembers.size + 1,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { spaceId };
      });
    });
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('[joinSpaceByInvite]', { uid });
    throw new HttpsError('internal', '공간에 참여하지 못했어요. 잠시 후 다시 시도해 주세요.');
  }
}

module.exports = {
  INVITE_TTL_MS,
  INVITE_CODE_LENGTH,
  INVITE_ALPHABET,
  INVITE_FAIL_LIMIT,
  INVITE_FAIL_WINDOW_MS,
  normalizeInviteCode,
  hashInviteCode,
  generateInviteCode,
  parseInviteCode,
  buildLookupRecord,
  buildPrivateRecord,
  isLookupInviteValid,
  isInviteCurrentlyValid,
  getPepper,
  createSpaceInviteHandler,
  getSpaceInviteHandler,
  rotateSpaceInviteHandler,
  revokeSpaceInviteHandler,
  previewSpaceInviteHandler,
  joinSpaceByInviteHandler,
};
