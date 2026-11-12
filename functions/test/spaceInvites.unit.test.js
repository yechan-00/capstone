const assert = require('assert');
const { HttpsError } = require('firebase-functions/v2/https');
const {
  INVITE_TTL_MS,
  INVITE_CODE_LENGTH,
  INVITE_ALPHABET,
  INVITE_FAIL_LIMIT,
  INVITE_FAIL_WINDOW_MS,
  normalizeInviteCode,
  hashInviteCode,
  generateInviteCode,
  parseInviteCode,
  buildLookupRecord,
  buildPrivateRecord,
  isLookupInviteValid,
  isInviteCurrentlyValid,
  getPepper,
  createSpaceInviteHandler,
  getSpaceInviteHandler,
  previewSpaceInviteHandler,
  joinSpaceByInviteHandler,
} = require('../spaceInvites');

const PEPPER = 'unit-test-pepper';

describe('space invite policy', () => {
  it('유효기간은 2시간이다', () => {
    assert.strictEqual(INVITE_TTL_MS, 2 * 60 * 60 * 1000);
  });

  it('8자리 대문자·숫자이며 혼동 문자를 쓰지 않는다', () => {
    for (let i = 0; i < 40; i += 1) {
      const code = generateInviteCode();
      assert.strictEqual(code.length, INVITE_CODE_LENGTH);
      assert.match(code, new RegExp(`^[${INVITE_ALPHABET}]{${INVITE_CODE_LENGTH}}$`));
      assert.doesNotMatch(code, /[01IOL]/);
    }
  });

  it('코드를 정규화하고 HMAC으로 해시한 값은 결정적이다', () => {
    const a = hashInviteCode('ab cd-ef', PEPPER);
    const b = hashInviteCode('AB CD-EF', PEPPER);
    assert.strictEqual(normalizeInviteCode('ab cd-ef'), 'ABCDEF');
    assert.strictEqual(a, b);
    assert.notStrictEqual(hashInviteCode('AAAAAAAA', PEPPER), hashInviteCode('BBBBBBBB', PEPPER));
  });

  it('검증용 레코드에는 원문 코드가 없다', () => {
    const lookup = buildLookupRecord({
      spaceId: 'space-1',
      codeHash: 'abc',
      createdByUid: 'owner',
      createdAt: 1,
      expiresAt: 1 + INVITE_TTL_MS,
    });
    assert.strictEqual(Object.prototype.hasOwnProperty.call(lookup, 'code'), false);
    assert.strictEqual(lookup.code, undefined);
    assert.strictEqual(lookup.status, 'active');
    assert.strictEqual(lookup.expiresAt - lookup.createdAt, INVITE_TTL_MS);
  });

  it('원문 코드는 private 레코드에만 들어간다', () => {
    const priv = buildPrivateRecord({
      inviteId: 'abc',
      code: 'ABCD2345',
      createdByUid: 'owner',
      createdAt: 1,
      expiresAt: 1 + INVITE_TTL_MS,
    });
    assert.strictEqual(priv.code, 'ABCD2345');
    assert.strictEqual(priv.expiresAt - priv.createdAt, INVITE_TTL_MS);
  });

  it('만료 직전까지 유효하고 만료 시각부터 무효다', () => {
    const created = 1_000_000;
    const expires = created + INVITE_TTL_MS;
    const lookup = { status: 'active', expiresAt: { toMillis: () => expires }, codeHash: 'h' };
    const priv = { status: 'active', code: 'ABCD2345', inviteId: 'h', expiresAt: { toMillis: () => expires } };
    assert.strictEqual(isInviteCurrentlyValid(lookup, priv, expires - 1), true);
    assert.strictEqual(isInviteCurrentlyValid(lookup, priv, expires), false);
    assert.strictEqual(isInviteCurrentlyValid({ ...lookup, status: 'revoked' }, priv, expires - 1), false);
  });

  it('비로그인·익명 발급을 거부한다', async () => {
    const db = { runTransaction() { throw new Error('should not run'); } };
    await assert.rejects(
      () => createSpaceInviteHandler({ auth: null, data: { spaceId: 's1' }, db, pepper: PEPPER }),
      (error) => error instanceof HttpsError && error.code === 'unauthenticated',
    );
    await assert.rejects(
      () =>
        getSpaceInviteHandler({
          auth: { uid: 'anon', token: { firebase: { sign_in_provider: 'anonymous' } } },
          data: { spaceId: 's1' },
          db,
          pepper: PEPPER,
        }),
      (error) => error instanceof HttpsError && error.code === 'permission-denied',
    );
  });

  it('잘못된 공간 ID를 거부한다', async () => {
    const db = { runTransaction() { throw new Error('should not run'); } };
    const auth = { uid: 'u1', token: { firebase: { sign_in_provider: 'password' } } };
    await assert.rejects(
      () => createSpaceInviteHandler({ auth, data: { spaceId: '' }, db, pepper: PEPPER }),
      (error) => error instanceof HttpsError && error.code === 'invalid-argument',
    );
    await assert.rejects(
      () => createSpaceInviteHandler({ auth, data: { spaceId: 'a/b' }, db, pepper: PEPPER }),
      (error) => error instanceof HttpsError && error.code === 'invalid-argument',
    );
  });

  it('운영에서 INVITE_PEPPER가 없거나 비어 있으면 안전하게 실패한다', () => {
    const previous = {
      pepper: process.env.INVITE_PEPPER,
      emulator: process.env.FUNCTIONS_EMULATOR,
    };
    try {
      delete process.env.INVITE_PEPPER;
      delete process.env.FUNCTIONS_EMULATOR;
      assert.throws(
        () => getPepper({}),
        (error) => error instanceof HttpsError && error.code === 'internal',
      );
      process.env.INVITE_PEPPER = '';
      assert.throws(
        () => getPepper({}),
        (error) => error instanceof HttpsError && error.code === 'internal',
      );
    } finally {
      if (previous.pepper === undefined) delete process.env.INVITE_PEPPER;
      else process.env.INVITE_PEPPER = previous.pepper;
      if (previous.emulator === undefined) delete process.env.FUNCTIONS_EMULATOR;
      else process.env.FUNCTIONS_EMULATOR = previous.emulator;
    }
  });

  it('에뮬레이터 폴백 키는 FUNCTIONS_EMULATOR가 true일 때만 쓰고 운영에서는 쓰지 않는다', () => {
    const previous = {
      pepper: process.env.INVITE_PEPPER,
      emulator: process.env.FUNCTIONS_EMULATOR,
    };
    try {
      delete process.env.INVITE_PEPPER;
      process.env.FUNCTIONS_EMULATOR = 'true';
      const emulatorPepper = getPepper({});
      assert.strictEqual(typeof emulatorPepper, 'string');
      assert.ok(emulatorPepper.length > 0);

      delete process.env.FUNCTIONS_EMULATOR;
      assert.throws(
        () => getPepper({}),
        (error) => error instanceof HttpsError && error.code === 'internal',
      );
    } finally {
      if (previous.pepper === undefined) delete process.env.INVITE_PEPPER;
      else process.env.INVITE_PEPPER = previous.pepper;
      if (previous.emulator === undefined) delete process.env.FUNCTIONS_EMULATOR;
      else process.env.FUNCTIONS_EMULATOR = previous.emulator;
    }
  });
});

const OWNER = 'owner-1';
const JOINER = 'joiner-1';
const SPACE_ID = 'space-1';
const VALID_CODE = 'ABCD2345';

function registeredAuth(uid) {
  return { uid, token: { firebase: { sign_in_provider: 'password' } } };
}

function lookupDoc(overrides = {}) {
  return {
    spaceId: SPACE_ID,
    codeHash: hashInviteCode(VALID_CODE, PEPPER),
    createdByUid: OWNER,
    status: 'active',
    revokedAt: null,
    expiresAt: { toMillis: () => 1_000_000 + INVITE_TTL_MS },
    ...overrides,
  };
}

function makePreviewDb({ invite, space, members = {}, attempts = {} }) {
  return {
    collection(name) {
      if (name === 'invite_attempts') {
        return {
          doc(uid) {
            return { id: uid, path: `invite_attempts/${uid}` };
          },
        };
      }
      if (name === 'space_invites') {
        return {
          doc(id) {
            return {
              async get() {
                return invite && invite.id === id
                  ? { exists: true, data: () => invite.data }
                  : { exists: false, data: () => undefined };
              },
            };
          },
        };
      }
      if (name === 'spaces') {
        return {
          doc(spaceId) {
            return {
              id: spaceId,
              path: `spaces/${spaceId}`,
              async get() {
                return space && space.id === spaceId
                  ? { exists: true, data: () => space.data }
                  : { exists: false, data: () => undefined };
              },
              collection(sub) {
                if (sub !== 'space_members') return { doc() { return { async get() { return { exists: false }; } }; } };
                const col = members[spaceId] || {};
                return {
                  doc(uid) {
                    return {
                      id: uid,
                      path: `spaces/${spaceId}/space_members/${uid}`,
                      async get() {
                        return col[uid]
                          ? { exists: true, data: () => col[uid] }
                          : { exists: false, data: () => undefined };
                      },
                    };
                  },
                  async get() {
                    const docs = Object.keys(col);
                    return { size: docs.length, docs };
                  },
                };
              },
            };
          },
        };
      }
      throw new Error(`unexpected collection ${name}`);
    },
    async runTransaction(fn) {
      return fn({
        async get(ref) {
          if (ref.path && ref.path.startsWith('invite_attempts/')) {
            const data = attempts[ref.id];
            return data
              ? { exists: true, data: () => ({ ...data }) }
              : { exists: false, data: () => undefined };
          }
          if (ref && typeof ref.get === 'function') return ref.get();
          return { exists: false, data: () => undefined };
        },
        set(ref, data) {
          if (ref.path && ref.path.startsWith('invite_attempts/')) {
            attempts[ref.id] = { ...data };
          }
        },
        update(ref, data) {
          if (ref.path && ref.path.startsWith('invite_attempts/')) {
            attempts[ref.id] = { ...attempts[ref.id], ...data };
          }
        },
      });
    },
  };
}

describe('previewSpaceInvite / joinSpaceByInvite unit', () => {
  const now = 1_000_000;
  const inviteId = hashInviteCode(VALID_CODE, PEPPER);
  const activeSpace = {
    id: SPACE_ID,
    data: {
      name: '주말 모임',
      type: 'friends',
      ownerUid: OWNER,
      status: 'active',
      maxMembers: 20,
      memberCount: 1,
    },
  };
  const activeInvite = { id: inviteId, data: lookupDoc() };

  it('실패 제한은 UID당 1시간에 20회다', () => {
    assert.strictEqual(INVITE_FAIL_LIMIT, 20);
    assert.strictEqual(INVITE_FAIL_WINDOW_MS, 60 * 60 * 1000);
  });

  it('초대 코드를 정규화하고 형식을 검사한다', () => {
    assert.strictEqual(parseInviteCode('ab cd-2345'), 'ABCD2345');
    assert.throws(
      () => parseInviteCode('SHORT'),
      (error) => error instanceof HttpsError && error.code === 'invalid-argument',
    );
    assert.throws(
      () => parseInviteCode('ABCD23I0'),
      (error) => error instanceof HttpsError && error.code === 'invalid-argument',
    );
  });

  it('lookup 문서는 만료 직전까지 유효하고 만료 시각부터 무효다', () => {
    const expires = now + INVITE_TTL_MS;
    const lookup = lookupDoc({ expiresAt: { toMillis: () => expires } });
    assert.strictEqual(isLookupInviteValid(lookup, expires - 1), true);
    assert.strictEqual(isLookupInviteValid(lookup, expires), false);
    assert.strictEqual(isLookupInviteValid({ ...lookup, status: 'revoked' }, expires - 1), false);
    assert.strictEqual(
      isLookupInviteValid({ ...lookup, revokedAt: { toMillis: () => now } }, expires - 1),
      false,
    );
  });

  it('비회원·익명 preview/join을 거부하고 조회하지 않는다', async () => {
    const db = { runTransaction() { throw new Error('should not run'); } };
    await assert.rejects(
      () => previewSpaceInviteHandler({ auth: null, data: { code: VALID_CODE }, db, pepper: PEPPER }),
      (error) => error instanceof HttpsError && error.code === 'unauthenticated',
    );
    await assert.rejects(
      () =>
        joinSpaceByInviteHandler({
          auth: { uid: 'anon', token: { firebase: { sign_in_provider: 'anonymous' } } },
          data: { code: VALID_CODE },
          db,
          pepper: PEPPER,
        }),
      (error) => error instanceof HttpsError && error.code === 'permission-denied',
    );
  });

  it('정상 코드를 미리보고 개인정보를 넣지 않는다', async () => {
    const db = makePreviewDb({
      invite: activeInvite,
      space: activeSpace,
      members: { [SPACE_ID]: { [OWNER]: { uid: OWNER, role: 'owner' } } },
    });
    const preview = await previewSpaceInviteHandler({
      auth: registeredAuth(JOINER),
      data: { code: ' abcd-2345 ' },
      db,
      pepper: PEPPER,
      nowMs: now,
    });
    assert.deepStrictEqual(preview, {
      name: '주말 모임',
      type: 'friends',
      canJoin: true,
      reason: 'ok',
    });
    assert.deepStrictEqual(Object.keys(preview).sort(), ['canJoin', 'name', 'reason', 'type']);
    const serialized = JSON.stringify(preview);
    assert.strictEqual(serialized.includes(OWNER), false);
    assert.strictEqual(serialized.includes(VALID_CODE), false);
    assert.strictEqual(serialized.includes(inviteId), false);
    assert.strictEqual(preview.ownerUid, undefined);
    assert.strictEqual(preview.spaceId, undefined);
    assert.strictEqual(preview.code, undefined);
  });

  it('잘못된 코드를 거부한다', async () => {
    const db = makePreviewDb({ invite: activeInvite, space: activeSpace });
    await assert.rejects(
      () =>
        previewSpaceInviteHandler({
          auth: registeredAuth(JOINER),
          data: { code: 'ZZZZZZZZ' },
          db,
          pepper: PEPPER,
          nowMs: now,
        }),
      (error) => error instanceof HttpsError && error.code === 'not-found',
    );
    await assert.rejects(
      () =>
        previewSpaceInviteHandler({
          auth: registeredAuth(JOINER),
          data: { code: 'bad' },
          db,
          pepper: PEPPER,
          nowMs: now,
        }),
      (error) => error instanceof HttpsError && error.code === 'invalid-argument',
    );
  });

  it('만료된 코드와 취소된 코드를 거부한다', async () => {
    const expiredDb = makePreviewDb({
      invite: { id: inviteId, data: lookupDoc({ expiresAt: { toMillis: () => now } }) },
      space: activeSpace,
    });
    await assert.rejects(
      () =>
        previewSpaceInviteHandler({
          auth: registeredAuth(JOINER),
          data: { code: VALID_CODE },
          db: expiredDb,
          pepper: PEPPER,
          nowMs: now,
        }),
      (error) => error instanceof HttpsError && error.code === 'not-found',
    );

    const revokedDb = makePreviewDb({
      invite: { id: inviteId, data: lookupDoc({ status: 'revoked', revokedAt: { toMillis: () => now } }) },
      space: activeSpace,
    });
    await assert.rejects(
      () =>
        previewSpaceInviteHandler({
          auth: registeredAuth(JOINER),
          data: { code: VALID_CODE },
          db: revokedDb,
          pepper: PEPPER,
          nowMs: now,
        }),
      (error) => error instanceof HttpsError && error.code === 'not-found',
    );
  });

  it('비활성 공간을 거부한다', async () => {
    const db = makePreviewDb({
      invite: activeInvite,
      space: { id: SPACE_ID, data: { ...activeSpace.data, status: 'inactive' } },
    });
    await assert.rejects(
      () =>
        previewSpaceInviteHandler({
          auth: registeredAuth(JOINER),
          data: { code: VALID_CODE },
          db,
          pepper: PEPPER,
          nowMs: now,
        }),
      (error) => error instanceof HttpsError && error.code === 'failed-precondition',
    );
  });

  it('이미 멤버인 사용자와 정원 초과를 구분한다', async () => {
    const memberDb = makePreviewDb({
      invite: activeInvite,
      space: activeSpace,
      members: {
        [SPACE_ID]: {
          [OWNER]: { uid: OWNER, role: 'owner' },
          [JOINER]: { uid: JOINER, role: 'member' },
        },
      },
    });
    const already = await previewSpaceInviteHandler({
      auth: registeredAuth(JOINER),
      data: { code: VALID_CODE },
      db: memberDb,
      pepper: PEPPER,
      nowMs: now,
    });
    assert.deepStrictEqual(already, {
      name: '주말 모임',
      type: 'friends',
      canJoin: false,
      reason: 'already-member',
    });

    const fullMembers = { [OWNER]: { uid: OWNER, role: 'owner' } };
    for (let i = 1; i < 20; i += 1) {
      fullMembers[`filler-${i}`] = { uid: `filler-${i}`, role: 'member' };
    }
    const fullDb = makePreviewDb({
      invite: activeInvite,
      space: { id: SPACE_ID, data: { ...activeSpace.data, memberCount: 20 } },
      members: { [SPACE_ID]: fullMembers },
    });
    const full = await previewSpaceInviteHandler({
      auth: registeredAuth(JOINER),
      data: { code: VALID_CODE },
      db: fullDb,
      pepper: PEPPER,
      nowMs: now,
    });
    assert.deepStrictEqual(full, {
      name: '주말 모임',
      type: 'friends',
      canJoin: false,
      reason: 'full',
    });

    const inflatedDb = makePreviewDb({
      invite: activeInvite,
      space: { id: SPACE_ID, data: { ...activeSpace.data, memberCount: 20 } },
      members: { [SPACE_ID]: { [OWNER]: { uid: OWNER, role: 'owner' } } },
    });
    const inflated = await previewSpaceInviteHandler({
      auth: registeredAuth(JOINER),
      data: { code: VALID_CODE },
      db: inflatedDb,
      pepper: PEPPER,
      nowMs: now,
    });
    assert.strictEqual(inflated.reason, 'ok');
    assert.strictEqual(inflated.canJoin, true);
  });

  it('유효기간 경계값에서 preview와 join을 거부한다', async () => {
    const expires = now + INVITE_TTL_MS;
    const boundaryDb = makePreviewDb({
      invite: { id: inviteId, data: lookupDoc({ expiresAt: { toMillis: () => expires } }) },
      space: activeSpace,
      members: { [SPACE_ID]: { [OWNER]: { uid: OWNER, role: 'owner' } } },
    });
    const before = await previewSpaceInviteHandler({
      auth: registeredAuth(JOINER),
      data: { code: VALID_CODE },
      db: boundaryDb,
      pepper: PEPPER,
      nowMs: expires - 1,
    });
    assert.strictEqual(before.reason, 'ok');
    await assert.rejects(
      () =>
        previewSpaceInviteHandler({
          auth: registeredAuth(JOINER),
          data: { code: VALID_CODE },
          db: boundaryDb,
          pepper: PEPPER,
          nowMs: expires,
        }),
      (error) => error instanceof HttpsError && error.code === 'not-found',
    );
    await assert.rejects(
      () =>
        joinSpaceByInviteHandler({
          auth: registeredAuth(JOINER),
          data: { code: VALID_CODE },
          db: boundaryDb,
          pepper: PEPPER,
          nowMs: expires,
        }),
      (error) => error instanceof HttpsError && error.code === 'not-found',
    );
  });
});
