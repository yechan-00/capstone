import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  canMutateSpaceMemory,
  classifySpaceMemoryError,
  createMemoryWriteGate,
  toSpaceMemoryError,
} from './spaceMemoryClient.ts';

test('only the author can mutate a memory', () => {
  assert.equal(canMutateSpaceMemory('author-1', 'author-1'), true);
  assert.equal(canMutateSpaceMemory('author-1', 'owner-1'), false);
  assert.equal(canMutateSpaceMemory('author-1', null), false);
});

test('write gate rejects overlapping saves', () => {
  const gate = createMemoryWriteGate();
  assert.equal(gate.tryStart(), true);
  assert.equal(gate.tryStart(), false);
  gate.end();
  assert.equal(gate.tryStart(), true);
});

test('maps permission errors without leaking internals', () => {
  const denied = toSpaceMemoryError({ code: 'permission-denied' }, 'read');
  assert.equal(denied.userMessage, '이 공간의 멤버만 기록을 볼 수 있어요.');
  const writeDenied = toSpaceMemoryError({ code: 'firestore/permission-denied' }, 'write');
  assert.equal(writeDenied.userMessage, '이 기록을 수정하거나 삭제할 수 없어요.');
  assert.equal(classifySpaceMemoryError({ code: 'not-found' }), 'not-found');
  const unknown = toSpaceMemoryError({ code: 'internal', message: 'stack' });
  assert.equal(unknown.message.includes('stack'), false);
});
