import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SPACE_MEMORY_AUTHOR_FALLBACK_NAME,
  SPACE_MEMORY_IMAGE_MAX,
  isValidSpaceMemoryDraft,
  memoriesOnDate,
  memoryPreview,
  parseSpaceMemory,
  parseSpaceMemoryImageKey,
  parseSpaceMemoryImageKeys,
  resolveSpaceMemoryAuthor,
  sortSpaceMemories,
  toSpaceMemoryWritePayload,
  type SpaceMemory,
} from './spaceMemory.ts';

function memory(partial: Partial<SpaceMemory> & Pick<SpaceMemory, 'id' | 'dateKey'>): SpaceMemory {
  return {
    title: '기록',
    content: '',
    createdByUid: 'u1',
    imageKeys: [],
    createdAt: null,
    updatedAt: null,
    ...partial,
  };
}

test('rejects expense and profile image keys', () => {
  assert.equal(
    parseSpaceMemoryImageKey('spaces/s1/memories/m1/img_abc.jpg', { spaceId: 's1', memoryId: 'm1' }),
    'spaces/s1/memories/m1/img_abc.jpg',
  );
  assert.equal(parseSpaceMemoryImageKey('users/u1/expenses/e1.jpg', { spaceId: 's1', memoryId: 'm1' }), null);
  assert.equal(parseSpaceMemoryImageKey('users/u1/profile/avatar.jpg', { spaceId: 's1', memoryId: 'm1' }), null);
  assert.equal(parseSpaceMemoryImageKey('spaces/other/memories/m1/img.jpg', { spaceId: 's1', memoryId: 'm1' }), null);
  assert.equal(parseSpaceMemoryImageKey('https://example.com/a.jpg'), null);
});

test('caps image keys at 5 and rejects a sixth', () => {
  const keys = Array.from({ length: 5 }, (_, i) => `spaces/s1/memories/m1/img_${i}.jpg`);
  assert.equal(parseSpaceMemoryImageKeys(keys, { spaceId: 's1', memoryId: 'm1' })?.length, 5);
  assert.equal(parseSpaceMemoryImageKeys([...keys, 'spaces/s1/memories/m1/img_5.jpg'], { spaceId: 's1', memoryId: 'm1' }), null);
  assert.equal(SPACE_MEMORY_IMAGE_MAX, 5);
});

test('parses memory docs and keeps image order', () => {
  const parsed = parseSpaceMemory('m1', {
    title: '  제주  ',
    content: '바닷가',
    dateKey: '2026-11-07',
    createdByUid: 'member-1',
    imageKeys: ['spaces/s1/memories/m1/b.jpg', 'spaces/s1/memories/m1/a.jpg'],
  }, 's1');
  assert.ok(parsed);
  assert.equal(parsed.title, '제주');
  assert.deepEqual(parsed.imageKeys, ['spaces/s1/memories/m1/b.jpg', 'spaces/s1/memories/m1/a.jpg']);
  assert.equal(parseSpaceMemory('m1', { title: 'x', dateKey: 'nope', createdByUid: 'u1', imageKeys: [] }), null);
});

test('sorts by dateKey descending then createdAt', () => {
  const sorted = sortSpaceMemories([
    memory({ id: 'old', dateKey: '2026-11-01', createdAt: new Date('2026-11-01T01:00:00Z') }),
    memory({ id: 'new', dateKey: '2026-11-07', createdAt: new Date('2026-11-07T01:00:00Z') }),
    memory({ id: 'mid', dateKey: '2026-11-07', createdAt: new Date('2026-11-07T00:00:00Z') }),
  ]);
  assert.deepEqual(sorted.map((row) => row.id), ['new', 'mid', 'old']);
  assert.equal(memoriesOnDate(sorted, '2026-11-07').length, 2);
});

test('draft validation and author fallback', () => {
  assert.equal(
    isValidSpaceMemoryDraft({
      title: '제목',
      content: '',
      dateKey: '2026-11-07',
      imageKeys: [],
    }),
    true,
  );
  assert.equal(
    toSpaceMemoryWritePayload({
      title: '  제목  ',
      content: '  본문  ',
      dateKey: '2026-11-07',
      imageKeys: [],
    })?.title,
    '제목',
  );
  assert.equal(memoryPreview('짧은 글'), '짧은 글');
  assert.equal(resolveSpaceMemoryAuthor('gone', []).displayName, SPACE_MEMORY_AUTHOR_FALLBACK_NAME);
});
