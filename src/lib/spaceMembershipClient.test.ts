import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  LEAVE_CONFIRM_MESSAGE,
  REMOVE_CONFIRM_MESSAGE,
  SpaceMembershipError,
  canShowLeaveSpace,
  canShowRemoveMember,
  createActionGate,
  isAlreadyLeftError,
  isAlreadyRemovedError,
  parseLeaveSpaceResult,
  parseRemoveSpaceMemberResult,
  toSpaceMembershipError,
} from './spaceMembershipClient.ts';

test('탈퇴 버튼은 일반 멤버에게만 보인다', () => {
  assert.equal(canShowLeaveSpace('member', 'owner-1', 'member-1'), true);
  assert.equal(canShowLeaveSpace('owner', 'owner-1', 'owner-1'), false);
  assert.equal(canShowLeaveSpace('member', 'owner-1', 'owner-1'), false);
  assert.equal(canShowLeaveSpace(undefined, 'owner-1', 'owner-1'), false);
  assert.equal(canShowLeaveSpace('member', 'owner-1', null), false);
});

test('내보내기 버튼은 방장이 다른 일반 멤버를 볼 때만 보인다', () => {
  const member = { uid: 'member-1', role: 'member' as const };
  const owner = { uid: 'owner-1', role: 'owner' as const };
  assert.equal(
    canShowRemoveMember({ viewerIsOwner: true, viewerUid: 'owner-1', member }),
    true,
  );
  assert.equal(
    canShowRemoveMember({ viewerIsOwner: true, viewerUid: 'owner-1', member: owner }),
    false,
  );
  assert.equal(
    canShowRemoveMember({ viewerIsOwner: true, viewerUid: 'owner-1', member: { uid: 'owner-1', role: 'member' } }),
    false,
  );
  assert.equal(
    canShowRemoveMember({ viewerIsOwner: false, viewerUid: 'member-2', member }),
    false,
  );
  assert.equal(
    canShowRemoveMember({ viewerIsOwner: true, viewerUid: null, member }),
    false,
  );
});

test('확인 안내는 개인 소비 삭제 없이 접근 차단을 설명한다', () => {
  assert.match(LEAVE_CONFIRM_MESSAGE, /공간에서 나가게 됩니다/);
  assert.match(LEAVE_CONFIRM_MESSAGE, /접근할 수 없습니다/);
  assert.match(LEAVE_CONFIRM_MESSAGE, /초대 코드/);
  assert.match(LEAVE_CONFIRM_MESSAGE, /개인 소비 기록은 삭제되지 않습니다/);
  assert.match(REMOVE_CONFIRM_MESSAGE, /내보냅니다/);
  assert.match(REMOVE_CONFIRM_MESSAGE, /접근할 수 없게/);
  assert.match(REMOVE_CONFIRM_MESSAGE, /초대 코드/);
  assert.equal(REMOVE_CONFIRM_MESSAGE.includes('개인 소비'), false);
});

test('성공 페이로드만 화면 갱신에 쓰고 취소는 요청을 만들지 않는다', () => {
  assert.equal(parseLeaveSpaceResult({ spaceId: 'space-1' }), 'space-1');
  assert.equal(parseLeaveSpaceResult({ spaceId: 'a/b' }), null);
  assert.equal(parseLeaveSpaceResult({}), null);
  assert.deepEqual(parseRemoveSpaceMemberResult({ spaceId: 'space-1', uid: 'member-1' }), {
    spaceId: 'space-1',
    uid: 'member-1',
  });
  assert.equal(parseRemoveSpaceMemberResult({ spaceId: 'space-1' }), null);
  const gate = createActionGate();
  assert.equal(gate.tryStart(), true);
  assert.equal(gate.tryStart(), false);
  assert.equal(gate.busy, true);
  gate.end();
  assert.equal(gate.tryStart(), true);
});

test('실패와 권한 오류는 서버 원문을 그대로 노출하지 않는다', () => {
  const leaked = toSpaceMembershipError(
    { code: 'functions/internal', message: 'stack dump at /functions' },
    'leave',
  );
  assert.equal(leaked.code, 'internal');
  assert.equal(leaked.userMessage.includes('stack'), false);
  assert.equal(leaked.userMessage.includes('/functions'), false);

  const denied = toSpaceMembershipError(
    { code: 'functions/permission-denied', message: '공간 소유자만 멤버를 내보낼 수 있어요.' },
    'remove',
  );
  assert.equal(denied.code, 'permission-denied');
  assert.equal(denied.userMessage, '공간 소유자만 멤버를 내보낼 수 있어요.');

  const alreadyLeft = toSpaceMembershipError(
    { code: 'functions/failed-precondition', message: '이미 이 공간에서 나갔어요.' },
    'leave',
  );
  assert.equal(isAlreadyLeftError(alreadyLeft), true);
  assert.equal(isAlreadyRemovedError(alreadyLeft), false);

  const alreadyRemoved = toSpaceMembershipError(
    { code: 'functions/not-found', message: '해당 멤버를 찾을 수 없어요.' },
    'remove',
  );
  assert.equal(isAlreadyRemovedError(alreadyRemoved), true);

  const ownerLeave = toSpaceMembershipError(
    { code: 'functions/failed-precondition', message: '방장은 공간을 나갈 수 없어요.' },
    'leave',
  );
  assert.equal(ownerLeave.userMessage, '방장은 공간을 나갈 수 없어요.');
  assert.equal(isAlreadyLeftError(ownerLeave), false);

  const network = toSpaceMembershipError({ code: 'functions/unavailable', message: 'INTERNAL' }, 'remove');
  assert.equal(network.userMessage, '네트워크 연결을 확인한 뒤 다시 시도해 주세요.');
  assert.ok(new SpaceMembershipError('unauthenticated', '로그인이 필요해요.'));
});
