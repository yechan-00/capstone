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
const { listSpaceMembersHandler } = require('../spaceMembers');
const {
  leaveSpaceHandler,
  removeSpaceMemberHandler,
} = require('../spaceMembership');
const {
  createSpaceInviteHandler,
  joinSpaceByInviteHandler,
} = require('../spaceInvites');

const PROJECT_ID = 'demo-regret-wallet-spaces';
const RULES = fs.readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8');
const T0 = 1_700_000_000_000;

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

describe('space membership emulator', function () {
  this.timeout(60000);

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
    adminApp = getApps().find((app) => app.name === 'space-membership-admin')
      || initializeApp({ projectId: PROJECT_ID }, 'space-membership-admin');
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
      data: { name: '멤버십 공간', type: 'friends' },
      db: adminDb,
    });
    return result.spaceId;
  }

  async function addMember(spaceId, uid) {
    await adminDb.doc(`spaces/${spaceId}/space_members/${uid}`).set({
      uid,
      role: 'member',
      joinedAt: FieldValue.serverTimestamp(),
      invitedByUid: 'owner-1',
    });
    const members = await adminDb.collection(`spaces/${spaceId}/space_members`).get();
    await adminDb.doc(`spaces/${spaceId}`).update({ memberCount: members.size });
  }

  it('일반 멤버 탈퇴 후 접근을 거부하고 개인 소비 기록은 유지한다', async () => {
    const spaceId = await createOwnedSpace();
    await addMember(spaceId, 'member-1');
    await adminDb.doc('expenses/exp-member-1').set({
      id: 'exp-member-1',
      userId: 'member-1',
      accountId: 'account_member-1',
      amount: 4200,
    });
    await adminDb.doc('accounts/account_member-1').set({
      id: 'account_member-1',
      userId: 'member-1',
      nickname: '멤버닉',
    });

    const left = await leaveSpaceHandler({
      auth: registeredAuth('member-1'),
      data: { spaceId },
      db: adminDb,
    });
    assert.deepStrictEqual(left, { spaceId });

    const memberSnap = await adminDb.doc(`spaces/${spaceId}/space_members/member-1`).get();
    const ownerSnap = await adminDb.doc(`spaces/${spaceId}/space_members/owner-1`).get();
    const spaceSnap = await adminDb.doc(`spaces/${spaceId}`).get();
    assert.strictEqual(memberSnap.exists, false);
    assert.strictEqual(ownerSnap.exists, true);
    assert.strictEqual(spaceSnap.data().memberCount, 1);

    await assert.rejects(
      () => listSpaceMembersHandler({ auth: registeredAuth('member-1'), data: { spaceId }, db: adminDb }),
      (error) => error.code === 'permission-denied',
    );

    const memberClient = registeredDb(testEnv, 'member-1');
    await assertFails(memberClient.doc(`spaces/${spaceId}`).get());
    await assertFails(memberClient.doc(`spaces/${spaceId}/space_members/member-1`).delete());
    const expense = await adminDb.doc('expenses/exp-member-1').get();
    const account = await adminDb.doc('accounts/account_member-1').get();
    assert.strictEqual(expense.exists, true);
    assert.strictEqual(expense.data().amount, 4200);
    assert.strictEqual(account.exists, true);
    assert.strictEqual(account.data().nickname, '멤버닉');
  });

  it('방장 탈퇴와 일반 멤버 내보내기를 거부한다', async () => {
    const spaceId = await createOwnedSpace();
    await addMember(spaceId, 'member-1');
    await addMember(spaceId, 'member-2');

    await assert.rejects(
      () => leaveSpaceHandler({ auth: registeredAuth('owner-1'), data: { spaceId }, db: adminDb }),
      (error) => error.code === 'failed-precondition',
    );
    await assert.rejects(
      () =>
        removeSpaceMemberHandler({
          auth: registeredAuth('member-1'),
          data: { spaceId, uid: 'member-2' },
          db: adminDb,
        }),
      (error) => error.code === 'permission-denied',
    );
    await assert.rejects(
      () =>
        removeSpaceMemberHandler({
          auth: registeredAuth('owner-1'),
          data: { spaceId, uid: 'owner-1' },
          db: adminDb,
        }),
      (error) => error.code === 'failed-precondition',
    );

    const space = await adminDb.doc(`spaces/${spaceId}`).get();
    const members = await adminDb.collection(`spaces/${spaceId}/space_members`).get();
    assert.strictEqual(space.data().memberCount, 3);
    assert.strictEqual(members.size, 3);
  });

  it('방장 내보내기 후 대상의 접근을 거부한다', async () => {
    const spaceId = await createOwnedSpace();
    await addMember(spaceId, 'member-1');

    const removed = await removeSpaceMemberHandler({
      auth: registeredAuth('owner-1'),
      data: { spaceId, uid: 'member-1' },
      db: adminDb,
    });
    assert.deepStrictEqual(removed, { spaceId, uid: 'member-1' });

    const memberSnap = await adminDb.doc(`spaces/${spaceId}/space_members/member-1`).get();
    const spaceSnap = await adminDb.doc(`spaces/${spaceId}`).get();
    assert.strictEqual(memberSnap.exists, false);
    assert.strictEqual(spaceSnap.data().memberCount, 1);

    await assert.rejects(
      () => listSpaceMembersHandler({ auth: registeredAuth('member-1'), data: { spaceId }, db: adminDb }),
      (error) => error.code === 'permission-denied',
    );
    const removedClient = registeredDb(testEnv, 'member-1');
    await assertFails(removedClient.doc(`spaces/${spaceId}`).get());
    const ownerClient = registeredDb(testEnv, 'owner-1');
    await assertSucceeds(ownerClient.doc(`spaces/${spaceId}`).get());
  });

  it('중복 탈퇴와 없는 멤버 내보내기는 인원 수를 유지한다', async () => {
    const spaceId = await createOwnedSpace();
    await addMember(spaceId, 'member-1');
    await leaveSpaceHandler({ auth: registeredAuth('member-1'), data: { spaceId }, db: adminDb });

    await assert.rejects(
      () => leaveSpaceHandler({ auth: registeredAuth('member-1'), data: { spaceId }, db: adminDb }),
      (error) => error.code === 'failed-precondition',
    );
    await assert.rejects(
      () =>
        removeSpaceMemberHandler({
          auth: registeredAuth('owner-1'),
          data: { spaceId, uid: 'ghost' },
          db: adminDb,
        }),
      (error) => error.code === 'not-found',
    );
    const space = await adminDb.doc(`spaces/${spaceId}`).get();
    assert.strictEqual(space.data().memberCount, 1);
  });

  it('같은 멤버 동시 탈퇴는 한 번만 반영한다', async () => {
    const spaceId = await createOwnedSpace();
    await addMember(spaceId, 'member-1');
    const results = await Promise.allSettled([
      leaveSpaceHandler({ auth: registeredAuth('member-1'), data: { spaceId }, db: adminDb }),
      leaveSpaceHandler({ auth: registeredAuth('member-1'), data: { spaceId }, db: adminDb }),
    ]);
    const ok = results.filter((item) => item.status === 'fulfilled');
    const denied = results.filter((item) => item.status === 'rejected');
    assert.strictEqual(ok.length, 1);
    assert.strictEqual(denied.length, 1);
    assert.strictEqual(denied[0].reason.code, 'failed-precondition');
    const space = await adminDb.doc(`spaces/${spaceId}`).get();
    const members = await adminDb.collection(`spaces/${spaceId}/space_members`).get();
    assert.strictEqual(space.data().memberCount, 1);
    assert.strictEqual(members.size, 1);
  });

  it('서로 다른 멤버 동시 탈퇴와 초대 참여가 인원 수를 맞춘다', async () => {
    const spaceId = await createOwnedSpace();
    await addMember(spaceId, 'member-a');
    await addMember(spaceId, 'member-b');
    const created = await createSpaceInviteHandler({
      auth: registeredAuth('owner-1'),
      data: { spaceId },
      db: adminDb,
      pepper: 'emu-invite-pepper',
      nowMs: T0,
    });

    const raced = await Promise.allSettled([
      leaveSpaceHandler({ auth: registeredAuth('member-a'), data: { spaceId }, db: adminDb }),
      leaveSpaceHandler({ auth: registeredAuth('member-b'), data: { spaceId }, db: adminDb }),
      joinSpaceByInviteHandler({
        auth: registeredAuth('joiner-1'),
        data: { code: created.code },
        db: adminDb,
        pepper: 'emu-invite-pepper',
        nowMs: T0,
      }),
    ]);
    assert.ok(raced.every((item) => item.status === 'fulfilled'));

    const space = await adminDb.doc(`spaces/${spaceId}`).get();
    const members = await adminDb.collection(`spaces/${spaceId}/space_members`).get();
    assert.strictEqual(members.size, space.data().memberCount);
    assert.strictEqual(members.size, 2);
    assert.strictEqual((await adminDb.doc(`spaces/${spaceId}/space_members/owner-1`).get()).exists, true);
    assert.strictEqual((await adminDb.doc(`spaces/${spaceId}/space_members/joiner-1`).get()).exists, true);
    assert.strictEqual((await adminDb.doc(`spaces/${spaceId}/space_members/member-a`).get()).exists, false);
    assert.strictEqual((await adminDb.doc(`spaces/${spaceId}/space_members/member-b`).get()).exists, false);
  });
});
