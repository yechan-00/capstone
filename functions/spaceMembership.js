const { HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { requireRegisteredAuth } = require('./createSpace');
const { parseSpaceId } = require('./spaceMembers');

const LEAVE_UNAVAILABLE = '공간을 나가지 못했어요. 잠시 후 다시 시도해 주세요.';
const REMOVE_UNAVAILABLE = '멤버를 내보내지 못했어요. 잠시 후 다시 시도해 주세요.';

function parseTargetUid(raw) {
  if (typeof raw !== 'string' || raw.trim().length === 0 || raw.includes('/')) {
    throw new HttpsError('invalid-argument', '멤버를 확인할 수 없어요.');
  }
  return raw.trim();
}

function nextMemberCount(countedSize) {
  const safe = typeof countedSize === 'number' && Number.isFinite(countedSize) ? countedSize : 0;
  return Math.max(0, safe - 1);
}

async function loadSpaceAndTarget(transaction, db, spaceId, targetUid) {
  const spaceRef = db.collection('spaces').doc(spaceId);
  const spaceSnap = await transaction.get(spaceRef);
  if (!spaceSnap.exists) {
    throw new HttpsError('not-found', '공간을 찾을 수 없어요.');
  }
  const space = spaceSnap.data() || {};
  if (space.status !== 'active') {
    throw new HttpsError('failed-precondition', '현재 이용할 수 없는 공간이에요.');
  }

  const targetRef = spaceRef.collection('space_members').doc(targetUid);
  const targetSnap = await transaction.get(targetRef);
  const countedMembers = await transaction.get(spaceRef.collection('space_members'));

  return {
    spaceRef,
    space,
    targetRef,
    targetSnap,
    countedSize: countedMembers.size,
  };
}

function commitRemoval(transaction, spaceRef, targetRef, countedSize) {
  const memberCount = nextMemberCount(countedSize);
  transaction.delete(targetRef);
  transaction.update(spaceRef, {
    memberCount,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  return memberCount;
}

async function leaveSpaceHandler({ auth, data, db }) {
  const uid = requireRegisteredAuth(auth);
  const spaceId = parseSpaceId(data?.spaceId);

  try {
    await db.runTransaction(async (transaction) => {
      const loaded = await loadSpaceAndTarget(transaction, db, spaceId, uid);
      if (loaded.space.ownerUid === uid) {
        throw new HttpsError('failed-precondition', '방장은 공간을 나갈 수 없어요.');
      }
      if (!loaded.targetSnap.exists) {
        throw new HttpsError('failed-precondition', '이미 이 공간에서 나갔어요.');
      }
      if (loaded.targetSnap.data()?.role === 'owner') {
        throw new HttpsError('failed-precondition', '방장은 공간을 나갈 수 없어요.');
      }
      commitRemoval(
        transaction,
        loaded.spaceRef,
        loaded.targetRef,
        loaded.countedSize,
      );
    });
    return { spaceId };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('[leaveSpace]', { uid });
    throw new HttpsError('internal', LEAVE_UNAVAILABLE);
  }
}

async function removeSpaceMemberHandler({ auth, data, db }) {
  const uid = requireRegisteredAuth(auth);
  const spaceId = parseSpaceId(data?.spaceId);
  const targetUid = parseTargetUid(data?.uid);

  try {
    await db.runTransaction(async (transaction) => {
      const loaded = await loadSpaceAndTarget(transaction, db, spaceId, targetUid);
      if (loaded.space.ownerUid !== uid) {
        throw new HttpsError('permission-denied', '공간 소유자만 멤버를 내보낼 수 있어요.');
      }
      if (targetUid === uid) {
        throw new HttpsError('failed-precondition', '자기 자신은 내보낼 수 없어요.');
      }
      if (targetUid === loaded.space.ownerUid) {
        throw new HttpsError('failed-precondition', '방장은 내보낼 수 없어요.');
      }
      if (!loaded.targetSnap.exists) {
        throw new HttpsError('not-found', '해당 멤버를 찾을 수 없어요.');
      }
      if (loaded.targetSnap.data()?.role === 'owner') {
        throw new HttpsError('failed-precondition', '방장은 내보낼 수 없어요.');
      }
      commitRemoval(
        transaction,
        loaded.spaceRef,
        loaded.targetRef,
        loaded.countedSize,
      );
    });
    return { spaceId, uid: targetUid };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('[removeSpaceMember]', { uid });
    throw new HttpsError('internal', REMOVE_UNAVAILABLE);
  }
}

module.exports = {
  LEAVE_UNAVAILABLE,
  REMOVE_UNAVAILABLE,
  parseTargetUid,
  nextMemberCount,
  leaveSpaceHandler,
  removeSpaceMemberHandler,
};
