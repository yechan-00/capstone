const { HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

const SPACE_NAME_MAX = 40;
const SPACE_MAX_MEMBERS = 20;
const SPACE_TYPES = ['couple', 'friends', 'family', 'travel'];

function parseSpaceName(raw) {
  if (typeof raw !== 'string') {
    throw new HttpsError('invalid-argument', '공간 이름을 입력해 주세요.');
  }
  const name = raw.trim();
  if (!name) {
    throw new HttpsError('invalid-argument', '공간 이름을 입력해 주세요.');
  }
  if (name.length > SPACE_NAME_MAX) {
    throw new HttpsError('invalid-argument', `공간 이름은 ${SPACE_NAME_MAX}자 이하여야 해요.`);
  }
  return name;
}

function parseSpaceType(raw) {
  if (typeof raw !== 'string' || !SPACE_TYPES.includes(raw)) {
    throw new HttpsError('invalid-argument', '공간 유형을 선택해 주세요.');
  }
  return raw;
}

function requireRegisteredAuth(auth) {
  if (!auth || typeof auth.uid !== 'string' || auth.uid.length === 0) {
    throw new HttpsError('unauthenticated', '로그인이 필요해요.');
  }
  const provider = auth.token?.firebase?.sign_in_provider;
  if (!provider || provider === 'anonymous') {
    throw new HttpsError('permission-denied', '정식 회원만 공간을 만들 수 있어요.');
  }
  return auth.uid;
}

async function createSpaceDocuments(db, ownerUid, name, type) {
  const spaceRef = db.collection('spaces').doc();
  const memberRef = spaceRef.collection('space_members').doc(ownerUid);
  const now = admin.firestore.FieldValue.serverTimestamp();

  await db.runTransaction(async (transaction) => {
    transaction.set(spaceRef, {
      name,
      type,
      ownerUid,
      status: 'active',
      maxMembers: SPACE_MAX_MEMBERS,
      memberCount: 1,
      createdAt: now,
      updatedAt: now,
    });
    transaction.set(memberRef, {
      uid: ownerUid,
      role: 'owner',
      joinedAt: now,
      invitedByUid: null,
    });
  });

  return spaceRef.id;
}

async function createSpaceHandler({ auth, data, db }) {
  const ownerUid = requireRegisteredAuth(auth);
  const name = parseSpaceName(data?.name);
  const type = parseSpaceType(data?.type);
  try {
    const spaceId = await createSpaceDocuments(db, ownerUid, name, type);
    return { spaceId };
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('[createSpace]', error);
    throw new HttpsError('internal', '공간을 만들지 못했어요. 잠시 후 다시 시도해 주세요.');
  }
}

module.exports = {
  SPACE_NAME_MAX,
  SPACE_MAX_MEMBERS,
  SPACE_TYPES,
  parseSpaceName,
  parseSpaceType,
  requireRegisteredAuth,
  createSpaceDocuments,
  createSpaceHandler,
};
