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

const PROJECT_ID = 'demo-regret-wallet-space-memories';
const RULES = fs.readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8');

function registeredDb(testEnv, uid) {
  return testEnv.authenticatedContext(uid, {
    firebase: { sign_in_provider: 'password' },
  }).firestore();
}

function memoryDoc(overrides = {}) {
  const now = new Date();
  return {
    title: '제주 여행',
    content: '바닷가',
    dateKey: '2026-11-07',
    createdByUid: 'member-1',
    imageKeys: [],
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

async function seedSpace(adminDb, spaceId, members) {
  await adminDb.doc(`spaces/${spaceId}`).set({
    name: '함께한 기록',
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

describe('space memories rules', function () {
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
    adminApp = getApps().find((app) => app.name === 'space-memories-admin')
      || initializeApp({ projectId: PROJECT_ID }, 'space-memories-admin');
    adminDb = getFirestore(adminApp);
  });

  after(async () => {
    if (testEnv) await testEnv.cleanup();
    if (adminApp) await deleteApp(adminApp);
  });

  beforeEach(async () => {
    if (testEnv) await testEnv.clearFirestore();
  });

  it('멤버는 사진 없는 기록을 만들고 읽을 수 있다', async () => {
    await seedSpace(adminDb, 'space-a', [
      { uid: 'owner-1', role: 'owner' },
      { uid: 'member-1', role: 'member' },
    ]);
    const memberDb = registeredDb(testEnv, 'member-1');
    await assertSucceeds(memberDb.doc('spaces/space-a/memories/m1').set(memoryDoc()));
    const snap = await assertSucceeds(registeredDb(testEnv, 'owner-1').doc('spaces/space-a/memories/m1').get());
    assert.strictEqual(snap.data().title, '제주 여행');
  });

  it('사진 1장과 5장은 허용하고 6장은 거부한다', async () => {
    await seedSpace(adminDb, 'space-a', [{ uid: 'member-1', role: 'member' }]);
    const memberDb = registeredDb(testEnv, 'member-1');
    await assertSucceeds(memberDb.doc('spaces/space-a/memories/one').set(memoryDoc({
      imageKeys: ['spaces/space-a/memories/one/img_1.jpg'],
    })));
    await assertSucceeds(memberDb.doc('spaces/space-a/memories/five').set(memoryDoc({
      imageKeys: [1, 2, 3, 4, 5].map((n) => `spaces/space-a/memories/five/img_${n}.jpg`),
    })));
    await assertFails(memberDb.doc('spaces/space-a/memories/six').set(memoryDoc({
      imageKeys: [1, 2, 3, 4, 5, 6].map((n) => `spaces/space-a/memories/six/img_${n}.jpg`),
    })));
  });

  it('이미지 키 위조와 다른 공간 키를 거부한다', async () => {
    await seedSpace(adminDb, 'space-a', [{ uid: 'member-1', role: 'member' }]);
    const memberDb = registeredDb(testEnv, 'member-1');
    await assertFails(memberDb.doc('spaces/space-a/memories/m1').set(memoryDoc({
      imageKeys: ['users/member-1/expenses/e1.jpg'],
    })));
    await assertFails(memberDb.doc('spaces/space-a/memories/m1').set(memoryDoc({
      imageKeys: ['spaces/other/memories/m1/img.jpg'],
    })));
    await assertFails(memberDb.doc('spaces/space-a/memories/m1').set(memoryDoc({
      imageUrl: 'https://example.com/a.jpg',
    })));
  });

  it('비멤버·탈퇴 후·다른 공간 접근을 거부한다', async () => {
    await seedSpace(adminDb, 'space-a', [
      { uid: 'owner-1', role: 'owner' },
      { uid: 'member-1', role: 'member' },
    ]);
    await seedSpace(adminDb, 'space-b', [{ uid: 'other-1', role: 'owner' }]);
    await adminDb.doc('spaces/space-a/memories/m1').set(memoryDoc());
    const otherDb = registeredDb(testEnv, 'other-1');
    await assertFails(otherDb.doc('spaces/space-a/memories/m1').get());
    await assertFails(otherDb.doc('spaces/space-a/memories/hack').set(memoryDoc({ createdByUid: 'other-1' })));

    const memberDb = registeredDb(testEnv, 'member-1');
    await adminDb.doc('spaces/space-a/space_members/member-1').delete();
    await assertFails(memberDb.doc('spaces/space-a/memories/m1').get());
  });

  it('작성자만 수정·삭제할 수 있고 방장도 다른 멤버 기록은 못 바꾼다', async () => {
    await seedSpace(adminDb, 'space-a', [
      { uid: 'owner-1', role: 'owner' },
      { uid: 'member-1', role: 'member' },
      { uid: 'member-2', role: 'member' },
    ]);
    await adminDb.doc('spaces/space-a/memories/m1').set(memoryDoc());
    const authorDb = registeredDb(testEnv, 'member-1');
    const ownerDb = registeredDb(testEnv, 'owner-1');
    const otherDb = registeredDb(testEnv, 'member-2');

    await assertSucceeds(authorDb.doc('spaces/space-a/memories/m1').update({
      title: '수정',
      dateKey: '2026-11-08',
      updatedAt: new Date(),
    }));
    await assertFails(ownerDb.doc('spaces/space-a/memories/m1').update({
      title: '방장',
      updatedAt: new Date(),
    }));
    await assertFails(otherDb.doc('spaces/space-a/memories/m1').delete());
    await assertFails(authorDb.doc('spaces/space-a/memories/m1').update({
      createdByUid: 'owner-1',
      updatedAt: new Date(),
    }));
    await assertFails(authorDb.doc('spaces/space-a/memories/m1').update({
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
    await assertSucceeds(authorDb.doc('spaces/space-a/memories/m1').delete());
  });

  it('기존 개인 가계부와 공유 일정 규칙은 그대로다', async () => {
    const userDb = registeredDb(testEnv, 'user-1');
    await assertSucceeds(userDb.doc('accounts/account_user-1').set({
      id: 'account_user-1',
      userId: 'user-1',
    }));
    await seedSpace(adminDb, 'space-a', [{ uid: 'member-1', role: 'member' }]);
    const memberDb = registeredDb(testEnv, 'member-1');
    await assertSucceeds(memberDb.doc('spaces/space-a/events/e1').set({
      title: '점심',
      dateKey: '2026-11-07',
      allDay: true,
      startTime: null,
      endTime: null,
      description: '',
      createdByUid: 'member-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    }));
  });
});
