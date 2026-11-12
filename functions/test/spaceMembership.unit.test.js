const assert = require('assert');
const { HttpsError } = require('firebase-functions/v2/https');
const {
  nextMemberCount,
  parseTargetUid,
  leaveSpaceHandler,
  removeSpaceMemberHandler,
} = require('../spaceMembership');

const OWNER = 'owner-1';
const MEMBER = 'member-1';
const OTHER = 'member-2';
const SPACE_ID = 'space-1';

function registeredAuth(uid = MEMBER) {
  return {
    uid,
    token: { firebase: { sign_in_provider: 'password' } },
  };
}

function makeDb({ space, members = {} } = {}) {
  const state = {
    space: space ? { ...space.data } : null,
    spaceId: space ? space.id : SPACE_ID,
    members: { ...members },
  };
  const writes = [];

  function membersCol() {
    return {
      path: `spaces/${state.spaceId}/space_members`,
      doc(uid) {
        return {
          id: uid,
          path: `spaces/${state.spaceId}/space_members/${uid}`,
        };
      },
      async get() {
        const docs = Object.entries(state.members).map(([id, data]) => ({
          id,
          exists: true,
          data: () => ({ ...data }),
        }));
        return { docs, size: docs.length };
      },
    };
  }

  const db = {
    state,
    writes,
    collection(name) {
      if (name !== 'spaces') throw new Error(`unexpected collection ${name}`);
      return {
        doc(spaceId) {
          return {
            id: spaceId,
            path: `spaces/${spaceId}`,
            collection(sub) {
              if (sub !== 'space_members') throw new Error(sub);
              return membersCol();
            },
          };
        },
      };
    },
    async runTransaction(fn) {
      const snapshotMembers = { ...state.members };
      const snapshotSpace = state.space ? { ...state.space } : null;
      const pending = [];
      const tx = {
        async get(ref) {
          if (!ref) return { exists: false, data: () => undefined };
          if (ref.path === `spaces/${state.spaceId}`) {
            return snapshotSpace
              ? { exists: true, data: () => ({ ...snapshotSpace }) }
              : { exists: false, data: () => undefined };
          }
          const memberMatch = typeof ref.path === 'string'
            ? ref.path.match(/^spaces\/[^/]+\/space_members\/([^/]+)$/)
            : null;
          if (memberMatch) {
            const uid = memberMatch[1];
            const data = snapshotMembers[uid];
            return data
              ? { exists: true, id: uid, data: () => ({ ...data }) }
              : { exists: false, id: uid, data: () => undefined };
          }
          if (ref.path === `spaces/${state.spaceId}/space_members` && typeof ref.get === 'function') {
            return ref.get();
          }
          if (typeof ref.get === 'function') return ref.get();
          return { exists: false, data: () => undefined };
        },
        delete(ref) {
          pending.push({ op: 'delete', path: ref.path });
        },
        update(ref, data) {
          pending.push({ op: 'update', path: ref.path, data });
        },
      };
      const result = await fn(tx);
      for (const write of pending) {
        if (write.op === 'delete') {
          const match = write.path.match(/space_members\/([^/]+)$/);
          if (match) delete state.members[match[1]];
        }
        if (write.op === 'update' && write.path === `spaces/${state.spaceId}`) {
          Object.assign(state.space, write.data);
        }
        writes.push(write);
      }
      return result;
    },
  };
  return db;
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

const twoMembers = {
  [OWNER]: { uid: OWNER, role: 'owner', joinedAt: 1 },
  [MEMBER]: { uid: MEMBER, role: 'member', joinedAt: 2 },
};

describe('space membership unit', () => {
  it('대상 UID 형식을 검사한다', () => {
    assert.strictEqual(parseTargetUid(' member-1 '), 'member-1');
    assert.throws(
      () => parseTargetUid(''),
      (error) => error instanceof HttpsError && error.code === 'invalid-argument',
    );
    assert.throws(
      () => parseTargetUid('a/b'),
      (error) => error instanceof HttpsError && error.code === 'invalid-argument',
    );
  });

  it('실제 멤버 수 기준으로 1을 빼고 0 미만으로 내리지 않는다', () => {
    assert.strictEqual(nextMemberCount(2), 1);
    assert.strictEqual(nextMemberCount(1), 0);
    assert.strictEqual(nextMemberCount(0), 0);
    assert.strictEqual(nextMemberCount(-4), 0);
  });

  it('일반 멤버 탈퇴에 성공하고 인원 수를 갱신한다', async () => {
    const db = makeDb({ space: activeSpace, members: twoMembers });
    const result = await leaveSpaceHandler({
      auth: registeredAuth(MEMBER),
      data: { spaceId: SPACE_ID, uid: OTHER },
      db,
    });
    assert.deepStrictEqual(result, { spaceId: SPACE_ID });
    assert.strictEqual(db.state.members[MEMBER], undefined);
    assert.ok(db.state.members[OWNER]);
    assert.strictEqual(db.state.space.memberCount, 1);
  });

  it('방장 탈퇴를 거부하고 문서를 바꾸지 않는다', async () => {
    const db = makeDb({ space: activeSpace, members: twoMembers });
    await assert.rejects(
      () => leaveSpaceHandler({ auth: registeredAuth(OWNER), data: { spaceId: SPACE_ID }, db }),
      (error) => error instanceof HttpsError && error.code === 'failed-precondition',
    );
    assert.ok(db.state.members[OWNER]);
    assert.strictEqual(db.state.space.memberCount, 2);
  });

  it('비회원·비로그인 탈퇴를 거부한다', async () => {
    const db = makeDb({ space: activeSpace, members: twoMembers });
    await assert.rejects(
      () => leaveSpaceHandler({ auth: null, data: { spaceId: SPACE_ID }, db }),
      (error) => error.code === 'unauthenticated',
    );
    await assert.rejects(
      () =>
        leaveSpaceHandler({
          auth: { uid: MEMBER, token: { firebase: { sign_in_provider: 'anonymous' } } },
          data: { spaceId: SPACE_ID },
          db,
        }),
      (error) => error.code === 'permission-denied',
    );
    assert.strictEqual(db.state.space.memberCount, 2);
  });

  it('요청 body의 UID로 타인 멤버십을 지우지 않는다', async () => {
    const db = makeDb({
      space: { ...activeSpace, data: { ...activeSpace.data, memberCount: 3 } },
      members: {
        ...twoMembers,
        [OTHER]: { uid: OTHER, role: 'member', joinedAt: 3 },
      },
    });
    await leaveSpaceHandler({
      auth: registeredAuth(MEMBER),
      data: { spaceId: SPACE_ID, uid: OTHER },
      db,
    });
    assert.strictEqual(db.state.members[MEMBER], undefined);
    assert.ok(db.state.members[OTHER]);
    assert.strictEqual(db.state.space.memberCount, 2);
  });

  it('방장이 일반 멤버를 내보낸다', async () => {
    const db = makeDb({ space: activeSpace, members: twoMembers });
    const result = await removeSpaceMemberHandler({
      auth: registeredAuth(OWNER),
      data: { spaceId: SPACE_ID, uid: MEMBER },
      db,
    });
    assert.deepStrictEqual(result, { spaceId: SPACE_ID, uid: MEMBER });
    assert.strictEqual(db.state.members[MEMBER], undefined);
    assert.ok(db.state.members[OWNER]);
    assert.strictEqual(db.state.space.memberCount, 1);
  });

  it('일반 멤버의 내보내기를 거부한다', async () => {
    const db = makeDb({
      space: { ...activeSpace, data: { ...activeSpace.data, memberCount: 3 } },
      members: {
        ...twoMembers,
        [OTHER]: { uid: OTHER, role: 'member', joinedAt: 3 },
      },
    });
    await assert.rejects(
      () =>
        removeSpaceMemberHandler({
          auth: registeredAuth(MEMBER),
          data: { spaceId: SPACE_ID, uid: OTHER },
          db,
        }),
      (error) => error.code === 'permission-denied',
    );
    assert.ok(db.state.members[OTHER]);
    assert.strictEqual(db.state.space.memberCount, 3);
  });

  it('방장 본인 내보내기를 거부한다', async () => {
    const db = makeDb({ space: activeSpace, members: twoMembers });
    await assert.rejects(
      () =>
        removeSpaceMemberHandler({
          auth: registeredAuth(OWNER),
          data: { spaceId: SPACE_ID, uid: OWNER },
          db,
        }),
      (error) => error.code === 'failed-precondition',
    );
    assert.ok(db.state.members[OWNER]);
    assert.strictEqual(db.state.space.memberCount, 2);
  });

  it('존재하지 않는 멤버 내보내기는 인원 수를 바꾸지 않는다', async () => {
    const db = makeDb({ space: activeSpace, members: twoMembers });
    await assert.rejects(
      () =>
        removeSpaceMemberHandler({
          auth: registeredAuth(OWNER),
          data: { spaceId: SPACE_ID, uid: 'ghost' },
          db,
        }),
      (error) => error.code === 'not-found',
    );
    assert.strictEqual(db.state.space.memberCount, 2);
  });

  it('중복 탈퇴는 인원 수를 두 번 줄이지 않는다', async () => {
    const db = makeDb({ space: activeSpace, members: twoMembers });
    await leaveSpaceHandler({ auth: registeredAuth(MEMBER), data: { spaceId: SPACE_ID }, db });
    await assert.rejects(
      () => leaveSpaceHandler({ auth: registeredAuth(MEMBER), data: { spaceId: SPACE_ID }, db }),
      (error) => error.code === 'failed-precondition',
    );
    assert.strictEqual(db.state.space.memberCount, 1);
    assert.strictEqual(Object.keys(db.state.members).length, 1);
  });

  it('저장된 인원 수가 실제보다 작아도 음수가 되지 않고 실제 남은 인원으로 맞춘다', async () => {
    const db = makeDb({
      space: { ...activeSpace, data: { ...activeSpace.data, memberCount: 0 } },
      members: twoMembers,
    });
    await leaveSpaceHandler({ auth: registeredAuth(MEMBER), data: { spaceId: SPACE_ID }, db });
    assert.strictEqual(db.state.space.memberCount, 1);
    assert.strictEqual(db.state.members[MEMBER], undefined);
    assert.ok(db.state.members[OWNER]);
  });

  it('저장된 인원 수가 실제보다 커도 이번 공간만 실제 남은 인원으로 맞춘다', async () => {
    const db = makeDb({
      space: { ...activeSpace, data: { ...activeSpace.data, memberCount: 5 } },
      members: twoMembers,
    });
    await leaveSpaceHandler({ auth: registeredAuth(MEMBER), data: { spaceId: SPACE_ID }, db });
    assert.strictEqual(db.state.space.memberCount, 1);
    assert.strictEqual(Object.keys(db.state.members).length, 1);
  });

  it('memberCount가 없으면 실제 멤버 수로 갱신한다', async () => {
    const { memberCount, ...rest } = activeSpace.data;
    const db = makeDb({
      space: { id: SPACE_ID, data: rest },
      members: twoMembers,
    });
    assert.strictEqual(db.state.space.memberCount, undefined);
    await leaveSpaceHandler({ auth: registeredAuth(MEMBER), data: { spaceId: SPACE_ID }, db });
    assert.strictEqual(db.state.space.memberCount, 1);
  });
});
