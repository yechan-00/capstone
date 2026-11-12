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

const PROJECT_ID = 'demo-regret-wallet-space-events';
const RULES = fs.readFileSync(path.resolve(__dirname, '../../firestore.rules'), 'utf8');

function registeredDb(testEnv, uid) {
  return testEnv.authenticatedContext(uid, {
    firebase: { sign_in_provider: 'password' },
  }).firestore();
}

function eventDoc(overrides = {}) {
  const now = new Date();
  return {
    title: '점심',
    dateKey: '2026-11-07',
    allDay: true,
    startTime: null,
    endTime: null,
    description: '',
    createdByUid: 'member-1',
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

async function seedSpace(adminDb, spaceId, members) {
  await adminDb.doc(`spaces/${spaceId}`).set({
    name: '공유 캘린더',
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

describe('space events rules', function () {
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

    adminApp = getApps().find((app) => app.name === 'space-events-admin')
      || initializeApp({ projectId: PROJECT_ID }, 'space-events-admin');
    adminDb = getFirestore(adminApp);
  });

  after(async () => {
    if (testEnv) await testEnv.cleanup();
    if (adminApp) await deleteApp(adminApp);
  });

  beforeEach(async () => {
    if (testEnv) await testEnv.clearFirestore();
  });

  it('멤버는 일정을 읽고 만들 수 있다', async () => {
    await seedSpace(adminDb, 'space-a', [
      { uid: 'owner-1', role: 'owner' },
      { uid: 'member-1', role: 'member' },
    ]);
    const memberDb = registeredDb(testEnv, 'member-1');
    const ownerDb = registeredDb(testEnv, 'owner-1');

    await assertSucceeds(memberDb.doc('spaces/space-a/events/e1').set(eventDoc()));
    const snap = await assertSucceeds(ownerDb.doc('spaces/space-a/events/e1').get());
    assert.strictEqual(snap.data().title, '점심');
    const list = await assertSucceeds(
      memberDb.collection('spaces/space-a/events')
        .where('dateKey', '>=', '2026-11-01')
        .where('dateKey', '<=', '2026-11-30')
        .get(),
    );
    assert.strictEqual(list.size, 1);
  });

  it('비회원·비멤버·다른 공간 접근을 거부한다', async () => {
    await seedSpace(adminDb, 'space-a', [{ uid: 'owner-1', role: 'owner' }]);
    await seedSpace(adminDb, 'space-b', [{ uid: 'other-1', role: 'owner' }]);
    await adminDb.doc('spaces/space-a/events/e1').set(eventDoc({ createdByUid: 'owner-1' }));

    const otherDb = registeredDb(testEnv, 'other-1');
    const anonDb = testEnv.authenticatedContext('anon-1', {
      firebase: { sign_in_provider: 'anonymous' },
    }).firestore();
    const guestDb = testEnv.unauthenticatedContext().firestore();

    await assertFails(otherDb.doc('spaces/space-a/events/e1').get());
    await assertFails(otherDb.collection('spaces/space-a/events').get());
    await assertFails(otherDb.doc('spaces/space-a/events/hack').set(eventDoc({ createdByUid: 'other-1' })));
    await assertFails(anonDb.doc('spaces/space-a/events/e1').get());
    await assertFails(guestDb.doc('spaces/space-a/events/e1').get());
    await assertSucceeds(otherDb.doc('spaces/space-b/events/own').set(eventDoc({
      createdByUid: 'other-1',
    })));
    await assertFails(otherDb.doc('spaces/space-a/events/e1').get());
  });

  it('탈퇴·내보내기 후에는 기존 일정도 읽지 못한다', async () => {
    await seedSpace(adminDb, 'space-a', [
      { uid: 'owner-1', role: 'owner' },
      { uid: 'member-1', role: 'member' },
    ]);
    await adminDb.doc('spaces/space-a/events/e1').set(eventDoc());

    const memberDb = registeredDb(testEnv, 'member-1');
    await assertSucceeds(memberDb.doc('spaces/space-a/events/e1').get());

    await adminDb.doc('spaces/space-a/space_members/member-1').delete();
    await assertFails(memberDb.doc('spaces/space-a/events/e1').get());
    await assertFails(memberDb.collection('spaces/space-a/events').get());
    await assertFails(memberDb.doc('spaces/space-a/events/e2').set(eventDoc()));
  });

  it('작성자만 수정·삭제할 수 있고 방장도 다른 멤버 일정은 못 바꾼다', async () => {
    await seedSpace(adminDb, 'space-a', [
      { uid: 'owner-1', role: 'owner' },
      { uid: 'member-1', role: 'member' },
      { uid: 'member-2', role: 'member' },
    ]);
    const created = eventDoc();
    await adminDb.doc('spaces/space-a/events/e1').set(created);

    const authorDb = registeredDb(testEnv, 'member-1');
    const ownerDb = registeredDb(testEnv, 'owner-1');
    const otherDb = registeredDb(testEnv, 'member-2');

    await assertSucceeds(authorDb.doc('spaces/space-a/events/e1').update({
      title: '저녁',
      updatedAt: new Date(),
    }));
    await assertFails(ownerDb.doc('spaces/space-a/events/e1').update({
      title: '방장 수정',
      updatedAt: new Date(),
    }));
    await assertFails(otherDb.doc('spaces/space-a/events/e1').update({
      title: '다른 멤버',
      updatedAt: new Date(),
    }));
    await assertFails(ownerDb.doc('spaces/space-a/events/e1').delete());
    await assertFails(otherDb.doc('spaces/space-a/events/e1').delete());
    await assertSucceeds(authorDb.doc('spaces/space-a/events/e1').delete());
  });

  it('작성자 UID·생성 시각 위조와 잘못된 필드를 거부한다', async () => {
    await seedSpace(adminDb, 'space-a', [
      { uid: 'owner-1', role: 'owner' },
      { uid: 'member-1', role: 'member' },
    ]);
    const memberDb = registeredDb(testEnv, 'member-1');

    await assertFails(memberDb.doc('spaces/space-a/events/forged').set(eventDoc({
      createdByUid: 'owner-1',
    })));
    await assertFails(memberDb.doc('spaces/space-a/events/extra').set(eventDoc({
      spaceId: 'space-a',
    })));
    await assertFails(memberDb.doc('spaces/space-a/events/long').set(eventDoc({
      title: '가'.repeat(61),
    })));
    await assertFails(memberDb.doc('spaces/space-a/events/bad-date').set(eventDoc({
      dateKey: '2026/11/07',
    })));
    await assertFails(memberDb.doc('spaces/space-a/events/bad-time').set(eventDoc({
      allDay: false,
      startTime: '9:00',
      endTime: null,
    })));

    const created = eventDoc();
    await adminDb.doc('spaces/space-a/events/e1').set(created);
    await assertFails(memberDb.doc('spaces/space-a/events/e1').update({
      createdByUid: 'owner-1',
      updatedAt: new Date(),
    }));
    await assertFails(memberDb.doc('spaces/space-a/events/e1').update({
      createdAt: new Date('2020-01-01T00:00:00.000Z'),
      updatedAt: new Date(),
    }));
  });

  it('기존 개인 가계부 규칙은 그대로다', async () => {
    const userDb = registeredDb(testEnv, 'user-1');
    const otherDb = registeredDb(testEnv, 'user-2');
    await assertSucceeds(userDb.doc('accounts/account_user-1').set({
      id: 'account_user-1',
      userId: 'user-1',
    }));
    await assertFails(otherDb.doc('accounts/account_user-1').get());
  });
});
