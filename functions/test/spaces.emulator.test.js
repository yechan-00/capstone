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

describe('spaces emulator', function () {
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

    adminApp = getApps().find((app) => app.name === 'spaces-admin')
      || initializeApp({ projectId: PROJECT_ID }, 'spaces-admin');
    adminDb = getFirestore(adminApp);
  });

  after(async () => {
    if (testEnv) await testEnv.cleanup();
    if (adminApp) await deleteApp(adminApp);
  });

  beforeEach(async () => {
    if (testEnv) await testEnv.clearFirestore();
  });

  it('정식 회원이 공간을 만들면 공간·owner space_members가 함께 생기고 members는 없다', async () => {
    const result = await createSpaceHandler({
      auth: registeredAuth('owner-1'),
      data: { name: ' 주말 모임 ', type: 'family', ownerUid: 'forged-uid' },
      db: adminDb,
    });
    assert.ok(result.spaceId);

    const spaceSnap = await adminDb.collection('spaces').doc(result.spaceId).get();
    const memberSnap = await adminDb
      .collection('spaces')
      .doc(result.spaceId)
      .collection('space_members')
      .doc('owner-1')
      .get();
    const legacySnap = await adminDb
      .collection('spaces')
      .doc(result.spaceId)
      .collection('members')
      .doc('owner-1')
      .get();

    assert.strictEqual(spaceSnap.exists, true);
    assert.strictEqual(spaceSnap.data().name, '주말 모임');
    assert.strictEqual(spaceSnap.data().type, 'family');
    assert.strictEqual(spaceSnap.data().ownerUid, 'owner-1');
    assert.strictEqual(spaceSnap.data().status, 'active');
    assert.strictEqual(spaceSnap.data().maxMembers, 20);
    assert.strictEqual(spaceSnap.data().memberCount, 1);
    assert.strictEqual(memberSnap.exists, true);
    assert.strictEqual(memberSnap.data().uid, 'owner-1');
    assert.strictEqual(memberSnap.data().role, 'owner');
    assert.strictEqual(memberSnap.data().invitedByUid, null);
    assert.strictEqual(legacySnap.exists, false);
  });

  it('빈 이름·공백·길이 초과는 거부하고 문서를 남기지 않는다', async () => {
    const auth = registeredAuth('owner-1');
    await assert.rejects(
      () => createSpaceHandler({ auth, data: { name: '' }, db: adminDb }),
      (error) => error.code === 'invalid-argument',
    );
    await assert.rejects(
      () => createSpaceHandler({ auth, data: { name: '   ' }, db: adminDb }),
      (error) => error.code === 'invalid-argument',
    );
    await assert.rejects(
      () => createSpaceHandler({ auth, data: { name: '가'.repeat(41) }, db: adminDb }),
      (error) => error.code === 'invalid-argument',
    );
    const leftover = await adminDb.collection('spaces').get();
    assert.strictEqual(leftover.size, 0);
  });

  it('비로그인·익명 생성을 거부하고 문서를 남기지 않는다', async () => {
    await assert.rejects(
      () => createSpaceHandler({ auth: null, data: { name: '우리집' }, db: adminDb }),
      (error) => error.code === 'unauthenticated',
    );
    await assert.rejects(
      () =>
        createSpaceHandler({
          auth: { uid: 'anon-1', token: { firebase: { sign_in_provider: 'anonymous' } } },
          data: { name: '우리집' },
          db: adminDb,
        }),
      (error) => error.code === 'permission-denied',
    );
    const leftover = await adminDb.collection('spaces').get();
    assert.strictEqual(leftover.size, 0);
  });

  it('공간 조회는 멤버만 허용하고 비멤버·익명·비로그인은 거부한다', async () => {
    const { spaceId } = await createSpaceHandler({
      auth: registeredAuth('owner-1'),
      data: { name: '가족', type: 'family' },
      db: adminDb,
    });

    const ownerDb = registeredDb(testEnv, 'owner-1');
    const otherDb = registeredDb(testEnv, 'other-1');
    const anonDb = testEnv.authenticatedContext('anon-1', {
      firebase: { sign_in_provider: 'anonymous' },
    }).firestore();
    const guestDb = testEnv.unauthenticatedContext().firestore();

    await assertSucceeds(ownerDb.doc(`spaces/${spaceId}`).get());
    await assertFails(otherDb.doc(`spaces/${spaceId}`).get());
    await assertFails(anonDb.doc(`spaces/${spaceId}`).get());
    await assertFails(guestDb.doc(`spaces/${spaceId}`).get());
    await assertFails(ownerDb.doc(`spaces/${spaceId}`).set({ name: '해킹' }));
  });

  it('본인 멤버십만 get 가능하고 클라이언트 쓰기는 거부된다', async () => {
    const { spaceId } = await createSpaceHandler({
      auth: registeredAuth('owner-1'),
      data: { name: '가족', type: 'family' },
      db: adminDb,
    });
    await adminDb.doc(`spaces/${spaceId}/space_members/intruder`).set({
      uid: 'intruder',
      role: 'member',
      joinedAt: new Date(),
      invitedByUid: 'owner-1',
    });

    const ownerDb = registeredDb(testEnv, 'owner-1');
    const otherDb = registeredDb(testEnv, 'other-1');
    const memberPath = `spaces/${spaceId}/space_members`;

    await assertSucceeds(ownerDb.doc(`${memberPath}/owner-1`).get());
    await assertFails(otherDb.doc(`${memberPath}/owner-1`).get());
    await assertFails(ownerDb.doc(`${memberPath}/intruder`).get());
    await assertFails(ownerDb.collection(memberPath).get());
    await assertFails(
      ownerDb.doc(`${memberPath}/forged`).set({
        uid: 'forged',
        role: 'owner',
        joinedAt: new Date(),
        invitedByUid: null,
      }),
    );
    await assertFails(ownerDb.doc(`${memberPath}/owner-1`).update({ role: 'member' }));
    await assertFails(ownerDb.doc(`${memberPath}/owner-1`).delete());
  });

  it('space_members collectionGroup은 본인 UID 필터만 허용한다', async () => {
    const { spaceId } = await createSpaceHandler({
      auth: registeredAuth('owner-1'),
      data: { name: '친구', type: 'friends' },
      db: adminDb,
    });
    await adminDb.doc('accounts/account_other-1/members/guest-row').set({
      uid: 'owner-1',
      userId: 'guest-row',
      accountId: 'account_other-1',
    });
    await adminDb.doc('accounts/account_owner-1/members/owner-1').set({
      userId: 'owner-1',
      accountId: 'account_owner-1',
    });

    const ownerDb = registeredDb(testEnv, 'owner-1');
    const otherDb = registeredDb(testEnv, 'other-1');
    const anonDb = testEnv.authenticatedContext('anon-1', {
      firebase: { sign_in_provider: 'anonymous' },
    }).firestore();
    const guestDb = testEnv.unauthenticatedContext().firestore();

    const snap = await assertSucceeds(
      ownerDb.collectionGroup('space_members').where('uid', '==', 'owner-1').get(),
    );
    assert.strictEqual(snap.size, 1);
    assert.strictEqual(snap.docs[0].ref.path, `spaces/${spaceId}/space_members/owner-1`);
    const mixed = snap.docs.some((doc) => doc.ref.path.includes('/members/'));
    assert.strictEqual(mixed, false);

    await assertFails(ownerDb.collectionGroup('space_members').get());
    await assertFails(
      ownerDb.collectionGroup('space_members').where('uid', '==', 'other-1').get(),
    );
    await assertFails(
      otherDb.collectionGroup('space_members').where('uid', '==', 'owner-1').get(),
    );
    await assertFails(
      anonDb.collectionGroup('space_members').where('uid', '==', 'anon-1').get(),
    );
    await assertFails(
      guestDb.collectionGroup('space_members').where('uid', '==', 'owner-1').get(),
    );
  });

  it('계정 멤버십 uid 우회는 space_members 규칙으로 열리지 않는다', async () => {
    const { spaceId } = await createSpaceHandler({
      auth: registeredAuth('owner-1'),
      data: { name: '검증', type: 'couple' },
      db: adminDb,
    });
    await adminDb.doc('accounts/account_other-1/members/guest-row').set({
      uid: 'owner-1',
    });

    const ownerDb = registeredDb(testEnv, 'owner-1');
    const otherDb = registeredDb(testEnv, 'other-1');

    await assertFails(ownerDb.doc('accounts/account_other-1/members/guest-row').get());
    await assertSucceeds(otherDb.doc('accounts/account_other-1/members/guest-row').get());

    const spaceSnap = await assertSucceeds(
      ownerDb.collectionGroup('space_members').where('uid', '==', 'owner-1').get(),
    );
    const paths = spaceSnap.docs.map((doc) => doc.ref.path);
    assert.deepStrictEqual(paths, [`spaces/${spaceId}/space_members/owner-1`]);
    assert.strictEqual(
      paths.includes('accounts/account_other-1/members/guest-row'),
      false,
    );
  });

  it('기존 개인 가계부 규칙은 유지된다', async () => {
    const userDb = registeredDb(testEnv, 'user-1');
    const otherDb = registeredDb(testEnv, 'user-2');

    await assertSucceeds(
      userDb.doc('accounts/account_user-1').set({
        id: 'account_user-1',
        userId: 'user-1',
      }),
    );
    await assertFails(otherDb.doc('accounts/account_user-1').get());

    await assertSucceeds(
      userDb.doc('accounts/account_user-1/members/user-1').set({
        userId: 'user-1',
        accountId: 'account_user-1',
      }),
    );
    await assertSucceeds(userDb.doc('accounts/account_user-1/members/user-1').get());
    await assertFails(otherDb.doc('accounts/account_user-1/members/user-1').get());

    await assertSucceeds(
      userDb.doc('expenses/exp-1').set({
        userId: 'user-1',
        accountId: 'account_user-1',
        amount: 1000,
      }),
    );
    await assertSucceeds(userDb.doc('expenses/exp-1').get());
    await assertFails(otherDb.doc('expenses/exp-1').get());

    await assertSucceeds(
      userDb.doc('reviews/rev-1').set({
        userId: 'user-1',
        accountId: 'account_user-1',
        reviewerUserId: 'user-1',
      }),
    );
    await assertSucceeds(userDb.doc('reviews/rev-1').get());
    await assertFails(otherDb.doc('reviews/rev-1').get());
    await assertSucceeds(
      userDb.doc('review_schedules/sch-1').set({
        userId: 'user-1',
        accountId: 'account_user-1',
      }),
    );
    await assertSucceeds(
      userDb.doc('expense_shares/tok-1').set({
        createdByUserId: 'user-1',
        accountId: 'account_user-1',
        active: true,
      }),
    );
    await assertFails(otherDb.doc('expense_shares/tok-1').get());

    await adminDb.doc('user_notifications/n-1').set({
      userId: 'user-1',
      type: 'share_comment',
      read: false,
    });
    await assertSucceeds(userDb.doc('user_notifications/n-1').get());
    await assertFails(otherDb.doc('user_notifications/n-1').get());
    await assertFails(
      userDb.doc('user_notifications/n-2').set({
        userId: 'user-1',
        read: false,
      }),
    );
  });
});
