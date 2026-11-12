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

const PROJECT_ID = 'demo-regret-wallet-space-shared-expenses';
const RULES = fs.readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8');

function registeredDb(testEnv, uid) {
  return testEnv.authenticatedContext(uid, {
    firebase: { sign_in_provider: 'password' },
  }).firestore();
}

function sharedExpenseDoc(overrides = {}) {
  const now = new Date();
  return {
    title: '점심',
    amount: 12000,
    dateKey: '2026-11-07',
    category: 'takeout',
    paidByUid: 'member-1',
    participantUids: ['member-1', 'owner-1'],
    memo: '',
    createdByUid: 'member-1',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

async function seedSpace(adminDb, spaceId, members) {
  await adminDb.doc(`spaces/${spaceId}`).set({
    name: '공동 소비',
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

describe('space shared expenses rules', function () {
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
    adminApp = getApps().find((app) => app.name === 'space-shared-expenses-admin')
      || initializeApp({ projectId: PROJECT_ID }, 'space-shared-expenses-admin');
    adminDb = getFirestore(adminApp);
  });

  after(async () => {
    if (testEnv) await testEnv.cleanup();
    if (adminApp) await deleteApp(adminApp);
  });

  beforeEach(async () => {
    if (testEnv) await testEnv.clearFirestore();
  });

  it('멤버는 공동 소비를 읽고, 클라이언트 직접 생성·수정은 거부한다', async () => {
    await seedSpace(adminDb, 'space-a', [
      { uid: 'owner-1', role: 'owner' },
      { uid: 'member-1', role: 'member' },
    ]);
    await adminDb.doc('spaces/space-a/shared_expenses/se-1').set(sharedExpenseDoc());
    const memberDb = registeredDb(testEnv, 'member-1');
    await assertSucceeds(memberDb.doc('spaces/space-a/shared_expenses/se-1').get());
    await assertFails(memberDb.doc('spaces/space-a/shared_expenses/se-2').set(sharedExpenseDoc({
      createdByUid: 'member-1',
    })));
    await assertFails(memberDb.doc('spaces/space-a/shared_expenses/se-1').update({ title: '저녁' }));
  });

  it('작성자만 삭제할 수 있고 방장은 다른 멤버 기록을 지우지 못한다', async () => {
    await seedSpace(adminDb, 'space-a', [
      { uid: 'owner-1', role: 'owner' },
      { uid: 'member-1', role: 'member' },
    ]);
    await adminDb.doc('spaces/space-a/shared_expenses/se-1').set(sharedExpenseDoc());
    const ownerDb = registeredDb(testEnv, 'owner-1');
    const memberDb = registeredDb(testEnv, 'member-1');
    await assertFails(ownerDb.doc('spaces/space-a/shared_expenses/se-1').delete());
    await assertSucceeds(memberDb.doc('spaces/space-a/shared_expenses/se-1').delete());
  });

  it('비멤버·다른 공간·탈퇴 후에는 읽을 수 없다', async () => {
    await seedSpace(adminDb, 'space-a', [
      { uid: 'owner-1', role: 'owner' },
      { uid: 'member-1', role: 'member' },
    ]);
    await seedSpace(adminDb, 'space-b', [
      { uid: 'owner-2', role: 'owner' },
    ]);
    await adminDb.doc('spaces/space-a/shared_expenses/se-1').set(sharedExpenseDoc());
    const outsiderDb = registeredDb(testEnv, 'outsider-1');
    const otherSpaceDb = registeredDb(testEnv, 'owner-2');
    await assertFails(outsiderDb.doc('spaces/space-a/shared_expenses/se-1').get());
    await assertFails(otherSpaceDb.doc('spaces/space-a/shared_expenses/se-1').get());

    await adminDb.doc('spaces/space-a/space_members/member-1').delete();
    const leftDb = registeredDb(testEnv, 'member-1');
    await assertFails(leftDb.doc('spaces/space-a/shared_expenses/se-1').get());
  });

  it('원본 연결 문서는 작성자 계정에만 있고 다른 멤버는 읽지 못한다', async () => {
    await adminDb.doc('accounts/account_member-1').set({
      id: 'account_member-1',
      userId: 'member-1',
    });
    await adminDb.doc('accounts/account_member-1/space_expense_links/space-a_se-1').set({
      spaceId: 'space-a',
      sharedExpenseId: 'se-1',
      expenseId: 'personal-secret',
      createdAt: new Date(),
    });
    const authorDb = registeredDb(testEnv, 'member-1');
    const ownerDb = registeredDb(testEnv, 'owner-1');
    await assertSucceeds(authorDb.doc('accounts/account_member-1/space_expense_links/space-a_se-1').get());
    await assertFails(ownerDb.doc('accounts/account_member-1/space_expense_links/space-a_se-1').get());
  });

  it('진행 중 정산 락이 있으면 작성자도 공동 소비를 삭제하지 못한다', async () => {
    await seedSpace(adminDb, 'space-a', [
      { uid: 'owner-1', role: 'owner' },
      { uid: 'member-1', role: 'member' },
    ]);
    await adminDb.doc('spaces/space-a/shared_expenses/se-1').set(sharedExpenseDoc());
    await adminDb.doc('spaces/space-a/settlement_locks/se-1').set({
      settlementId: 'st-1',
      sharedExpenseId: 'se-1',
      status: 'open',
    });
    const memberDb = registeredDb(testEnv, 'member-1');
    await assertFails(memberDb.doc('spaces/space-a/shared_expenses/se-1').delete());
    await adminDb.doc('spaces/space-a/settlement_locks/se-1').set({
      settlementId: 'st-1',
      sharedExpenseId: 'se-1',
      status: 'completed',
    });
    await assertSucceeds(memberDb.doc('spaces/space-a/shared_expenses/se-1').delete());
  });

  it('개인 소비 원본 접근 권한은 유지된다', async () => {
    await adminDb.doc('expenses/personal-1').set({
      id: 'personal-1',
      userId: 'member-1',
      accountId: 'account_member-1',
      amount: 4500,
      category: 'takeout',
      reason: '스트레스',
    });
    const authorDb = registeredDb(testEnv, 'member-1');
    const ownerDb = registeredDb(testEnv, 'owner-1');
    await assertSucceeds(authorDb.doc('expenses/personal-1').get());
    await assertFails(ownerDb.doc('expenses/personal-1').get());
  });
});
