import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  classifySpaceSettlementError,
  createSettlementWriteGate,
  parseCreateSettlementResult,
  spaceSettlementErrorCardCopy,
  toSpaceSettlementError,
} from './spaceSettlementClient.ts';

test('write gate rejects overlapping settlement saves', () => {
  const gate = createSettlementWriteGate();
  assert.equal(gate.tryStart(), true);
  assert.equal(gate.tryStart(), false);
  gate.end();
  assert.equal(gate.tryStart(), true);
});

test('maps settlement permission and duplicate errors without leaking internals', () => {
  const denied = toSpaceSettlementError({ code: 'permission-denied' }, 'read');
  assert.equal(denied.userMessage, '이 공간의 멤버만 정산을 볼 수 있어요.');
  const createDenied = toSpaceSettlementError({ code: 'functions/permission-denied' }, 'create');
  assert.equal(createDenied.userMessage, '공동 소비를 작성한 멤버만 정산을 시작할 수 있어요.');
  const writeDenied = toSpaceSettlementError({ code: 'permission-denied' }, 'write');
  assert.equal(writeDenied.userMessage, '정산을 만든 멤버만 수정하거나 취소할 수 있어요.');
  const completeDenied = toSpaceSettlementError({ code: 'permission-denied' }, 'complete');
  assert.equal(completeDenied.userMessage, '송금할 사람 또는 받을 사람만 완료 처리할 수 있어요.');
  const duplicate = toSpaceSettlementError({
    code: 'functions/already-exists',
    message: '이미 이 소비에 대한 정산이 있어요.',
  });
  assert.equal(duplicate.userMessage, '이미 이 소비에 대한 정산이 있어요.');
  assert.equal(classifySpaceSettlementError({ code: 'already-exists' }), 'conflict');
  const unknown = toSpaceSettlementError({ code: 'internal', message: 'stack-trace' });
  assert.equal(unknown.message.includes('stack-trace'), false);
  const card = spaceSettlementErrorCardCopy('permission-denied');
  assert.notEqual(card.title, card.desc);
  assert.equal(card.title.includes('정산을 볼 수'), true);
});

test('parses create results and rejects path-like ids', () => {
  assert.deepEqual(parseCreateSettlementResult({ spaceId: 's1', settlementId: 'st1' }), {
    spaceId: 's1',
    settlementId: 'st1',
  });
  assert.equal(parseCreateSettlementResult({ spaceId: 's1/other', settlementId: 'st1' }), null);
});
