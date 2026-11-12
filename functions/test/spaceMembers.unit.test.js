const assert = require('assert');
const { HttpsError } = require('firebase-functions/v2/https');
const {
  DEFAULT_DISPLAY_NAME,
  compareSpaceMembers,
  displayNameFromAccount,
  listSpaceMembersHandler,
  memberRole,
  publicPhotoUrl,
  sortSpaceMembers,
  toPublicMember,
} = require('../spaceMembers');

const OWNER = 'owner-1';
const MEMBER = 'member-1';
const SPACE_ID = 'space-1';
const OTHER_SPACE = 'space-2';

function registeredAuth(uid = OWNER) {
  return {
    uid,
    token: { firebase: { sign_in_provider: 'password' } },
  };
}

function makeDb({ space, members = {}, accounts = {} } = {}) {
  return {
    collection(name) {
      if (name === 'spaces') {
        return {
          doc(spaceId) {
            return {
              id: spaceId,
              async get() {
                return space && space.id === spaceId
                  ? { exists: true, data: () => space.data }
                  : { exists: false, data: () => undefined };
              },
              collection(sub) {
                if (sub !== 'space_members') {
                  return { doc() { return { async get() { return { exists: false }; } }; } };
                }
                const col = space && space.id === spaceId ? members : {};
                return {
                  doc(uid) {
                    return {
                      id: uid,
                      async get() {
                        return col[uid]
                          ? { exists: true, id: uid, data: () => col[uid] }
                          : { exists: false, id: uid, data: () => undefined };
                      },
                    };
                  },
                  async get() {
                    const docs = Object.entries(col).map(([id, data]) => ({
                      id,
                      data: () => data,
                    }));
                    return { docs, size: docs.length };
                  },
                };
              },
            };
          },
        };
      }
      if (name === 'accounts') {
        return {
          doc(id) {
            return {
              id,
              async get() {
                const data = accounts[id];
                return data
                  ? { exists: true, id, data: () => data }
                  : { exists: false, id, data: () => undefined };
              },
            };
          },
        };
      }
      throw new Error(`unexpected collection ${name}`);
    },
    async getAll(...refs) {
      return Promise.all(refs.map((ref) => ref.get()));
    },
  };
}

const activeSpace = {
  id: SPACE_ID,
  data: {
    name: '주말 모임',
    type: 'friends',
    ownerUid: OWNER,
    status: 'active',
    maxMembers: 20,
    memberCount: 2,
  },
};

describe('listSpaceMembers unit', () => {
  it('소유자가 멤버 목록을 조회한다', async () => {
    const db = makeDb({
      space: activeSpace,
      members: {
        [OWNER]: { uid: OWNER, role: 'owner', joinedAt: 1000 },
        [MEMBER]: { uid: MEMBER, role: 'member', joinedAt: 2000 },
      },
      accounts: {
        [`account_${OWNER}`]: { nickname: '방장닉' },
        [`account_${MEMBER}`]: { nickname: '멤버닉' },
      },
    });
    const result = await listSpaceMembersHandler({
      auth: registeredAuth(OWNER),
      data: { spaceId: SPACE_ID },
      db,
    });
    assert.strictEqual(result.members.length, 2);
    assert.strictEqual(result.members[0].uid, OWNER);
    assert.strictEqual(result.members[0].role, 'owner');
    assert.strictEqual(result.members[0].displayName, '방장닉');
    assert.strictEqual(result.members[1].uid, MEMBER);
    assert.strictEqual(result.members[1].role, 'member');
    assert.strictEqual(result.members[1].displayName, '멤버닉');
  });

  it('일반 멤버도 같은 공간의 목록을 조회한다', async () => {
    const db = makeDb({
      space: activeSpace,
      members: {
        [OWNER]: { uid: OWNER, role: 'owner', joinedAt: 1000 },
        [MEMBER]: { uid: MEMBER, role: 'member', joinedAt: 2000 },
      },
      accounts: {
        [`account_${OWNER}`]: { nickname: '방장닉' },
        [`account_${MEMBER}`]: { nickname: '멤버닉' },
      },
    });
    const result = await listSpaceMembersHandler({
      auth: registeredAuth(MEMBER),
      data: { spaceId: SPACE_ID },
      db,
    });
    assert.strictEqual(result.members.length, 2);
    assert.strictEqual(result.members[0].role, 'owner');
  });

  it('비회원(익명) 조회를 거부한다', async () => {
    const db = makeDb({ space: activeSpace, members: { [OWNER]: { uid: OWNER, role: 'owner' } } });
    await assert.rejects(
      () =>
        listSpaceMembersHandler({
          auth: { uid: 'anon-1', token: { firebase: { sign_in_provider: 'anonymous' } } },
          data: { spaceId: SPACE_ID },
          db,
        }),
      (error) => error instanceof HttpsError && error.code === 'permission-denied',
    );
  });

  it('비로그인 조회를 거부한다', async () => {
    const db = makeDb({ space: activeSpace });
    await assert.rejects(
      () => listSpaceMembersHandler({ auth: null, data: { spaceId: SPACE_ID }, db }),
      (error) => error instanceof HttpsError && error.code === 'unauthenticated',
    );
  });

  it('다른 공간 멤버의 조회를 거부한다', async () => {
    const db = makeDb({
      space: activeSpace,
      members: {
        [OWNER]: { uid: OWNER, role: 'owner', joinedAt: 1000 },
      },
    });
    await assert.rejects(
      () =>
        listSpaceMembersHandler({
          auth: registeredAuth('outsider-1'),
          data: { spaceId: SPACE_ID },
          db,
        }),
      (error) => error instanceof HttpsError && error.code === 'permission-denied',
    );
    assert.notStrictEqual(OTHER_SPACE, SPACE_ID);
  });

  it('존재하지 않는 공간 조회를 거부한다', async () => {
    const db = makeDb({});
    await assert.rejects(
      () =>
        listSpaceMembersHandler({
          auth: registeredAuth(),
          data: { spaceId: 'missing' },
          db,
        }),
      (error) => error instanceof HttpsError && error.code === 'not-found',
    );
  });

  it('비활성 공간 조회를 거부한다', async () => {
    const db = makeDb({
      space: {
        id: SPACE_ID,
        data: { ...activeSpace.data, status: 'inactive' },
      },
      members: {
        [OWNER]: { uid: OWNER, role: 'owner', joinedAt: 1000 },
      },
    });
    await assert.rejects(
      () =>
        listSpaceMembersHandler({
          auth: registeredAuth(),
          data: { spaceId: SPACE_ID },
          db,
        }),
      (error) => error instanceof HttpsError && error.code === 'failed-precondition',
    );
  });

  it('멤버 1명을 조회한다', async () => {
    const db = makeDb({
      space: { id: SPACE_ID, data: { ...activeSpace.data, memberCount: 1 } },
      members: {
        [OWNER]: { uid: OWNER, role: 'owner', joinedAt: 1000 },
      },
      accounts: {
        [`account_${OWNER}`]: { nickname: '혼자' },
      },
    });
    const result = await listSpaceMembersHandler({
      auth: registeredAuth(),
      data: { spaceId: SPACE_ID },
      db,
    });
    assert.strictEqual(result.members.length, 1);
    assert.strictEqual(result.members[0].displayName, '혼자');
    assert.strictEqual(result.members[0].role, 'owner');
  });

  it('멤버 여러 명을 조회한다', async () => {
    const members = {
      [OWNER]: { uid: OWNER, role: 'owner', joinedAt: 1000 },
    };
    const accounts = { [`account_${OWNER}`]: { nickname: '방장' } };
    for (let i = 1; i <= 4; i += 1) {
      const uid = `member-${i}`;
      members[uid] = { uid, role: 'member', joinedAt: 1000 + i };
      accounts[`account_${uid}`] = { nickname: `멤버${i}` };
    }
    const db = makeDb({
      space: { id: SPACE_ID, data: { ...activeSpace.data, memberCount: 5 } },
      members,
      accounts,
    });
    const result = await listSpaceMembersHandler({
      auth: registeredAuth('member-2'),
      data: { spaceId: SPACE_ID },
      db,
    });
    assert.strictEqual(result.members.length, 5);
    assert.deepStrictEqual(
      result.members.map((row) => row.displayName),
      ['방장', '멤버1', '멤버2', '멤버3', '멤버4'],
    );
  });

  it('방장을 일반 멤버보다 앞에 둔다', async () => {
    const rows = [
      { uid: 'm2', role: 'member', joinedAtMs: 1 },
      { uid: 'owner-1', role: 'owner', joinedAtMs: 9999 },
      { uid: 'm1', role: 'member', joinedAtMs: 1 },
    ];
    const sorted = sortSpaceMembers(rows);
    assert.strictEqual(sorted[0].role, 'owner');
    assert.strictEqual(sorted[1].uid, 'm1');
    assert.strictEqual(sorted[2].uid, 'm2');
    assert.ok(compareSpaceMembers(sorted[0], sorted[1]) < 0);
  });

  it('프로필 정보가 없으면 기본 표시명을 쓴다', async () => {
    const db = makeDb({
      space: activeSpace,
      members: {
        [OWNER]: { uid: OWNER, role: 'owner', joinedAt: 1000 },
        [MEMBER]: { uid: MEMBER, role: 'member', joinedAt: 2000 },
      },
      accounts: {
        [`account_${OWNER}`]: { nickname: '   ' },
      },
    });
    const result = await listSpaceMembersHandler({
      auth: registeredAuth(),
      data: { spaceId: SPACE_ID },
      db,
    });
    assert.strictEqual(result.members[0].displayName, DEFAULT_DISPLAY_NAME);
    assert.strictEqual(result.members[1].displayName, DEFAULT_DISPLAY_NAME);
  });

  it('이메일·전화번호·가계부 이름 등 불필요한 개인정보를 반환하지 않는다', async () => {
    const db = makeDb({
      space: activeSpace,
      members: {
        [OWNER]: {
          uid: OWNER,
          role: 'owner',
          joinedAt: 1000,
          invitedByUid: 'secret',
          email: 'owner@example.com',
        },
      },
      accounts: {
        [`account_${OWNER}`]: {
          nickname: '공개닉',
          name: '내 가계부',
          email: 'owner@example.com',
          expoPushToken: 'ExponentPushToken[secret]',
        },
      },
    });
    const result = await listSpaceMembersHandler({
      auth: registeredAuth(),
      data: { spaceId: SPACE_ID },
      db,
    });
    const row = result.members[0];
    assert.deepStrictEqual(Object.keys(row).sort(), ['displayName', 'joinedAt', 'role', 'uid']);
    assert.strictEqual(row.displayName, '공개닉');
    assert.strictEqual(row.email, undefined);
    assert.strictEqual(row.invitedByUid, undefined);
    assert.strictEqual(row.name, undefined);
    assert.strictEqual(row.expoPushToken, undefined);
    assert.strictEqual(row.profileImageUrl, undefined);
    assert.strictEqual(row.profileImageKey, undefined);
    const publicRow = toPublicMember({
      uid: OWNER,
      displayName: '공개닉',
      role: 'owner',
      joinedAt: row.joinedAt,
      email: 'hidden',
    });
    assert.strictEqual(publicRow.email, undefined);
  });

  it('잘못된 공간 ID를 거부한다', async () => {
    const db = makeDb({ space: activeSpace });
    await assert.rejects(
      () => listSpaceMembersHandler({ auth: registeredAuth(), data: { spaceId: '' }, db }),
      (error) => error instanceof HttpsError && error.code === 'invalid-argument',
    );
    await assert.rejects(
      () => listSpaceMembersHandler({ auth: registeredAuth(), data: { spaceId: 'a/b' }, db }),
      (error) => error instanceof HttpsError && error.code === 'invalid-argument',
    );
  });

  it('가계부 이름(name)은 표시명으로 쓰지 않는다', () => {
    assert.strictEqual(displayNameFromAccount({ nickname: '닉', name: '내 가계부' }), '닉');
    assert.strictEqual(displayNameFromAccount({ name: '내 가계부' }), null);
    assert.strictEqual(memberRole({ role: 'member' }, OWNER, OWNER), 'owner');
    assert.strictEqual(publicPhotoUrl('gs://bucket/a'), null);
    assert.strictEqual(publicPhotoUrl('https://firebasestorage.googleapis.com/v0/b/x'), null);
    assert.strictEqual(publicPhotoUrl('https://lh3.googleusercontent.com/a'), 'https://lh3.googleusercontent.com/a');
  });

  it('프로필 키가 있으면 짧은 멤버용 사진 URL만 반환한다', async () => {
    const db = makeDb({
      space: activeSpace,
      members: {
        [OWNER]: { uid: OWNER, role: 'owner', joinedAt: 1000 },
      },
      accounts: {
        [`account_${OWNER}`]: {
          nickname: '방장닉',
          profileImageKey: `users/${OWNER}/profile/avatar_abc.jpg`,
          email: 'owner@example.com',
        },
      },
    });
    const result = await listSpaceMembersHandler({
      auth: registeredAuth(),
      data: { spaceId: SPACE_ID },
      db,
      pepper: 'unit-profile-pepper',
      baseUrl: 'https://img.example',
      nowMs: 1_700_000_000_000,
    });
    assert.strictEqual(result.members[0].displayName, '방장닉');
    assert.ok(result.members[0].profileImageUrl.startsWith('https://img.example/v1/profiles/owner-1/avatar_abc.jpg?access='));
    assert.strictEqual(result.members[0].email, undefined);
    assert.strictEqual(result.members[0].profileImageKey, undefined);
  });
});
