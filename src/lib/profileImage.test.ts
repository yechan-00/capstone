import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  NICKNAME_MAX,
  normalizeNickname,
  ownProfileImageUri,
  parseProfileImageKey,
} from './profileImage.ts';

test('normalizeNickname trims and caps at 24', () => {
  assert.equal(normalizeNickname('  민수  '), '민수');
  assert.equal(normalizeNickname('가'.repeat(NICKNAME_MAX + 3)), '가'.repeat(NICKNAME_MAX));
  assert.equal(normalizeNickname('   '), '');
});

test('parseProfileImageKey accepts only the owner profile path', () => {
  assert.deepEqual(
    parseProfileImageKey('users/u1/profile/avatar_abc.jpg', 'u1'),
    { uid: 'u1', fileName: 'avatar_abc.jpg', key: 'users/u1/profile/avatar_abc.jpg' },
  );
  assert.equal(parseProfileImageKey('users/u1/profile/avatar_abc.jpg', 'u2'), null);
  assert.equal(parseProfileImageKey('users/u1/expenses/exp1.jpg', 'u1'), null);
  assert.equal(parseProfileImageKey('users/u1/profile/../expenses/x.jpg', 'u1'), null);
  assert.equal(parseProfileImageKey('https://example.com/photo.jpg', 'u1'), null);
});

test('ownProfileImageUri builds a worker profile path without a stored signed url', () => {
  assert.equal(
    ownProfileImageUri('https://worker.example', 'u1', 'users/u1/profile/avatar_abc.jpg'),
    'https://worker.example/v1/profiles/u1/avatar_abc.jpg',
  );
  assert.equal(ownProfileImageUri('https://worker.example', 'u1', 'users/u2/profile/avatar_abc.jpg'), null);
  assert.equal(ownProfileImageUri(null, 'u1', 'users/u1/profile/avatar_abc.jpg'), null);
});
