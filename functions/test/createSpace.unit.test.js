const assert = require('assert');
const { HttpsError } = require('firebase-functions/v2/https');
const {
  SPACE_NAME_MAX,
  parseSpaceName,
  parseSpaceType,
  requireRegisteredAuth,
  createSpaceHandler,
} = require('../createSpace');

function expectHttpsError(fn, code) {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof HttpsError, 'HttpsError여야 합니다');
    assert.strictEqual(error.code, code);
    return;
  }
  assert.fail('오류가 발생해야 합니다');
}

describe('createSpace validation', () => {
  it('정상 이름을 다듬는다', () => {
    assert.strictEqual(parseSpaceName('  우리집  '), '우리집');
  });

  it('빈 이름·공백만 있는 이름을 거부한다', () => {
    expectHttpsError(() => parseSpaceName(''), 'invalid-argument');
    expectHttpsError(() => parseSpaceName('   '), 'invalid-argument');
    expectHttpsError(() => parseSpaceName(null), 'invalid-argument');
  });

  it('길이 초과 이름을 거부한다', () => {
    expectHttpsError(() => parseSpaceName('가'.repeat(SPACE_NAME_MAX + 1)), 'invalid-argument');
    assert.strictEqual(parseSpaceName('가'.repeat(SPACE_NAME_MAX)), '가'.repeat(SPACE_NAME_MAX));
  });

  it('정상 유형만 허용한다', () => {
    assert.strictEqual(parseSpaceType('couple'), 'couple');
    assert.strictEqual(parseSpaceType('friends'), 'friends');
    assert.strictEqual(parseSpaceType('family'), 'family');
    assert.strictEqual(parseSpaceType('travel'), 'travel');
    expectHttpsError(() => parseSpaceType(undefined), 'invalid-argument');
    expectHttpsError(() => parseSpaceType('work'), 'invalid-argument');
  });

  it('클라이언트 ownerUid를 사용하지 않는다', () => {
    const uid = requireRegisteredAuth({
      uid: 'server-uid',
      token: { firebase: { sign_in_provider: 'password' } },
    });
    assert.strictEqual(uid, 'server-uid');
  });

  it('비로그인·익명을 거부한다', () => {
    expectHttpsError(() => requireRegisteredAuth(null), 'unauthenticated');
    expectHttpsError(() => requireRegisteredAuth({ uid: '' }), 'unauthenticated');
    expectHttpsError(
      () =>
        requireRegisteredAuth({
          uid: 'anon-1',
          token: { firebase: { sign_in_provider: 'anonymous' } },
        }),
      'permission-denied',
    );
    expectHttpsError(
      () => requireRegisteredAuth({ uid: 'user-1', token: {} }),
      'permission-denied',
    );
  });

  it('트랜잭션 실패는 부분 커밋 없이 internal 오류로 변환한다', async () => {
    const originalError = console.error;
    console.error = () => {};
    const db = {
      collection() {
        return {
          doc() {
            return {
              id: 'space-x',
              collection() {
                return { doc() { return {}; } };
              },
            };
          },
        };
      },
      async runTransaction() {
        throw new Error('commit failed');
      },
    };
    try {
      await assert.rejects(
        () =>
          createSpaceHandler({
            auth: {
              uid: 'u1',
              token: { firebase: { sign_in_provider: 'password' } },
            },
            data: { name: '모임', type: 'couple' },
            db,
          }),
        (error) => error instanceof HttpsError && error.code === 'internal',
      );
    } finally {
      console.error = originalError;
    }
  });

  it('정상 이름과 유형으로 생성하고 위조 ownerUid는 무시한다', async () => {
    const writes = [];
    const db = {
      collection() {
        return {
          doc() {
            return {
              id: 'space-ok',
              collection() {
                return { doc() { return {}; } };
              },
            };
          },
        };
      },
      async runTransaction(fn) {
        await fn({
          set(_ref, data) {
            writes.push(data);
          },
        });
      },
    };
    const result = await createSpaceHandler({
      auth: {
        uid: 'u1',
        token: { firebase: { sign_in_provider: 'password' } },
      },
      data: { name: ' 우리들 ', type: 'travel', ownerUid: 'forged' },
      db,
    });
    assert.deepStrictEqual(result, { spaceId: 'space-ok' });
    assert.strictEqual(writes[0].name, '우리들');
    assert.strictEqual(writes[0].type, 'travel');
    assert.strictEqual(writes[0].ownerUid, 'u1');
    assert.strictEqual(writes[0].memberCount, 1);
    assert.strictEqual(writes[1].role, 'owner');
  });

  it('유형 누락·허용되지 않은 유형은 거부한다', async () => {
    const db = { runTransaction() { throw new Error('should not run'); } };
    await assert.rejects(
      () =>
        createSpaceHandler({
          auth: {
            uid: 'u1',
            token: { firebase: { sign_in_provider: 'password' } },
          },
          data: { name: '모임' },
          db,
        }),
      (error) => error instanceof HttpsError && error.code === 'invalid-argument',
    );
    await assert.rejects(
      () =>
        createSpaceHandler({
          auth: {
            uid: 'u1',
            token: { firebase: { sign_in_provider: 'password' } },
          },
          data: { name: '모임', type: 'office' },
          db,
        }),
      (error) => error instanceof HttpsError && error.code === 'invalid-argument',
    );
  });
});
