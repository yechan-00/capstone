const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { initializeApp, getApps, deleteApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
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
  previewSpaceInviteHandler,
  joinSpaceByInviteHandler,
  revokeSpaceInviteHandler,
} = require('../spaceInvites');

const PROJECT_ID = 'demo-regret-wallet-spaces';
const RULES = fs.readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8');
const PEPPER = 'emu-invite-pepper';
const T0 = 1_700_000_000_000;

function registeredAuth(uid) {
  return {
    uid,
    token: { firebase: { sign_in_provider: 'password' } },
  };
}

function anonymousAuth(uid) {
  return {
    uid,
    token: { firebase: { sign_in_provider: 'anonymous' } },
  };
}

function registeredDb(testEnv, uid) {
  return testEnv.authenticatedContext(uid, {
    firebase: { sign_in_provider: 'password' },
  }).firestore();
}

describe('space lifecycle emulator', function () {
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
    adminApp = getApps().find((app) => app.name === 'space-lifecycle-admin')
      || initializeApp({ projectId: PROJECT_ID }, 'space-lifecycle-admin');
    adminDb = getFirestore(adminApp);
  });

  after(async function () {
    if (testEnv) await testEnv.cleanup();
    if (adminApp) await deleteApp(adminApp);
  });

  beforeEach(async function () {
    if (testEnv) await testEnv.clearFirestore();
  });

  function inviteOpts(uid, spaceId, nowMs) {
    return {
      auth: registeredAuth(uid),
      data: { spaceId },
      db: adminDb,
      pepper: PEPPER,
      nowMs,
    };
  }

  function codeOpts(uid, code, nowMs) {
    return {
      auth: registeredAuth(uid),
      data: { code },
      db: adminDb,
      pepper: PEPPER,
      nowMs,
    };
  }

  async function createOwnedSpace(uid = 'owner-a') {
    const result = await createSpaceHandler({
      auth: registeredAuth(uid),
      data: { name: '통합 공간', type: 'friends' },
      db: adminDb,
    });
    return result.spaceId;
  }

  it('생성·초대·참여·목록·탈퇴·재참여·내보내기 흐름이 이어진다', async () => {
    const spaceId = await createOwnedSpace('owner-a');
    await adminDb.doc('accounts/account_owner-a').set({ nickname: '에이', name: '가계부A' });
    await adminDb.doc('accounts/account_member-b').set({ nickname: '비', name: '가계부B' });
    await adminDb.doc('expenses/exp-b').set({
      id: 'exp-b',
      userId: 'member-b',
      accountId: 'account_member-b',
      amount: 3300,
    });

    const created = await createSpaceInviteHandler(inviteOpts('owner-a', spaceId, T0));
    const preview = await previewSpaceInviteHandler(codeOpts('member-b', created.code, T0));
    assert.strictEqual(preview.canJoin, true);

    const joined = await joinSpaceByInviteHandler(codeOpts('member-b', created.code, T0));
    assert.deepStrictEqual(joined, { spaceId });

    const listed = await listSpaceMembersHandler({
      auth: registeredAuth('owner-a'),
      data: { spaceId },
      db: adminDb,
    });
    assert.deepStrictEqual(
      listed.members.map((row) => row.uid).sort(),
      ['member-b', 'owner-a'],
    );
    assert.strictEqual(listed.members.find((row) => row.uid === 'owner-a').displayName, '에이');
    assert.strictEqual(listed.members.find((row) => row.uid === 'member-b').displayName, '비');
    assert.strictEqual(listed.members[0].email, undefined);
    assert.strictEqual((await adminDb.doc(`spaces/${spaceId}`).get()).data().memberCount, 2);

    await leaveSpaceHandler({
      auth: registeredAuth('member-b'),
      data: { spaceId },
      db: adminDb,
    });
    assert.strictEqual((await adminDb.doc(`spaces/${spaceId}/space_members/member-b`).get()).exists, false);
    assert.strictEqual((await adminDb.doc(`spaces/${spaceId}`).get()).data().memberCount, 1);
    await assert.rejects(
      () => listSpaceMembersHandler({ auth: registeredAuth('member-b'), data: { spaceId }, db: adminDb }),
      (error) => error.code === 'permission-denied',
    );
    await assertFails(registeredDb(testEnv, 'member-b').doc(`spaces/${spaceId}`).get());

    const rejoined = await joinSpaceByInviteHandler(codeOpts('member-b', created.code, T0 + 1000));
    assert.deepStrictEqual(rejoined, { spaceId });
    assert.strictEqual((await adminDb.doc(`spaces/${spaceId}`).get()).data().memberCount, 2);

    const removed = await removeSpaceMemberHandler({
      auth: registeredAuth('owner-a'),
      data: { spaceId, uid: 'member-b' },
      db: adminDb,
    });
    assert.deepStrictEqual(removed, { spaceId, uid: 'member-b' });
    await assert.rejects(
      () => listSpaceMembersHandler({ auth: registeredAuth('member-b'), data: { spaceId }, db: adminDb }),
      (error) => error.code === 'permission-denied',
    );
    await assertFails(registeredDb(testEnv, 'member-b').doc(`spaces/${spaceId}`).get());
    await assertSucceeds(registeredDb(testEnv, 'owner-a').doc(`spaces/${spaceId}`).get());

    const afterKick = await joinSpaceByInviteHandler(codeOpts('member-b', created.code, T0 + 2000));
    assert.deepStrictEqual(afterKick, { spaceId });
    assert.strictEqual((await adminDb.doc(`spaces/${spaceId}/space_members/member-b`).get()).exists, true);

    const expense = await adminDb.doc('expenses/exp-b').get();
    assert.strictEqual(expense.exists, true);
    assert.strictEqual(expense.data().amount, 3300);
  });

  it('비로그인·익명·비멤버는 공간 권한 작업을 하지 못한다', async () => {
    const spaceId = await createOwnedSpace('owner-a');
    const created = await createSpaceInviteHandler(inviteOpts('owner-a', spaceId, T0));
    await joinSpaceByInviteHandler(codeOpts('member-b', created.code, T0));

    await assert.rejects(
      () => listSpaceMembersHandler({ auth: null, data: { spaceId }, db: adminDb }),
      (error) => error.code === 'unauthenticated',
    );
    await assert.rejects(
      () =>
        leaveSpaceHandler({
          auth: anonymousAuth('anon-1'),
          data: { spaceId },
          db: adminDb,
        }),
      (error) => error.code === 'permission-denied',
    );
    await assert.rejects(
      () =>
        createSpaceInviteHandler({
          auth: registeredAuth('member-b'),
          data: { spaceId },
          db: adminDb,
          pepper: PEPPER,
          nowMs: T0,
        }),
      (error) => error.code === 'permission-denied',
    );
    await assert.rejects(
      () =>
        removeSpaceMemberHandler({
          auth: registeredAuth('outsider-1'),
          data: { spaceId, uid: 'member-b' },
          db: adminDb,
        }),
      (error) => error.code === 'permission-denied',
    );
    await assert.rejects(
      () => listSpaceMembersHandler({ auth: registeredAuth('outsider-1'), data: { spaceId }, db: adminDb }),
      (error) => error.code === 'permission-denied',
    );
    await assertFails(registeredDb(testEnv, 'outsider-1').doc(`spaces/${spaceId}`).get());
  });

  it('취소된 코드로는 재참여할 수 없고 활성 코드로는 가능하다', async () => {
    const spaceId = await createOwnedSpace('owner-a');
    const created = await createSpaceInviteHandler(inviteOpts('owner-a', spaceId, T0));
    await joinSpaceByInviteHandler(codeOpts('member-b', created.code, T0));
    await leaveSpaceHandler({ auth: registeredAuth('member-b'), data: { spaceId }, db: adminDb });

    await revokeSpaceInviteHandler(inviteOpts('owner-a', spaceId, T0 + 10));
    await assert.rejects(
      () => joinSpaceByInviteHandler(codeOpts('member-b', created.code, T0 + 20)),
      (error) => error.code === 'not-found',
    );

    const next = await createSpaceInviteHandler(inviteOpts('owner-a', spaceId, T0 + 30));
    const rejoined = await joinSpaceByInviteHandler(codeOpts('member-b', next.code, T0 + 40));
    assert.deepStrictEqual(rejoined, { spaceId });
  });

  it('닉네임 없는 멤버는 기본 표시명을 쓰고 가계부 이름은 쓰지 않는다', async () => {
    const spaceId = await createOwnedSpace('owner-a');
    const created = await createSpaceInviteHandler(inviteOpts('owner-a', spaceId, T0));
    await joinSpaceByInviteHandler(codeOpts('blank-b', created.code, T0));
    await adminDb.doc('accounts/account_blank-b').set({
      name: '숨겨진 가계부',
      email: 'hidden@example.com',
    });
    const listed = await listSpaceMembersHandler({
      auth: registeredAuth('owner-a'),
      data: { spaceId },
      db: adminDb,
    });
    const row = listed.members.find((item) => item.uid === 'blank-b');
    assert.strictEqual(row.displayName, '이름 없음');
    assert.strictEqual(row.email, undefined);
    assert.strictEqual(row.name, undefined);
  });
});
