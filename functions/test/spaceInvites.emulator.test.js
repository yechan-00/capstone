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
const { FieldValue } = require('firebase-admin/firestore');
const {
  INVITE_TTL_MS,
  INVITE_FAIL_LIMIT,
  hashInviteCode,
  createSpaceInviteHandler,
  getSpaceInviteHandler,
  rotateSpaceInviteHandler,
  revokeSpaceInviteHandler,
  previewSpaceInviteHandler,
  joinSpaceByInviteHandler,
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

function registeredDb(testEnv, uid) {
  return testEnv.authenticatedContext(uid, {
    firebase: { sign_in_provider: 'password' },
  }).firestore();
}

describe('space invites emulator', function () {
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

  async function createOwnedSpace(uid = 'owner-1', type = 'friends') {
    const result = await createSpaceHandler({
      auth: registeredAuth(uid),
      data: { name: '초대 공간', type },
      db: adminDb,
    });
    return result.spaceId;
  }

  function inviteOpts(uid, spaceId, nowMs) {
    return {
      auth: registeredAuth(uid),
      data: { spaceId },
      db: adminDb,
      pepper: PEPPER,
      nowMs,
    };
  }

  it('생성 시각으로부터 정확히 2시간 뒤 만료한다', async () => {
    const spaceId = await createOwnedSpace();
    const created = await createSpaceInviteHandler(inviteOpts('owner-1', spaceId, T0));
    assert.strictEqual(Date.parse(created.expiresAt) - T0, INVITE_TTL_MS);

    const privateSnap = await adminDb.doc(`spaces/${spaceId}/invite_private/current`).get();
    const lookupId = privateSnap.data().inviteId;
    const lookupSnap = await adminDb.doc(`space_invites/${lookupId}`).get();
    assert.strictEqual(lookupSnap.data().expiresAt.toMillis() - lookupSnap.data().createdAt.toMillis(), INVITE_TTL_MS);
    assert.strictEqual(privateSnap.data().expiresAt.toMillis() - privateSnap.data().createdAt.toMillis(), INVITE_TTL_MS);
  });

  it('2시간 직전까지 유효하고 만료 시각부터 무효다', async () => {
    const spaceId = await createOwnedSpace();
    const created = await createSpaceInviteHandler(inviteOpts('owner-1', spaceId, T0));
    const before = await getSpaceInviteHandler(inviteOpts('owner-1', spaceId, T0 + INVITE_TTL_MS - 1));
    assert.strictEqual(before.code, created.code);
    assert.strictEqual(before.expiresAt, created.expiresAt);

    await assert.rejects(
      () => getSpaceInviteHandler(inviteOpts('owner-1', spaceId, T0 + INVITE_TTL_MS)),
      (error) => error.code === 'not-found',
    );
    await assert.rejects(
      () => getSpaceInviteHandler(inviteOpts('owner-1', spaceId, T0 + INVITE_TTL_MS + 1)),
      (error) => error.code === 'not-found',
    );
  });

  it('기존 코드 조회와 재호출은 만료 시각을 바꾸지 않는다', async () => {
    const spaceId = await createOwnedSpace();
    const first = await createSpaceInviteHandler(inviteOpts('owner-1', spaceId, T0));
    const again = await createSpaceInviteHandler(inviteOpts('owner-1', spaceId, T0 + 60 * 1000));
    const fetched = await getSpaceInviteHandler(inviteOpts('owner-1', spaceId, T0 + 90 * 1000));
    assert.strictEqual(again.code, first.code);
    assert.strictEqual(again.expiresAt, first.expiresAt);
    assert.strictEqual(fetched.code, first.code);
    assert.strictEqual(fetched.expiresAt, first.expiresAt);
  });

  it('재발급하면 새 코드와 새로운 2시간을 부여하고 이전 코드는 무효다', async () => {
    const spaceId = await createOwnedSpace();
    const first = await createSpaceInviteHandler(inviteOpts('owner-1', spaceId, T0));
    const rotated = await rotateSpaceInviteHandler(inviteOpts('owner-1', spaceId, T0 + 30 * 60 * 1000));
    assert.notStrictEqual(rotated.code, first.code);
    assert.strictEqual(Date.parse(rotated.expiresAt) - (T0 + 30 * 60 * 1000), INVITE_TTL_MS);

    const firstHash = hashInviteCode(first.code, PEPPER);
    const oldLookup = await adminDb.doc(`space_invites/${firstHash}`).get();
    assert.strictEqual(oldLookup.data().status, 'revoked');
    assert.ok(oldLookup.data().revokedAt);

    const privateSnap = await adminDb.doc(`spaces/${spaceId}/invite_private/current`).get();
    assert.strictEqual(privateSnap.data().code, rotated.code);
    assert.notStrictEqual(privateSnap.data().code, first.code);
  });

  it('원문은 invite_private에만 있고 검증 문서에는 없다', async () => {
    const spaceId = await createOwnedSpace();
    const created = await createSpaceInviteHandler(inviteOpts('owner-1', spaceId, T0));
    const privateSnap = await adminDb.doc(`spaces/${spaceId}/invite_private/current`).get();
    const lookupSnap = await adminDb.doc(`space_invites/${privateSnap.data().inviteId}`).get();
    assert.strictEqual(privateSnap.data().code, created.code);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(lookupSnap.data(), 'code'), false);
    assert.strictEqual(lookupSnap.data().code, undefined);
    assert.strictEqual(lookupSnap.data().spaceId, spaceId);
    assert.strictEqual(lookupSnap.data().codeHash, privateSnap.data().inviteId);
    assert.strictEqual(lookupSnap.data().status, 'active');
  });

  it('일반 멤버와 소유자 클라이언트는 원문·해시 문서를 직접 읽지 못한다', async () => {
    const spaceId = await createOwnedSpace();
    const created = await createSpaceInviteHandler(inviteOpts('owner-1', spaceId, T0));
    await adminDb.doc(`spaces/${spaceId}/space_members/member-1`).set({
      uid: 'member-1',
      role: 'member',
      joinedAt: new Date(),
      invitedByUid: 'owner-1',
    });

    const ownerDb = registeredDb(testEnv, 'owner-1');
    const memberDb = registeredDb(testEnv, 'member-1');
    const inviteId = hashInviteCode(created.code, PEPPER);

    await assertFails(ownerDb.doc(`spaces/${spaceId}/invite_private/current`).get());
    await assertFails(memberDb.doc(`spaces/${spaceId}/invite_private/current`).get());
    await assertFails(ownerDb.doc(`space_invites/${inviteId}`).get());
    await assertFails(memberDb.doc(`space_invites/${inviteId}`).get());
    await assertFails(memberDb.doc(`spaces/${spaceId}/invite_private/current`).set({ code: 'HACK' }));
    await assertFails(ownerDb.doc(`spaces/${spaceId}/invite_private/current`).update({ expiresAt: new Date() }));
    await assertFails(ownerDb.doc(`spaces/${spaceId}/invite_private/current`).delete());
    await assertFails(memberDb.doc(`space_invites/${inviteId}`).set({ status: 'active' }));
    await assertFails(ownerDb.doc(`space_invites/${inviteId}`).update({ status: 'revoked' }));
    await assertFails(ownerDb.doc(`space_invites/${inviteId}`).delete());
    await assertFails(ownerDb.doc('invite_attempts/owner-1').set({ failCount: 0 }));
    await assertFails(ownerDb.doc('invite_attempts/owner-1').delete());
    await assert.rejects(
      () => createSpaceInviteHandler(inviteOpts('member-1', spaceId, T0)),
      (error) => error.code === 'permission-denied',
    );
  });

  it('취소한 코드는 만료 전이어도 재사용할 수 없고 멤버십은 유지된다', async () => {
    const spaceId = await createOwnedSpace();
    const created = await createSpaceInviteHandler(inviteOpts('owner-1', spaceId, T0));
    const memberRef = adminDb.doc(`spaces/${spaceId}/space_members/owner-1`);
    const beforeMember = await memberRef.get();

    await revokeSpaceInviteHandler(inviteOpts('owner-1', spaceId, T0 + 1000));

    await assert.rejects(
      () => getSpaceInviteHandler(inviteOpts('owner-1', spaceId, T0 + 2000)),
      (error) => error.code === 'not-found',
    );
    const lookup = await adminDb.doc(`space_invites/${hashInviteCode(created.code, PEPPER)}`).get();
    assert.strictEqual(lookup.data().status, 'revoked');
    const priv = await adminDb.doc(`spaces/${spaceId}/invite_private/current`).get();
    assert.strictEqual(priv.data().status, 'revoked');
    assert.strictEqual(priv.data().code, undefined);

    const afterMember = await memberRef.get();
    assert.strictEqual(afterMember.data().role, beforeMember.data().role);
    assert.strictEqual(afterMember.exists, true);

    const next = await createSpaceInviteHandler(inviteOpts('owner-1', spaceId, T0 + 3000));
    assert.notStrictEqual(next.code, created.code);
    assert.strictEqual(Date.parse(next.expiresAt) - (T0 + 3000), INVITE_TTL_MS);
  });

  it('동시 발급·재발급 후에도 활성 코드는 하나다', async () => {
    const spaceId = await createOwnedSpace();
    const results = await Promise.all([
      createSpaceInviteHandler(inviteOpts('owner-1', spaceId, T0)),
      createSpaceInviteHandler(inviteOpts('owner-1', spaceId, T0)),
      createSpaceInviteHandler(inviteOpts('owner-1', spaceId, T0)),
    ]);
    assert.strictEqual(new Set(results.map((item) => item.code)).size, 1);
    assert.strictEqual(new Set(results.map((item) => item.expiresAt)).size, 1);

    await Promise.all([
      rotateSpaceInviteHandler(inviteOpts('owner-1', spaceId, T0 + 5000)),
      rotateSpaceInviteHandler(inviteOpts('owner-1', spaceId, T0 + 5000)),
    ]);

    const active = [];
    const all = await adminDb.collection('space_invites').get();
    all.docs.forEach((docSnap) => {
      const data = docSnap.data();
      if (data.spaceId === spaceId && data.status === 'active' && data.expiresAt.toMillis() > T0 + 5000) {
        active.push(docSnap.id);
      }
    });
    assert.strictEqual(active.length, 1);
    const priv = await adminDb.doc(`spaces/${spaceId}/invite_private/current`).get();
    assert.strictEqual(priv.data().inviteId, active[0]);
    assert.ok(priv.data().code);
  });

  it('만료 후 새 코드를 발급하며 만료된 코드는 연장하지 않는다', async () => {
    const spaceId = await createOwnedSpace();
    const first = await createSpaceInviteHandler(inviteOpts('owner-1', spaceId, T0));
    const next = await createSpaceInviteHandler(inviteOpts('owner-1', spaceId, T0 + INVITE_TTL_MS + 1));
    assert.notStrictEqual(next.code, first.code);
    assert.strictEqual(Date.parse(next.expiresAt) - (T0 + INVITE_TTL_MS + 1), INVITE_TTL_MS);
    const oldLookup = await adminDb.doc(`space_invites/${hashInviteCode(first.code, PEPPER)}`).get();
    assert.strictEqual(oldLookup.data().status, 'revoked');
  });

  function codeOpts(uid, code, nowMs) {
    return {
      auth: registeredAuth(uid),
      data: { code },
      db: adminDb,
      pepper: PEPPER,
      nowMs,
    };
  }

  async function fillMembers(spaceId, totalCount) {
    const existing = await adminDb.collection(`spaces/${spaceId}/space_members`).get();
    const writes = [];
    for (let i = existing.size; i < totalCount; i += 1) {
      const uid = `filler-${i}`;
      writes.push(
        adminDb.doc(`spaces/${spaceId}/space_members/${uid}`).set({
          uid,
          role: 'member',
          joinedAt: new Date(),
          invitedByUid: 'owner-1',
        }),
      );
    }
    await Promise.all(writes);
    await adminDb.doc(`spaces/${spaceId}`).update({ memberCount: totalCount });
  }

  it('정상 코드 미리보기는 최소 정보만 반환하고 멤버십을 만들지 않는다', async () => {
    const spaceId = await createOwnedSpace();
    const created = await createSpaceInviteHandler(inviteOpts('owner-1', spaceId, T0));
    const preview = await previewSpaceInviteHandler(codeOpts('joiner-1', created.code, T0));
    assert.deepStrictEqual(preview, {
      name: '초대 공간',
      type: 'friends',
      canJoin: true,
      reason: 'ok',
    });
    assert.deepStrictEqual(Object.keys(preview).sort(), ['canJoin', 'name', 'reason', 'type']);
    const serialized = JSON.stringify(preview);
    assert.strictEqual(serialized.includes('owner-1'), false);
    assert.strictEqual(serialized.includes(created.code), false);
    assert.strictEqual(serialized.includes(hashInviteCode(created.code, PEPPER)), false);

    const joiner = await adminDb.doc(`spaces/${spaceId}/space_members/joiner-1`).get();
    assert.strictEqual(joiner.exists, false);
    const space = await adminDb.doc(`spaces/${spaceId}`).get();
    assert.strictEqual(space.data().memberCount, 1);
  });

  it('잘못된·만료·취소 코드와 비활성 공간·비회원·익명 preview를 거부한다', async () => {
    const spaceId = await createOwnedSpace();
    const created = await createSpaceInviteHandler(inviteOpts('owner-1', spaceId, T0));

    await assert.rejects(
      () => previewSpaceInviteHandler(codeOpts('joiner-1', 'ZZZZZZZZ', T0)),
      (error) => error.code === 'not-found',
    );
    await assert.rejects(
      () => previewSpaceInviteHandler(codeOpts('joiner-1', 'bad', T0)),
      (error) => error.code === 'invalid-argument',
    );
    await assert.rejects(
      () => previewSpaceInviteHandler(codeOpts('joiner-1', created.code, T0 + INVITE_TTL_MS)),
      (error) => error.code === 'not-found',
    );

    await revokeSpaceInviteHandler(inviteOpts('owner-1', spaceId, T0 + 1000));
    await assert.rejects(
      () => previewSpaceInviteHandler(codeOpts('joiner-1', created.code, T0 + 2000)),
      (error) => error.code === 'not-found',
    );

    const next = await createSpaceInviteHandler(inviteOpts('owner-1', spaceId, T0 + 3000));
    await adminDb.doc(`spaces/${spaceId}`).update({ status: 'inactive' });
    await assert.rejects(
      () => previewSpaceInviteHandler(codeOpts('joiner-1', next.code, T0 + 3000)),
      (error) => error.code === 'failed-precondition',
    );

    await assert.rejects(
      () => previewSpaceInviteHandler({ auth: null, data: { code: next.code }, db: adminDb, pepper: PEPPER, nowMs: T0 }),
      (error) => error.code === 'unauthenticated',
    );
    await assert.rejects(
      () =>
        previewSpaceInviteHandler({
          auth: { uid: 'anon-1', token: { firebase: { sign_in_provider: 'anonymous' } } },
          data: { code: next.code },
          db: adminDb,
          pepper: PEPPER,
          nowMs: T0,
        }),
      (error) => error.code === 'permission-denied',
    );
  });

  it('이미 멤버이거나 정원이 찬 공간은 preview에서 참여 불가로 표시한다', async () => {
    const spaceId = await createOwnedSpace();
    const created = await createSpaceInviteHandler(inviteOpts('owner-1', spaceId, T0));
    const ownerPreview = await previewSpaceInviteHandler(codeOpts('owner-1', created.code, T0));
    assert.strictEqual(ownerPreview.reason, 'already-member');
    assert.strictEqual(ownerPreview.canJoin, false);

    await fillMembers(spaceId, 20);
    const full = await previewSpaceInviteHandler(codeOpts('joiner-1', created.code, T0));
    assert.strictEqual(full.reason, 'full');
    assert.strictEqual(full.canJoin, false);
  });

  it('정상 참여 시 멤버십을 만들고 memberCount를 늘린다', async () => {
    const spaceId = await createOwnedSpace();
    const created = await createSpaceInviteHandler(inviteOpts('owner-1', spaceId, T0));
    const joined = await joinSpaceByInviteHandler(codeOpts('joiner-1', created.code, T0));
    assert.deepStrictEqual(joined, { spaceId });
    const joinerDb = registeredDb(testEnv, 'joiner-1');
    await assertSucceeds(joinerDb.doc(`spaces/${spaceId}`).get());

    const member = await adminDb.doc(`spaces/${spaceId}/space_members/joiner-1`).get();
    assert.strictEqual(member.exists, true);
    assert.strictEqual(member.data().uid, 'joiner-1');
    assert.strictEqual(member.data().role, 'member');
    assert.strictEqual(member.data().invitedByUid, 'owner-1');
    assert.ok(member.data().joinedAt);

    const space = await adminDb.doc(`spaces/${spaceId}`).get();
    assert.strictEqual(space.data().memberCount, 2);
  });

  it('같은 UID의 중복·동시 참여는 멤버십을 덮어쓰지 않는다', async () => {
    const spaceId = await createOwnedSpace();
    const created = await createSpaceInviteHandler(inviteOpts('owner-1', spaceId, T0));
    const first = await joinSpaceByInviteHandler(codeOpts('joiner-1', created.code, T0));
    const memberBefore = await adminDb.doc(`spaces/${spaceId}/space_members/joiner-1`).get();

    const again = await joinSpaceByInviteHandler(codeOpts('joiner-1', created.code, T0 + 1000));
    assert.deepStrictEqual(first, { spaceId });
    assert.deepStrictEqual(again, { spaceId });

    const concurrent = await Promise.all([
      joinSpaceByInviteHandler(codeOpts('joiner-1', created.code, T0 + 2000)),
      joinSpaceByInviteHandler(codeOpts('joiner-1', created.code, T0 + 2000)),
    ]);
    assert.deepStrictEqual(concurrent, [{ spaceId }, { spaceId }]);

    const memberAfter = await adminDb.doc(`spaces/${spaceId}/space_members/joiner-1`).get();
    assert.strictEqual(memberAfter.data().role, 'member');
    assert.strictEqual(memberAfter.data().invitedByUid, memberBefore.data().invitedByUid);
    assert.strictEqual(
      memberAfter.data().joinedAt.toMillis(),
      memberBefore.data().joinedAt.toMillis(),
    );
    const space = await adminDb.doc(`spaces/${spaceId}`).get();
    assert.strictEqual(space.data().memberCount, 2);
    const members = await adminDb.collection(`spaces/${spaceId}/space_members`).get();
    assert.strictEqual(members.size, 2);
  });

  it('만료·취소된 코드는 기존 멤버라도 참여를 우회하지 못한다', async () => {
    const spaceId = await createOwnedSpace();
    const created = await createSpaceInviteHandler(inviteOpts('owner-1', spaceId, T0));
    await joinSpaceByInviteHandler(codeOpts('joiner-1', created.code, T0));

    await assert.rejects(
      () => joinSpaceByInviteHandler(codeOpts('joiner-1', created.code, T0 + INVITE_TTL_MS)),
      (error) => error.code === 'not-found',
    );

    const rotated = await rotateSpaceInviteHandler(inviteOpts('owner-1', spaceId, T0 + 60 * 1000));
    await assert.rejects(
      () => joinSpaceByInviteHandler(codeOpts('joiner-1', created.code, T0 + 60 * 1000)),
      (error) => error.code === 'not-found',
    );
    const stillMember = await adminDb.doc(`spaces/${spaceId}/space_members/joiner-1`).get();
    assert.strictEqual(stillMember.exists, true);
    assert.notStrictEqual(rotated.code, created.code);
  });

  it('마지막 자리 동시 참여는 20명을 넘기지 않는다', async () => {
    const spaceId = await createOwnedSpace();
    const created = await createSpaceInviteHandler(inviteOpts('owner-1', spaceId, T0));
    await fillMembers(spaceId, 19);

    const results = await Promise.allSettled([
      joinSpaceByInviteHandler(codeOpts('last-a', created.code, T0)),
      joinSpaceByInviteHandler(codeOpts('last-b', created.code, T0)),
    ]);
    const fulfilled = results.filter((item) => item.status === 'fulfilled');
    const rejected = results.filter((item) => item.status === 'rejected');
    assert.strictEqual(fulfilled.length, 1);
    assert.strictEqual(rejected.length, 1);
    assert.strictEqual(rejected[0].reason.code, 'failed-precondition');

    const space = await adminDb.doc(`spaces/${spaceId}`).get();
    assert.strictEqual(space.data().memberCount, 20);
    const members = await adminDb.collection(`spaces/${spaceId}/space_members`).get();
    assert.strictEqual(members.size, 20);

    await assert.rejects(
      () => joinSpaceByInviteHandler(codeOpts('last-c', created.code, T0)),
      (error) => error.code === 'failed-precondition',
    );
  });

  it('취소·재발급과 참여가 경쟁해도 무효 코드로 멤버십이 생기지 않는다', async () => {
    const spaceId = await createOwnedSpace();
    const created = await createSpaceInviteHandler(inviteOpts('owner-1', spaceId, T0));

    const revokeRace = await Promise.allSettled([
      revokeSpaceInviteHandler(inviteOpts('owner-1', spaceId, T0 + 10)),
      joinSpaceByInviteHandler(codeOpts('race-1', created.code, T0 + 10)),
    ]);
    const memberAfterRevoke = await adminDb.doc(`spaces/${spaceId}/space_members/race-1`).get();
    const lookupAfterRevoke = await adminDb.doc(`space_invites/${hashInviteCode(created.code, PEPPER)}`).get();
    assert.strictEqual(lookupAfterRevoke.data().status, 'revoked');
    if (memberAfterRevoke.exists) {
      assert.strictEqual(revokeRace.filter((item) => item.status === 'fulfilled').length >= 1, true);
    } else {
      const joinResult = revokeRace.find((item) => item.status === 'rejected' && item.reason.code === 'not-found');
      assert.ok(joinResult);
    }

    const next = await createSpaceInviteHandler(inviteOpts('owner-1', spaceId, T0 + 20));
    const rotateRace = await Promise.allSettled([
      rotateSpaceInviteHandler(inviteOpts('owner-1', spaceId, T0 + 30)),
      joinSpaceByInviteHandler(codeOpts('race-2', next.code, T0 + 30)),
    ]);
    const oldLookup = await adminDb.doc(`space_invites/${hashInviteCode(next.code, PEPPER)}`).get();
    assert.strictEqual(oldLookup.data().status, 'revoked');
    const racedMember = await adminDb.doc(`spaces/${spaceId}/space_members/race-2`).get();
    if (!racedMember.exists) {
      assert.ok(rotateRace.some((item) => item.status === 'rejected' && item.reason.code === 'not-found'));
    }
  });

  it('memberCount가 없는 기존 공간은 실제 멤버 수로 초기화하고 정원을 지킨다', async () => {
    const spaceId = await createOwnedSpace();
    const created = await createSpaceInviteHandler(inviteOpts('owner-1', spaceId, T0));
    await adminDb.doc(`spaces/${spaceId}`).update({ memberCount: FieldValue.delete() });
    const before = await adminDb.doc(`spaces/${spaceId}`).get();
    assert.strictEqual(before.data().memberCount, undefined);

    const joined = await joinSpaceByInviteHandler(codeOpts('legacy-1', created.code, T0));
    assert.deepStrictEqual(joined, { spaceId });
    const after = await adminDb.doc(`spaces/${spaceId}`).get();
    assert.strictEqual(after.data().memberCount, 2);

    await fillMembers(spaceId, 19);
    await adminDb.doc(`spaces/${spaceId}`).update({ memberCount: FieldValue.delete() });
    const lastSeat = await Promise.allSettled([
      joinSpaceByInviteHandler(codeOpts('legacy-a', created.code, T0)),
      joinSpaceByInviteHandler(codeOpts('legacy-b', created.code, T0)),
    ]);
    const ok = lastSeat.filter((item) => item.status === 'fulfilled');
    const denied = lastSeat.filter((item) => item.status === 'rejected');
    assert.strictEqual(ok.length, 1);
    assert.strictEqual(denied.length, 1);
    const space = await adminDb.doc(`spaces/${spaceId}`).get();
    assert.strictEqual(space.data().memberCount, 20);
    const members = await adminDb.collection(`spaces/${spaceId}/space_members`).get();
    assert.strictEqual(members.size, 20);
  });

  it('저장된 인원 수가 실제보다 커도 참여를 막지 않는다', async () => {
    const spaceId = await createOwnedSpace();
    const created = await createSpaceInviteHandler(inviteOpts('owner-1', spaceId, T0));
    await adminDb.doc(`spaces/${spaceId}`).update({ memberCount: 20 });

    const preview = await previewSpaceInviteHandler(codeOpts('seat-1', created.code, T0));
    assert.strictEqual(preview.reason, 'ok');
    const joined = await joinSpaceByInviteHandler(codeOpts('seat-1', created.code, T0));
    assert.deepStrictEqual(joined, { spaceId });
    const space = await adminDb.doc(`spaces/${spaceId}`).get();
    const members = await adminDb.collection(`spaces/${spaceId}/space_members`).get();
    assert.strictEqual(members.size, 2);
    assert.strictEqual(space.data().memberCount, 2);
  });

  it('저장된 인원 수가 실제보다 작아도 정원을 넘기지 않는다', async () => {
    const spaceId = await createOwnedSpace();
    const created = await createSpaceInviteHandler(inviteOpts('owner-1', spaceId, T0));
    await fillMembers(spaceId, 20);
    await adminDb.doc(`spaces/${spaceId}`).update({ memberCount: 10 });

    const preview = await previewSpaceInviteHandler(codeOpts('overflow-1', created.code, T0));
    assert.strictEqual(preview.reason, 'full');
    await assert.rejects(
      () => joinSpaceByInviteHandler(codeOpts('overflow-1', created.code, T0)),
      (error) => error.code === 'failed-precondition',
    );
    const space = await adminDb.doc(`spaces/${spaceId}`).get();
    const members = await adminDb.collection(`spaces/${spaceId}/space_members`).get();
    assert.strictEqual(members.size, 20);
    assert.strictEqual(space.data().memberCount, 10);
    assert.strictEqual((await adminDb.doc(`spaces/${spaceId}/space_members/overflow-1`).get()).exists, false);
  });

  it('실패 20회를 넘기면 조회 전에 제한하고 동시 실패에도 한도를 지킨다', async () => {
    const spaceId = await createOwnedSpace();
    await createSpaceInviteHandler(inviteOpts('owner-1', spaceId, T0));

    for (let i = 0; i < INVITE_FAIL_LIMIT; i += 1) {
      await assert.rejects(
        () => previewSpaceInviteHandler(codeOpts('limited-1', 'ZZZZZZZZ', T0)),
        (error) => error.code === 'not-found',
      );
    }
    await assert.rejects(
      () => previewSpaceInviteHandler(codeOpts('limited-1', 'YYYYYYYY', T0)),
      (error) => error.code === 'resource-exhausted',
    );
    await assert.rejects(
      () => joinSpaceByInviteHandler(codeOpts('limited-1', 'YYYYYYYY', T0)),
      (error) => error.code === 'resource-exhausted',
    );

    const sequential = await adminDb.doc('invite_attempts/limited-1').get();
    assert.strictEqual(sequential.data().failCount, INVITE_FAIL_LIMIT);
    assert.strictEqual(Object.prototype.hasOwnProperty.call(sequential.data(), 'code'), false);

    const burst = await Promise.allSettled(
      Array.from({ length: INVITE_FAIL_LIMIT + 5 }, () =>
        previewSpaceInviteHandler(codeOpts('limited-2', 'ZZZZZZZZ', T0)),
      ),
    );
    const exhausted = burst.filter((item) => item.status === 'rejected' && item.reason.code === 'resource-exhausted');
    const missing = burst.filter((item) => item.status === 'rejected' && item.reason.code === 'not-found');
    assert.strictEqual(exhausted.length + missing.length, INVITE_FAIL_LIMIT + 5);
    assert.ok(exhausted.length >= 5);
    assert.strictEqual(missing.length, INVITE_FAIL_LIMIT);
    const concurrent = await adminDb.doc('invite_attempts/limited-2').get();
    assert.strictEqual(concurrent.data().failCount, INVITE_FAIL_LIMIT);
    assert.strictEqual(concurrent.data().code, undefined);
  });

  it('클라이언트는 멤버십·시도 횟수를 직접 쓰지 못하고 기존 가계부 규칙은 유지된다', async () => {
    const spaceId = await createOwnedSpace();
    const ownerDb = registeredDb(testEnv, 'owner-1');
    const joinerDb = registeredDb(testEnv, 'joiner-1');
    const userDb = registeredDb(testEnv, 'user-1');

    await assertFails(
      joinerDb.doc(`spaces/${spaceId}/space_members/joiner-1`).set({
        uid: 'joiner-1',
        role: 'member',
        joinedAt: new Date(),
        invitedByUid: 'owner-1',
      }),
    );
    await assertFails(ownerDb.doc('invite_attempts/owner-1').set({ failCount: 0, windowStartMs: T0 }));
    await assertFails(ownerDb.doc('invite_attempts/owner-1').get());
    await assertFails(joinerDb.collection(`spaces/${spaceId}/space_members`).get());

    await assertSucceeds(
      userDb.doc('accounts/account_user-1').set({
        id: 'account_user-1',
        userId: 'user-1',
      }),
    );
    await assertSucceeds(
      userDb.doc('expenses/exp-invite-rules').set({
        userId: 'user-1',
        accountId: 'account_user-1',
        amount: 500,
      }),
    );
  });
});
