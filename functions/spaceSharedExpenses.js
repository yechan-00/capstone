const { HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { requireRegisteredAuth } = require('./createSpace');
const { parseSpaceId } = require('./spaceMembers');
const { assertNoOpenSettlementLock } = require('./spaceSettlements');

const TITLE_MAX = 60;
const MEMO_MAX = 500;
const AMOUNT_MIN = 1;
const AMOUNT_MAX = 99_999_999;
const PARTICIPANT_MAX = 20;
const UID_MAX = 128;
const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const CATEGORIES = new Set(['takeout', 'cafe', 'delivery']);
const PUBLIC_KEYS = [
  'title',
  'amount',
  'dateKey',
  'category',
  'paidByUid',
  'participantUids',
  'memo',
  'createdByUid',
  'createdAt',
  'updatedAt',
];

function isUsableId(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= UID_MAX && !value.includes('/');
}

function isValidDateKey(value) {
  if (typeof value !== 'string' || !DATE_KEY_RE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

function parseTitle(raw) {
  if (typeof raw !== 'string') {
    throw new HttpsError('invalid-argument', '소비 제목을 입력해 주세요.');
  }
  const title = raw.trim();
  if (!title) {
    throw new HttpsError('invalid-argument', '소비 제목을 입력해 주세요.');
  }
  if (title.length > TITLE_MAX) {
    throw new HttpsError('invalid-argument', `제목은 ${TITLE_MAX}자 이하여야 해요.`);
  }
  return title;
}

function parseMemo(raw) {
  if (raw == null) return '';
  if (typeof raw !== 'string') {
    throw new HttpsError('invalid-argument', '메모를 다시 확인해 주세요.');
  }
  const memo = raw.trim();
  if (memo.length > MEMO_MAX) {
    throw new HttpsError('invalid-argument', `메모는 ${MEMO_MAX}자 이하여야 해요.`);
  }
  return memo;
}

function parseAmount(raw) {
  if (typeof raw === 'number') {
    if (!Number.isInteger(raw) || !Number.isSafeInteger(raw) || raw < AMOUNT_MIN || raw > AMOUNT_MAX) {
      throw new HttpsError('invalid-argument', '금액은 1원 이상 정수로 입력해 주세요.');
    }
    return raw;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!/^\d+$/.test(trimmed) || trimmed.length > 8) {
      throw new HttpsError('invalid-argument', '금액은 1원 이상 정수로 입력해 주세요.');
    }
    const amount = Number(trimmed);
    if (!Number.isSafeInteger(amount) || amount < AMOUNT_MIN || amount > AMOUNT_MAX) {
      throw new HttpsError('invalid-argument', '금액은 1원 이상 정수로 입력해 주세요.');
    }
    return amount;
  }
  throw new HttpsError('invalid-argument', '금액은 1원 이상 정수로 입력해 주세요.');
}

function parseCategory(raw) {
  const value = raw === 'food' ? 'takeout' : raw;
  if (!CATEGORIES.has(value)) {
    throw new HttpsError('invalid-argument', '카테고리를 선택해 주세요.');
  }
  return value;
}

function parseParticipantUids(raw) {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > PARTICIPANT_MAX) {
    throw new HttpsError('invalid-argument', '참여 멤버를 선택해 주세요.');
  }
  const uids = [];
  const seen = new Set();
  for (const item of raw) {
    if (!isUsableId(item) || seen.has(item)) {
      throw new HttpsError('invalid-argument', '참여 멤버를 다시 확인해 주세요.');
    }
    seen.add(item);
    uids.push(item);
  }
  return uids;
}

function parsePaidByUid(raw, participantUids) {
  if (!isUsableId(raw) || !participantUids.includes(raw)) {
    throw new HttpsError('invalid-argument', '결제자를 현재 참여 멤버 중에서 선택해 주세요.');
  }
  return raw;
}

function parseDateKey(raw) {
  if (!isValidDateKey(raw)) {
    throw new HttpsError('invalid-argument', '날짜를 다시 확인해 주세요.');
  }
  return raw;
}

function parseOptionalSourceExpenseId(raw) {
  if (raw == null || raw === '') return null;
  if (!isUsableId(raw)) {
    throw new HttpsError('invalid-argument', '공유할 소비를 확인할 수 없어요.');
  }
  return raw;
}

function parseDraft(data) {
  const participantUids = parseParticipantUids(data?.participantUids);
  return {
    title: parseTitle(data?.title),
    amount: parseAmount(data?.amount),
    dateKey: parseDateKey(data?.dateKey),
    category: parseCategory(data?.category),
    paidByUid: parsePaidByUid(data?.paidByUid, participantUids),
    participantUids,
    memo: parseMemo(data?.memo),
  };
}

function publicPayload(draft, createdByUid, timestamps) {
  return {
    title: draft.title,
    amount: draft.amount,
    dateKey: draft.dateKey,
    category: draft.category,
    paidByUid: draft.paidByUid,
    participantUids: draft.participantUids,
    memo: draft.memo,
    createdByUid,
    createdAt: timestamps.createdAt,
    updatedAt: timestamps.updatedAt,
  };
}

function assertCurrentMembers(paidByUid, participantUids, memberUids) {
  if (!memberUids.has(paidByUid)) {
    throw new HttpsError('invalid-argument', '결제자는 현재 공간 멤버여야 해요.');
  }
  for (const uid of participantUids) {
    if (!memberUids.has(uid)) {
      throw new HttpsError('invalid-argument', '참여 멤버는 현재 공간 멤버여야 해요.');
    }
  }
}

function existingUidList(raw) {
  if (!Array.isArray(raw)) return [];
  const uids = [];
  const seen = new Set();
  for (const item of raw) {
    if (!isUsableId(item) || seen.has(item)) continue;
    seen.add(item);
    uids.push(item);
  }
  return uids;
}

function assertMembershipForUpdate(existing, draft, memberUids) {
  const existingParticipants = new Set(existingUidList(existing.participantUids));
  const existingPaidBy = typeof existing.paidByUid === 'string' ? existing.paidByUid : '';
  for (const uid of draft.participantUids) {
    if (!existingParticipants.has(uid) && !memberUids.has(uid)) {
      throw new HttpsError('invalid-argument', '참여 멤버는 현재 공간 멤버여야 해요.');
    }
  }
  if (draft.paidByUid !== existingPaidBy && !memberUids.has(draft.paidByUid)) {
    throw new HttpsError('invalid-argument', '결제자는 현재 공간 멤버여야 해요.');
  }
}

async function loadActiveSpaceMembers(db, spaceId, uid) {
  const spaceRef = db.collection('spaces').doc(spaceId);
  const spaceSnap = await spaceRef.get();
  if (!spaceSnap.exists) {
    throw new HttpsError('not-found', '공간을 찾을 수 없어요.');
  }
  const space = spaceSnap.data() || {};
  if (space.status !== 'active') {
    throw new HttpsError('failed-precondition', '현재 이용할 수 없는 공간이에요.');
  }
  const membersSnap = await spaceRef.collection('space_members').get();
  const memberUids = new Set(membersSnap.docs.map((docSnap) => docSnap.id));
  if (!memberUids.has(uid)) {
    throw new HttpsError('permission-denied', '이 공간의 멤버만 공동 소비를 기록할 수 있어요.');
  }
  return { spaceRef, memberUids };
}

async function assertOwnsExpense(db, uid, expenseId) {
  const snap = await db.collection('expenses').doc(expenseId).get();
  if (!snap.exists) {
    throw new HttpsError('not-found', '소비 기록을 찾을 수 없어요.');
  }
  const data = snap.data() || {};
  if (data.userId !== uid && data.accountId !== `account_${uid}`) {
    throw new HttpsError('permission-denied', '내 소비만 공유할 수 있어요.');
  }
}

async function createSpaceSharedExpenseHandler({ auth, data, db }) {
  const uid = requireRegisteredAuth(auth);
  const spaceId = parseSpaceId(data?.spaceId);
  const draft = parseDraft(data);
  const sourceExpenseId = parseOptionalSourceExpenseId(data?.sourceExpenseId);
  const { spaceRef, memberUids } = await loadActiveSpaceMembers(db, spaceId, uid);
  assertCurrentMembers(draft.paidByUid, draft.participantUids, memberUids);
  if (sourceExpenseId) {
    await assertOwnsExpense(db, uid, sourceExpenseId);
  }

  const expenseRef = spaceRef.collection('shared_expenses').doc();
  const now = admin.firestore.FieldValue.serverTimestamp();
  const payload = publicPayload(draft, uid, { createdAt: now, updatedAt: now });
  const batch = db.batch();
  batch.set(expenseRef, payload);
  if (sourceExpenseId) {
    const linkRef = db
      .collection('accounts')
      .doc(`account_${uid}`)
      .collection('space_expense_links')
      .doc(`${spaceId}_${expenseRef.id}`);
    batch.set(linkRef, {
      spaceId,
      sharedExpenseId: expenseRef.id,
      expenseId: sourceExpenseId,
      createdAt: now,
    });
  }
  try {
    await batch.commit();
  } catch (error) {
    console.error('[createSpaceSharedExpense]', error);
    throw new HttpsError('internal', '공동 소비를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
  }
  return { spaceId, sharedExpenseId: expenseRef.id };
}

async function updateSpaceSharedExpenseHandler({ auth, data, db }) {
  const uid = requireRegisteredAuth(auth);
  const spaceId = parseSpaceId(data?.spaceId);
  if (!isUsableId(data?.sharedExpenseId)) {
    throw new HttpsError('invalid-argument', '공동 소비를 확인할 수 없어요.');
  }
  const sharedExpenseId = data.sharedExpenseId.trim();
  const draft = parseDraft(data);
  const { spaceRef, memberUids } = await loadActiveSpaceMembers(db, spaceId, uid);

  const expenseRef = spaceRef.collection('shared_expenses').doc(sharedExpenseId);
  const snap = await expenseRef.get();
  if (!snap.exists) {
    throw new HttpsError('not-found', '공동 소비를 찾을 수 없어요.');
  }
  const existing = snap.data() || {};
  if (existing.createdByUid !== uid) {
    throw new HttpsError('permission-denied', '작성한 멤버만 수정할 수 있어요.');
  }
  assertMembershipForUpdate(existing, draft, memberUids);
  await assertNoOpenSettlementLock(spaceRef, sharedExpenseId, existing, draft);

  const payload = {
    title: draft.title,
    amount: draft.amount,
    dateKey: draft.dateKey,
    category: draft.category,
    paidByUid: draft.paidByUid,
    participantUids: draft.participantUids,
    memo: draft.memo,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  try {
    await expenseRef.update(payload);
  } catch (error) {
    console.error('[updateSpaceSharedExpense]', error);
    throw new HttpsError('internal', '공동 소비를 저장하지 못했어요. 잠시 후 다시 시도해 주세요.');
  }
  return { spaceId, sharedExpenseId };
}

module.exports = {
  TITLE_MAX,
  MEMO_MAX,
  AMOUNT_MIN,
  AMOUNT_MAX,
  PARTICIPANT_MAX,
  PUBLIC_KEYS,
  parseTitle,
  parseMemo,
  parseAmount,
  parseCategory,
  parseParticipantUids,
  parsePaidByUid,
  parseDateKey,
  parseDraft,
  publicPayload,
  assertCurrentMembers,
  assertMembershipForUpdate,
  createSpaceSharedExpenseHandler,
  updateSpaceSharedExpenseHandler,
};
