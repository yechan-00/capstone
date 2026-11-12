const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { initializeApp, getApps, deleteApp } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} = require('@firebase/rules-unit-testing');
const { createSpaceHandler } = require('../createSpace');
const { DEFAULT_DISPLAY_NAME, listSpaceMembersHandler } = require('../spaceMembers');

const PROJECT_ID = 'demo-regret-wallet-spaces';
const RULES = fs.readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8');

function registeredAuth(uid) {
  return {
    uid,
    token: { firebase: { sign_in_provider: 'password' } },
  };
}

function registeredDb(testEnv, uid) {
  return testEnv.authenticatedContext(uid, {
    firebase: { sign_in_provider: 'password' },
  }).firestore();
}

describe('listSpaceMembers emulator', function () {
  this.timeout(30000);

  let testEnv;
  let adminDb;
  let adminApp;

  before(async function () {
    if (!process.env.FIRESTORE_EMULATOR_HOST) {
      this.skip();
    }
    testEnv = await initializeTestEnvironment({
      projectId: PROJECT_ID,
      firestore: { rules: RULES },
    });
    adminApp = getApps().find((app) => app.name === 'space-members-admin')
      || initializeApp({ projectId: PROJECT_ID }, 'space-members-admin');
    adminDb = getFirestore(adminApp);
  });

  after(async () => {
    if (testEnv) await testEnv.cleanup();
    if (adminApp) await deleteApp(adminApp);
  });

  beforeEach(async () => {
    if (testEnv) await testEnv.clearFirestore();
  });

  async function createOwnedSpace(uid = 'owner-1') {
    const result = await createSpaceHandler({
      auth: registeredAuth(uid),
      data: { name: '멤버 공간', type: 'friends' },
      db: adminDb,
    });
    return result.spaceId;
  }

  async function addMember(spaceId, uid, joinedAtMs) {
    await adminDb.doc(`spaces/${spaceId}/space_members/${uid}`).set({
      uid,
      role: 'member',
      joinedAt: joinedAtMs ? new Date(joinedAtMs) : FieldValue.serverTimestamp(),
      invitedByUid: 'owner-1',
    });
  }

  it('소유자와 일반 멤버가 실제 문서로 목록을 조회한다', async () => {
    const spaceId = await createOwnedSpace();
    await addMember(spaceId, 'member-1', 1_700_000_002_000);
    await adminDb.doc('accounts/account_owner-1').set({
      nickname: '소유자닉',
      name: '내 가계부',
      email: 'owner@example.com',
    });
    await adminDb.doc('accounts/account_member-1').set({
      nickname: '멤버닉',
      email: 'member@example.com',
    });

    const ownerResult = await listSpaceMembersHandler({
      auth: registeredAuth('owner-1'),
      data: { spaceId },
      db: adminDb,
    });
    const memberResult = await listSpaceMembersHandler({
      auth: registeredAuth('member-1'),
      data: { spaceId },
      db: adminDb,
    });

    assert.strictEqual(ownerResult.members.length, 2);
    assert.deepStrictEqual(
      ownerResult.members.map((row) => row.role),
      ['owner', 'member'],
    );
    assert.strictEqual(ownerResult.members[0].displayName, '소유자닉');
    assert.strictEqual(ownerResult.members[1].displayName, '멤버닉');
    assert.strictEqual(memberResult.members.length, 2);
    assert.strictEqual(ownerResult.members[0].email, undefined);
    assert.strictEqual(ownerResult.members[0].invitedByUid, undefined);

    await adminDb.doc('accounts/account_member-1').set({
      nickname: '멤버닉',
      profileImageKey: 'users/member-1/profile/avatar_abc.jpg',
      email: 'member@example.com',
    }, { merge: true });
    const withPhoto = await listSpaceMembersHandler({
      auth: registeredAuth('owner-1'),
      data: { spaceId },
      db: adminDb,
      pepper: 'emu-profile-pepper',
      baseUrl: 'https://img.example',
    });
    const memberRow = withPhoto.members.find((row) => row.uid === 'member-1');
    assert.ok(memberRow.profileImageUrl.startsWith('https://img.example/v1/profiles/member-1/avatar_abc.jpg?access='));
    assert.strictEqual(memberRow.email, undefined);
    assert.strictEqual(memberRow.profileImageKey, undefined);
  });

  it('다른 공간 멤버·비활성·없는 공간을 거부한다', async () => {
    const spaceA = await createOwnedSpace('owner-a');
    const spaceB = await createOwnedSpace('owner-b');
    await addMember(spaceA, 'shared-1');

    await assert.rejects(
      () =>
        listSpaceMembersHandler({
          auth: registeredAuth('shared-1'),
          data: { spaceId: spaceB },
          db: adminDb,
        }),
      (error) => error.code === 'permission-denied',
    );
    await assert.rejects(
      () =>
        listSpaceMembersHandler({
          auth: registeredAuth('owner-a'),
          data: { spaceId: 'missing-space' },
          db: adminDb,
        }),
      (error) => error.code === 'not-found',
    );

    await adminDb.doc(`spaces/${spaceA}`).update({ status: 'inactive' });
    await assert.rejects(
      () =>
        listSpaceMembersHandler({
          auth: registeredAuth('owner-a'),
          data: { spaceId: spaceA },
          db: adminDb,
        }),
      (error) => error.code === 'failed-precondition',
    );
  });

  it('프로필 없는 멤버는 기본 표시명을 쓰고 클라이언트 목록 조회는 막힌다', async () => {
    const spaceId = await createOwnedSpace();
    await addMember(spaceId, 'no-profile');
    const result = await listSpaceMembersHandler({
      auth: registeredAuth('owner-1'),
      data: { spaceId },
      db: adminDb,
    });
    const row = result.members.find((item) => item.uid === 'no-profile');
    assert.strictEqual(row.displayName, DEFAULT_DISPLAY_NAME);

    const ownerDb = registeredDb(testEnv, 'owner-1');
    await assertFails(ownerDb.collection(`spaces/${spaceId}/space_members`).get());
    await assertSucceeds(ownerDb.doc(`spaces/${spaceId}/space_members/owner-1`).get());
  });
});
