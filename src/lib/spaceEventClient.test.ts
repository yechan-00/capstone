import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  canMutateSpaceEvent,
  classifySpaceEventError,
  createEventWriteGate,
  toSpaceEventError,
} from './spaceEventClient.ts';

test('only the author can mutate an event', () => {
  assert.equal(canMutateSpaceEvent('author-1', 'author-1'), true);
  assert.equal(canMutateSpaceEvent('author-1', 'owner-1'), false);
  assert.equal(canMutateSpaceEvent('author-1', null), false);
  assert.equal(canMutateSpaceEvent(undefined, 'author-1'), false);
});

test('write gate rejects overlapping saves', () => {
  const gate = createEventWriteGate();
  assert.equal(gate.tryStart(), true);
  assert.equal(gate.tryStart(), false);
  gate.end();
  assert.equal(gate.tryStart(), true);
});

test('maps firestore permission errors without leaking internals', () => {
  const denied = toSpaceEventError({ code: 'permission-denied' }, 'read');
  assert.equal(denied.code, 'permission-denied');
  assert.equal(denied.userMessage, '이 공간의 멤버만 일정을 볼 수 있어요.');
  const writeDenied = toSpaceEventError({ code: 'firestore/permission-denied' }, 'write');
  assert.equal(writeDenied.userMessage, '이 일정을 수정하거나 삭제할 수 없어요.');
  assert.equal(classifySpaceEventError({ code: 'not-found' }), 'not-found');
  assert.equal(classifySpaceEventError({ code: 'unavailable' }), 'unavailable');
  const unknown = toSpaceEventError({ code: 'internal', message: 'stack' });
  assert.equal(unknown.code, 'unavailable');
  assert.equal(unknown.message.includes('stack'), false);
});
