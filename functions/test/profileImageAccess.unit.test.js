const assert = require('assert');
const {
  PROFILE_ACCESS_TTL_MS,
  parseProfileImageKey,
  signProfileAccess,
  verifyProfileAccess,
  profileImageUrlForKey,
} = require('../profileImageAccess');

const PEPPER = 'unit-profile-pepper';
const NOW = 1_700_000_000_000;

describe('profile image access', () => {
  it('프로필 키만 허용하고 소비 사진 키는 거부한다', () => {
    assert.deepStrictEqual(
      parseProfileImageKey('users/u1/profile/avatar_abc.jpg', 'u1'),
      { uid: 'u1', fileName: 'avatar_abc.jpg', key: 'users/u1/profile/avatar_abc.jpg' },
    );
    assert.strictEqual(parseProfileImageKey('users/u1/expenses/exp1.jpg', 'u1'), null);
    assert.strictEqual(parseProfileImageKey('users/other/profile/avatar_abc.jpg', 'u1'), null);
  });

  it('짧은 접근 토큰을 만들고 만료되면 거부한다', () => {
    const token = signProfileAccess('u1', 'avatar_abc.jpg', PEPPER, NOW);
    assert.strictEqual(verifyProfileAccess('u1', 'avatar_abc.jpg', token, PEPPER, NOW + 1), true);
    assert.strictEqual(verifyProfileAccess('u2', 'avatar_abc.jpg', token, PEPPER, NOW + 1), false);
    assert.strictEqual(verifyProfileAccess('u1', 'other.jpg', token, PEPPER, NOW + 1), false);
    assert.strictEqual(
      verifyProfileAccess('u1', 'avatar_abc.jpg', token, PEPPER, NOW + PROFILE_ACCESS_TTL_MS + 1),
      false,
    );
  });

  it('토큰 검증은 공간 멤버십을 보지 않으므로 탈퇴 후에도 만료 전까지 유효하다', () => {
    const token = signProfileAccess('left-user', 'avatar_abc.jpg', PEPPER, NOW);
    assert.strictEqual(
      verifyProfileAccess('left-user', 'avatar_abc.jpg', token, PEPPER, NOW + 60 * 1000),
      true,
    );
    assert.strictEqual(
      verifyProfileAccess('left-user', 'avatar_abc.jpg', '1700000000000.deadbeef', PEPPER, NOW + 1),
      false,
    );
  });

  it('멤버용 URL은 키를 포함하지 않고 쿼리 토큰만 붙인다', () => {
    const url = profileImageUrlForKey(
      'users/u1/profile/avatar_abc.jpg',
      'u1',
      { pepper: PEPPER, baseUrl: 'https://img.example' },
      NOW,
    );
    assert.ok(url.startsWith('https://img.example/v1/profiles/u1/avatar_abc.jpg?access='));
    assert.equal(url.includes('users/u1/profile'), false);
    assert.strictEqual(
      profileImageUrlForKey('users/u1/expenses/exp1.jpg', 'u1', { pepper: PEPPER }, NOW),
      null,
    );
  });
});
