const { HttpsError } = require('firebase-functions/v2/https');
const { requireRegisteredAuth } = require('./createSpace');
const { parseProfileImageKey, profileImageUrlForKey } = require('./profileImageAccess');

const ACCOUNT_PREFIX = 'account_';
const NICKNAME_MAX = 24;
const DEFAULT_DISPLAY_NAME = '이름 없음';
const MEMBER_UNAVAILABLE = '멤버 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.';

function parseSpaceId(raw) {
  if (typeof raw !== 'string' || raw.trim().length === 0 || raw.includes('/')) {
    throw new HttpsError('invalid-argument', '공간을 확인할 수 없어요.');
  }
  return raw.trim();
}

function timestampMillis(value) {
  if (!value) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function joinedAtIso(value) {
  const ms = timestampMillis(value);
  if (ms == null) return null;
  return new Date(ms).toISOString();
}

function memberUidFromDoc(docSnap) {
  const data = typeof docSnap.data === 'function' ? docSnap.data() : null;
  if (data && typeof data.uid === 'string' && data.uid.trim().length > 0) {
    return data.uid.trim();
  }
  if (typeof docSnap.id === 'string' && docSnap.id.trim().length > 0) {
    return docSnap.id.trim();
  }
  return null;
}

function memberRole(data, ownerUid, memberUid) {
  if (data && data.role === 'owner') return 'owner';
  if (typeof ownerUid === 'string' && ownerUid === memberUid) return 'owner';
  return 'member';
}

function displayNameFromAccount(data) {
  if (!data || typeof data.nickname !== 'string') return null;
  const nickname = data.nickname.trim().slice(0, NICKNAME_MAX);
  return nickname.length > 0 ? nickname : null;
}

function compareSpaceMembers(a, b) {
  const aOwner = a.role === 'owner' ? 0 : 1;
  const bOwner = b.role === 'owner' ? 0 : 1;
  if (aOwner !== bOwner) return aOwner - bOwner;
  const aTime = typeof a.joinedAtMs === 'number' ? a.joinedAtMs : Number.MAX_SAFE_INTEGER;
  const bTime = typeof b.joinedAtMs === 'number' ? b.joinedAtMs : Number.MAX_SAFE_INTEGER;
  if (aTime !== bTime) return aTime - bTime;
  if (a.uid < b.uid) return -1;
  if (a.uid > b.uid) return 1;
  return 0;
}

function sortSpaceMembers(rows) {
  return [...rows].sort(compareSpaceMembers);
}

function publicPhotoUrl(raw) {
  if (typeof raw !== 'string') return null;
  const url = raw.trim();
  if (!/^https:\/\//i.test(url)) return null;
  if (/firebasestorage\.googleapis\.com/i.test(url)) return null;
  if (/storage\.googleapis\.com/i.test(url)) return null;
  if (/^gs:/i.test(url)) return null;
  return url;
}

async function readDocs(db, refs) {
  if (!refs || refs.length === 0) return [];
  if (typeof db.getAll === 'function') {
    return db.getAll(...refs);
  }
  return Promise.all(refs.map((ref) => ref.get()));
}

async function loadAccountProfiles(db, uids) {
  const profiles = new Map();
  if (uids.length === 0) return profiles;
  const refs = uids.map((uid) => db.collection('accounts').doc(`${ACCOUNT_PREFIX}${uid}`));
  const snaps = await readDocs(db, refs);
  snaps.forEach((snap, index) => {
    if (!snap || !snap.exists) return;
    const data = typeof snap.data === 'function' ? snap.data() : null;
    const uid = uids[index];
    profiles.set(uid, {
      displayName: displayNameFromAccount(data),
      profileImageKey: parseProfileImageKey(data?.profileImageKey, uid)?.key ?? null,
    });
  });
  return profiles;
}

function toPublicMember(row) {
  const member = {
    uid: row.uid,
    displayName: row.displayName,
    role: row.role,
    joinedAt: row.joinedAt,
  };
  if (row.profileImageUrl) member.profileImageUrl = row.profileImageUrl;
  return member;
}

async function listSpaceMembersHandler({ auth, data, db, ...opts }) {
  const uid = requireRegisteredAuth(auth);
  const spaceId = parseSpaceId(data?.spaceId);

  try {
    const spaceRef = db.collection('spaces').doc(spaceId);
    const spaceSnap = await spaceRef.get();
    if (!spaceSnap.exists) {
      throw new HttpsError('not-found', '공간을 찾을 수 없어요.');
    }
    const space = spaceSnap.data() || {};
    if (space.status !== 'active') {
      throw new HttpsError('failed-precondition', '현재 이용할 수 없는 공간이에요.');
    }

    const requesterSnap = await spaceRef.collection('space_members').doc(uid).get();
    if (!requesterSnap.exists) {
      throw new HttpsError('permission-denied', '이 공간의 멤버만 목록을 볼 수 있어요.');
    }

    const membersSnap = await spaceRef.collection('space_members').get();
    const docs = Array.isArray(membersSnap?.docs) ? membersSnap.docs : [];
    const parsed = [];
    for (const docSnap of docs) {
      const memberUid = memberUidFromDoc(docSnap);
      if (!memberUid) continue;
      const memberData = typeof docSnap.data === 'function' ? docSnap.data() : {};
      const joinedAtMs = timestampMillis(memberData?.joinedAt);
      parsed.push({
        uid: memberUid,
        role: memberRole(memberData, space.ownerUid, memberUid),
        joinedAt: joinedAtMs == null ? null : new Date(joinedAtMs).toISOString(),
        joinedAtMs,
      });
    }

    const profiles = await loadAccountProfiles(db, parsed.map((row) => row.uid));
    const now = typeof opts.nowMs === 'number' ? opts.nowMs : Date.now();
    const members = sortSpaceMembers(
      parsed.map((row) => {
        const profile = profiles.get(row.uid);
        return {
          ...row,
          displayName: profile?.displayName || DEFAULT_DISPLAY_NAME,
          profileImageUrl: profile?.profileImageKey
            ? profileImageUrlForKey(profile.profileImageKey, row.uid, opts, now)
            : null,
        };
      }),
    ).map(toPublicMember);

    return { members };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('[listSpaceMembers]', { uid });
    throw new HttpsError('internal', MEMBER_UNAVAILABLE);
  }
}

module.exports = {
  ACCOUNT_PREFIX,
  NICKNAME_MAX,
  DEFAULT_DISPLAY_NAME,
  parseSpaceId,
  timestampMillis,
  joinedAtIso,
  memberRole,
  displayNameFromAccount,
  compareSpaceMembers,
  sortSpaceMembers,
  publicPhotoUrl,
  toPublicMember,
  loadAccountProfiles,
  listSpaceMembersHandler,
};
