import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  canMutateSpaceSharedExpense,
  classifySpaceSharedExpenseError,
  createSharedExpenseWriteGate,
  parseCreateSharedExpenseResult,
  toSpaceSharedExpenseError,
} from './spaceSharedExpenseClient.ts';

test('only the author can mutate a shared expense', () => {
  assert.equal(canMutateSpaceSharedExpense('author-1', 'author-1'), true);
  assert.equal(canMutateSpaceSharedExpense('author-1', 'owner-1'), false);
  assert.equal(canMutateSpaceSharedExpense('author-1', null), false);
});

test('write gate rejects overlapping saves', () => {
  const gate = createSharedExpenseWriteGate();
  assert.equal(gate.tryStart(), true);
  assert.equal(gate.tryStart(), false);
  gate.end();
  assert.equal(gate.tryStart(), true);
});

test('maps permission errors without leaking internals', () => {
  const denied = toSpaceSharedExpenseError({ code: 'permission-denied' }, 'read');
  assert.equal(denied.userMessage, '이 공간의 멤버만 공동 소비를 볼 수 있어요.');
  const writeDenied = toSpaceSharedExpenseError({ code: 'firestore/permission-denied' }, 'write');
  assert.equal(writeDenied.userMessage, '작성한 멤버만 수정하거나 삭제할 수 있어요.');
  const shareDenied = toSpaceSharedExpenseError({ code: 'functions/permission-denied' }, 'share');
  assert.equal(shareDenied.userMessage, '내 소비만 공유 공간에 복사할 수 있어요.');
  assert.equal(classifySpaceSharedExpenseError({ code: 'failed-precondition' }), 'inactive');
  const settlementLock = toSpaceSharedExpenseError(
    { code: 'functions/failed-precondition', message: '진행 중인 정산이 있어 금액·결제자·참여자를 바꿀 수 없어요.' },
    'write',
  );
  assert.equal(settlementLock.userMessage.includes('정산'), true);
  const unknown = toSpaceSharedExpenseError({ code: 'internal', message: 'stack' });
  assert.equal(unknown.message.includes('stack'), false);
});

test('parses create results and rejects paths', () => {
  assert.deepEqual(parseCreateSharedExpenseResult({ spaceId: 's1', sharedExpenseId: 'e1' }), {
    spaceId: 's1',
    sharedExpenseId: 'e1',
  });
  assert.equal(parseCreateSharedExpenseResult({ spaceId: 's1/other', sharedExpenseId: 'e1' }), null);
});
