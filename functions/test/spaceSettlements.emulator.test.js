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

const PROJECT_ID = 'demo-regret-wallet-space-settlements';
const RULES = fs.readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8');

function registeredDb(testEnv, uid) {
  return testEnv.authenticatedContext(uid, {
    firebase: { sign_in_provider: 'password' },
  }).firestore();
}

function settlementDoc(overrides = {}) {
  const now = new Date();
  return {
    sharedExpenseId: 'se-1',
    titleSnapshot: '점심',
    dateKeySnapshot: '2026-11-07',
    amountSnapshot: 10000,
    paidByUidSnapshot: 'member-1',
    participantUidsSnapshot: ['member-1', 'owner-1'],
    splitMode: 'equal',
    shares: [
      { uid: 'member-1', amount: 5000 },
      { uid: 'owner-1', amount: 5000 },
    ],
    transfers: [
      {
        fromUid: 'owner-1',
        toUid: 'member-1',
        amount: 5000,
        status: 'pending',
        completedByUid: null,
        completedAt: null,
      },
    ],
    status: 'open',
    pendingAmount: 5000,
    completedTransferCount: 0,
    createdByUid: 'member-1',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

async function seedSpace(adminDb, spaceId, members) {
  await adminDb.doc(`spaces/${spaceId}`).set({
    name: '정산',
    type: 'friends',
    ownerUid: members[0].uid,
    status: 'active',
    maxMembers: 20,
    memberCount: members.length,
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  for (const member of members) {
    await adminDb.doc(`spaces/${spaceId}/space_members/${member.uid}`).set({
      uid: member.uid,
      role: member.role,
      joinedAt: new Date(),
      invitedByUid: null,
    });
  }
}

describe('space settlements rules', function () {
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
    adminApp = getApps().find((app) => app.name === 'space-settlements-admin')
      || initializeApp({ projectId: PROJECT_ID }, 'space-settlements-admin');
    adminDb = getFirestore(adminApp);
  });

  after(async () => {
    if (testEnv) await testEnv.cleanup();
    if (adminApp) await deleteApp(adminApp);
  });

  beforeEach(async () => {
    if (testEnv) await testEnv.clearFirestore();
  });

  it('멤버는 정산을 읽고, 클라이언트 직접 생성·수정·삭제는 거부한다', async () => {
    await seedSpace(adminDb, 'space-a', [
      { uid: 'owner-1', role: 'owner' },
      { uid: 'member-1', role: 'member' },
    ]);
    await adminDb.doc('spaces/space-a/settlements/st-1').set(settlementDoc());
    await adminDb.doc('spaces/space-a/settlement_locks/se-1').set({
      settlementId: 'st-1',
      sharedExpenseId: 'se-1',
      status: 'open',
    });
    const memberDb = registeredDb(testEnv, 'member-1');
    await assertSucceeds(memberDb.doc('spaces/space-a/settlements/st-1').get());
    await assertSucceeds(memberDb.collection('spaces/space-a/settlements').orderBy('createdAt', 'desc').get());
    await assertSucceeds(memberDb.doc('spaces/space-a/settlement_locks/se-1').get());
    await assertFails(memberDb.doc('spaces/space-a/settlements/st-2').set(settlementDoc({ createdByUid: 'member-1' })));
    await assertFails(memberDb.doc('spaces/space-a/settlements/st-1').update({ status: 'completed' }));
    await assertFails(memberDb.doc('spaces/space-a/settlements/st-1').delete());
    await assertFails(memberDb.doc('spaces/space-a/settlement_locks/se-1').delete());
  });

  it('비멤버는 정산 목록 조회도 거부한다', async () => {
    await seedSpace(adminDb, 'space-a', [
      { uid: 'owner-1', role: 'owner' },
      { uid: 'member-1', role: 'member' },
    ]);
    await adminDb.doc('spaces/space-a/settlements/st-1').set(settlementDoc());
    const outsiderDb = registeredDb(testEnv, 'outsider-1');
    await assertFails(outsiderDb.collection('spaces/space-a/settlements').orderBy('createdAt', 'desc').get());
  });

  it('비멤버·다른 공간·탈퇴 후에는 정산을 읽을 수 없다', async () => {
    await seedSpace(adminDb, 'space-a', [
      { uid: 'owner-1', role: 'owner' },
      { uid: 'member-1', role: 'member' },
    ]);
    await seedSpace(adminDb, 'space-b', [
      { uid: 'owner-2', role: 'owner' },
    ]);
    await adminDb.doc('spaces/space-a/settlements/st-1').set(settlementDoc());
    const outsiderDb = registeredDb(testEnv, 'outsider-1');
    const otherSpaceDb = registeredDb(testEnv, 'owner-2');
    await assertFails(outsiderDb.doc('spaces/space-a/settlements/st-1').get());
    await assertFails(otherSpaceDb.doc('spaces/space-a/settlements/st-1').get());

    await adminDb.doc('spaces/space-a/space_members/member-1').delete();
    const leftDb = registeredDb(testEnv, 'member-1');
    await assertFails(leftDb.doc('spaces/space-a/settlements/st-1').get());
  });

  it('현재 멤버는 탈퇴한 사용자가 포함된 과거 정산을 읽을 수 있다', async () => {
    await seedSpace(adminDb, 'space-a', [
      { uid: 'owner-1', role: 'owner' },
      { uid: 'member-1', role: 'member' },
    ]);
    await adminDb.doc('spaces/space-a/settlements/st-1').set(settlementDoc({
      participantUidsSnapshot: ['member-1', 'left-user'],
      shares: [
        { uid: 'member-1', amount: 5000 },
        { uid: 'left-user', amount: 5000 },
      ],
      transfers: [
        {
          fromUid: 'left-user',
          toUid: 'member-1',
          amount: 5000,
          status: 'pending',
          completedByUid: null,
          completedAt: null,
        },
      ],
    }));
    const memberDb = registeredDb(testEnv, 'member-1');
    const snap = await assertSucceeds(memberDb.doc('spaces/space-a/settlements/st-1').get());
    assert.strictEqual(snap.data().participantUidsSnapshot.includes('left-user'), true);
  });
});
