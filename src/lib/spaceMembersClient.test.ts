import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  DEFAULT_SPACE_MEMBER_DISPLAY_NAME,
  SpaceMembersError,
  classifySpaceMembersError,
  compareSpaceMembers,
  memberInitial,
  membersCountLabel,
  parseSpaceMember,
  parseSpaceMembersResult,
  shouldShowMembersSpinner,
  sortSpaceMembers,
  spaceMemberRoleLabel,
  toSpaceMembersError,
} from './spaceMembersClient.ts';

test('parses a valid member list and drops extra personal fields', () => {
  const parsed = parseSpaceMembersResult({
    members: [
      {
        uid: 'member-1',
        displayName: '멤버닉',
        role: 'member',
        joinedAt: '2026-01-02T00:00:00.000Z',
        email: 'hidden@example.com',
        phoneNumber: '010',
      },
      {
        uid: 'owner-1',
        displayName: '방장닉',
        role: 'owner',
        joinedAt: '2026-01-03T00:00:00.000Z',
      },
    ],
  });
  assert.ok(parsed);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].uid, 'owner-1');
  assert.equal(parsed[0].role, 'owner');
  assert.equal(spaceMemberRoleLabel(parsed[0].role), '방장');
  assert.equal(parsed[1].uid, 'member-1');
  assert.equal(spaceMemberRoleLabel(parsed[1].role), '멤버');
  assert.equal((parsed[1] as { email?: string }).email, undefined);
});

test('uses profileImageUrl for avatars and ignores firebase storage urls', () => {
  const withPhoto = parseSpaceMember({
    uid: 'u1',
    displayName: '닉',
    role: 'member',
    profileImageUrl: 'https://regret-wallet-images.regret-wallet-3db60.workers.dev/v1/profiles/u1/avatar_1.jpg?access=abc',
    email: 'hidden@example.com',
  });
  assert.equal(
    withPhoto?.photoURL,
    'https://regret-wallet-images.regret-wallet-3db60.workers.dev/v1/profiles/u1/avatar_1.jpg?access=abc',
  );
  assert.equal((withPhoto as { email?: string } | null)?.email, undefined);
  const blocked = parseSpaceMember({
    uid: 'u1',
    displayName: '닉',
    role: 'member',
    profileImageUrl: 'https://firebasestorage.googleapis.com/v0/b/x/o/y',
  });
  assert.equal(blocked?.photoURL, undefined);
});

test('treats empty members as a valid empty list', () => {
  assert.deepEqual(parseSpaceMembersResult({ members: [] }), []);
});

test('rejects malformed payloads', () => {
  assert.equal(parseSpaceMembersResult(null), null);
  assert.equal(parseSpaceMembersResult({}), null);
  assert.equal(parseSpaceMembersResult({ members: 'nope' }), null);
  assert.equal(parseSpaceMember({ displayName: 'A', role: 'owner' }), null);
  assert.equal(parseSpaceMember({ uid: 'a/b', displayName: 'A', role: 'owner' }), null);
});

test('fills a consistent default display name and default avatar initial', () => {
  const parsed = parseSpaceMember({
    uid: 'u1',
    displayName: '   ',
    role: 'member',
    joinedAt: null,
  });
  assert.ok(parsed);
  assert.equal(parsed.displayName, DEFAULT_SPACE_MEMBER_DISPLAY_NAME);
  assert.equal(memberInitial(parsed.displayName), '?');
  assert.equal(memberInitial('민수'), '민');
  assert.equal(parsePublicHttpsIgnored(), true);
});

function parsePublicHttpsIgnored() {
  const withStorage = parseSpaceMember({
    uid: 'u1',
    displayName: 'A',
    role: 'member',
    photoURL: 'https://firebasestorage.googleapis.com/v0/b/x/o/y',
  });
  assert.equal(withStorage?.photoURL, undefined);
  const https = parseSpaceMember({
    uid: 'u1',
    displayName: 'A',
    role: 'member',
    photoURL: 'https://lh3.googleusercontent.com/a',
  });
  assert.equal(https?.photoURL, 'https://lh3.googleusercontent.com/a');
  return true;
}

test('sorts owner first then joinedAt then uid', () => {
  const sorted = sortSpaceMembers([
    {
      uid: 'm2',
      displayName: 'B',
      role: 'member',
      joinedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
    {
      uid: 'owner-1',
      displayName: 'O',
      role: 'owner',
      joinedAt: new Date('2026-12-01T00:00:00.000Z'),
    },
    {
      uid: 'm1',
      displayName: 'A',
      role: 'member',
      joinedAt: new Date('2026-01-01T00:00:00.000Z'),
    },
  ]);
  assert.equal(sorted[0].role, 'owner');
  assert.equal(sorted[1].uid, 'm1');
  assert.equal(sorted[2].uid, 'm2');
  assert.ok(compareSpaceMembers(sorted[0], sorted[1]) < 0);
});

test('does not invent a member count while loading', () => {
  assert.equal(membersCountLabel(null), null);
  assert.equal(membersCountLabel(-1), null);
  assert.equal(membersCountLabel(0), '0명');
  assert.equal(membersCountLabel(3), '3명');
  assert.equal(shouldShowMembersSpinner('loading', false), true);
  assert.equal(shouldShowMembersSpinner('loading', true), false);
  assert.equal(shouldShowMembersSpinner('ready', false), false);
});

test('maps network and permission errors without leaking internals', () => {
  const network = toSpaceMembersError({ code: 'functions/unavailable', message: 'stack dump' });
  assert.equal(network.code, 'unavailable');
  assert.equal(network.userMessage.includes('stack'), false);
  assert.equal(classifySpaceMembersError(network), 'unavailable');

  const denied = toSpaceMembersError({
    code: 'functions/permission-denied',
    message: '이 공간의 멤버만 목록을 볼 수 있어요.',
  });
  assert.equal(denied.code, 'permission-denied');
  assert.equal(classifySpaceMembersError(denied), 'permission-denied');
  assert.equal(spaceMemberRoleLabel('owner'), '방장');
  assert.equal(spaceMemberRoleLabel('member'), '멤버');

  const inactive = toSpaceMembersError({ code: 'functions/failed-precondition' });
  assert.equal(classifySpaceMembersError(inactive), 'inactive');

  const format = parseSpaceMembersResult({ members: [{ uid: 'ok' }] });
  assert.ok(format);
  assert.equal(format[0].displayName, DEFAULT_SPACE_MEMBER_DISPLAY_NAME);

  const retryKind = classifySpaceMembersError(new SpaceMembersError('unavailable'));
  assert.equal(retryKind, 'unavailable');
});
