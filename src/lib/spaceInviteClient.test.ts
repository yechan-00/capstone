import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SpaceInviteError,
  buildInviteShareMessage,
  formatInviteCountdown,
  isInviteCode,
  isInviteExpired,
  isSpaceOwner,
  normalizeInviteCode,
  parseJoinSpaceResult,
  parseRevokeResult,
  parseSpaceInvitePreview,
  parseSpaceInviteResult,
  sanitizeInviteCodeInput,
  toSpaceInviteError,
  toSpaceJoinError,
  buildInviteAppLink,
  buildJoinSpaceHref,
  hrefAfterAuth,
  inviteCodeFromLink,
  inviteCodeFromRouteParam,
  stashJoinCodeForAuth,
} from './spaceInviteClient.ts';

test('normalizeInviteCode trims and uppercases', () => {
  assert.equal(normalizeInviteCode(' ab-cd 23 '), 'ABCD23');
});

test('isInviteCode accepts 8-char alphabet only', () => {
  assert.equal(isInviteCode('23456789'), true);
  assert.equal(isInviteCode('ABCDEFGH'), true);
  assert.equal(isInviteCode('abcdefgh'), true);
  assert.equal(isInviteCode('ABCD1234'), false);
  assert.equal(isInviteCode('ABCDE'), false);
  assert.equal(isInviteCode('IIIIIIII'), false);
});

test('parseSpaceInviteResult requires code and ISO expiresAt', () => {
  const expiresAt = '2026-11-05T10:00:00.000Z';
  const parsed = parseSpaceInviteResult({ code: '23456789', expiresAt });
  assert.ok(parsed);
  assert.equal(parsed.code, '23456789');
  assert.equal(parsed.expiresAt.toISOString(), expiresAt);

  assert.equal(parseSpaceInviteResult({ code: '23456789' }), null);
  assert.equal(parseSpaceInviteResult({ expiresAt }), null);
  assert.equal(parseSpaceInviteResult({ code: 'nope', expiresAt }), null);
  assert.equal(parseSpaceInviteResult(null), null);
});

test('parseRevokeResult requires revoked true', () => {
  assert.equal(parseRevokeResult({ revoked: true }), true);
  assert.equal(parseRevokeResult({ revoked: false }), false);
  assert.equal(parseRevokeResult({}), false);
});

test('formatInviteCountdown never goes negative', () => {
  const expiresAt = new Date('2026-11-05T01:00:00.000Z');
  assert.equal(formatInviteCountdown(expiresAt, Date.parse('2026-11-05T00:01:02.000Z')), '00:58:58');
  assert.equal(formatInviteCountdown(expiresAt, Date.parse('2026-11-05T03:00:00.000Z')), '00:00:00');
  assert.equal(isInviteExpired(expiresAt, Date.parse('2026-11-05T01:00:00.000Z')), true);
  assert.equal(isInviteExpired(expiresAt, Date.parse('2026-11-05T00:59:59.000Z')), false);
});

test('buildInviteShareMessage includes space name, app scheme link, and no store URL', () => {
  const message = buildInviteShareMessage({
    code: '23456789',
    expiresAt: new Date('2026-11-05T10:00:00+09:00'),
    spaceName: '우리들의 기록',
  });
  assert.match(message, /초대 코드: 23456789/);
  assert.match(message, /공간: 우리들의 기록/);
  assert.match(message, /regretwallet:\/\/spaces\/join\?code=23456789/);
  assert.match(message, /유효기간:/);
  assert.equal(message.includes('http'), false);
  assert.equal(message.includes('apps.apple.com'), false);
});

test('toSpaceInviteError maps known codes and hides unknown messages', () => {
  const mapped = toSpaceInviteError({ code: 'functions/permission-denied', message: 'SECRET' });
  assert.equal(mapped instanceof SpaceInviteError, true);
  assert.equal(mapped.code, 'permission-denied');
  assert.equal(mapped.userMessage, '공간 소유자만 초대 코드를 다룰 수 있어요.');
  assert.equal(mapped.userMessage.includes('SECRET'), false);

  const network = toSpaceInviteError(new Error('failed to fetch'));
  assert.equal(network.code, 'unavailable');
  assert.equal(network.userMessage, '네트워크 연결을 확인한 뒤 다시 시도해 주세요.');
});

test('sanitizeInviteCodeInput uppercases, strips junk, and caps at 8', () => {
  assert.equal(sanitizeInviteCodeInput(' ab-cd 23 '), 'ABCD23');
  assert.equal(sanitizeInviteCodeInput('abcdefgh'), 'ABCDEFGH');
  assert.equal(sanitizeInviteCodeInput('abcdefghi'), 'ABCDEFGH');
  assert.equal(sanitizeInviteCodeInput('I0O1ABCD'), 'ABCD');
});

test('parseSpaceInvitePreview uses only server fields', () => {
  const parsed = parseSpaceInvitePreview({
    name: '주말 모임',
    type: 'friends',
    canJoin: true,
    reason: 'ok',
    memberCount: 99,
    spaceId: 'secret',
  });
  assert.ok(parsed);
  assert.deepEqual(parsed, {
    name: '주말 모임',
    type: 'friends',
    canJoin: true,
    reason: 'ok',
  });
  assert.equal(parseSpaceInvitePreview({ name: '', type: 'friends', canJoin: true, reason: 'ok' }), null);
  assert.equal(parseSpaceInvitePreview({ name: 'A', type: 'friends', canJoin: true, reason: 'full' }), null);
  assert.equal(parseSpaceInvitePreview({ name: 'A', canJoin: false, reason: 'already-member' })?.type, undefined);
});

test('parseJoinSpaceResult requires a usable spaceId', () => {
  assert.equal(parseJoinSpaceResult({ spaceId: 'abc' }), 'abc');
  assert.equal(parseJoinSpaceResult({ spaceId: ' a/b ' }), null);
  assert.equal(parseJoinSpaceResult({}), null);
});

test('toSpaceJoinError uses join copy and hides unknown messages', () => {
  const format = toSpaceJoinError({ code: 'functions/invalid-argument', message: 'PEPPER' });
  assert.equal(format.userMessage, '초대 코드 형식을 다시 확인해 주세요.');
  assert.equal(format.userMessage.includes('PEPPER'), false);

  const full = toSpaceJoinError({
    code: 'functions/failed-precondition',
    message: '이 공간은 참여 인원이 가득 찼어요.',
  });
  assert.equal(full.userMessage, '이 공간은 참여 인원이 가득 찼어요.');

  const secret = toSpaceJoinError({ code: 'functions/internal', message: 'stack dump' }, 'join');
  assert.equal(secret.userMessage, '공간에 참여하지 못했어요. 잠시 후 다시 시도해 주세요.');
});

test('invite routing prefills code without joining', () => {
  assert.deepEqual(buildJoinSpaceHref(), { pathname: '/spaces/join' });
  assert.deepEqual(buildJoinSpaceHref('ab-cd2345'), {
    pathname: '/spaces/join',
    params: { code: 'ABCD2345' },
  });
  assert.equal(inviteCodeFromRouteParam([' ab-cd2345 ']), 'ABCD2345');
  assert.equal(inviteCodeFromRouteParam('I0O1'), '');
  assert.equal(inviteCodeFromRouteParam('23456789'), '23456789');
  assert.equal(inviteCodeFromLink('regretwallet://spaces/join?code=23456789'), '23456789');
  assert.equal(inviteCodeFromLink('regretwallet://invite?code=abcd2345'), 'ABCD2345');
  assert.equal(inviteCodeFromLink('regretwallet://spaces/join'), '');
  assert.equal(buildInviteAppLink('23456789'), 'regretwallet://spaces/join?code=23456789');

  stashJoinCodeForAuth('23456789');
  assert.deepEqual(hrefAfterAuth(), {
    pathname: '/spaces/join',
    params: { code: '23456789' },
  });
  assert.equal(hrefAfterAuth(), '/(tabs)');
});

test('isSpaceOwner uses role and ownerUid', () => {
  assert.equal(isSpaceOwner('owner', 'u1', 'u1'), true);
  assert.equal(isSpaceOwner('member', 'u1', 'u2'), false);
  assert.equal(isSpaceOwner('member', 'u1', 'u1'), true);
  assert.equal(isSpaceOwner(undefined, 'u1', null), false);
});
