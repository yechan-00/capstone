import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SPACE_MEMORY_R2_OBJECT_MAX,
  canDeleteOwnedMemoryImage,
  canUploadSpaceMemoryImage,
  isSpaceMemoryR2CountAtCap,
  isSpaceMemoryR2CountOverCap,
  parseSpaceMemoryImageKey,
  spaceMemoryImageCustomMetadata,
  spaceMemoryImageExtension,
  spaceMemoryImageObjectKey,
} from './spaceMemoryImageKey.ts';

test('memory object keys stay off expense and profile prefixes', () => {
  assert.equal(
    spaceMemoryImageObjectKey('s1', 'm1', 'img_abc.jpg'),
    'spaces/s1/memories/m1/img_abc.jpg',
  );
  assert.equal(parseSpaceMemoryImageKey('users/u1/expenses/e1.jpg'), null);
  assert.equal(parseSpaceMemoryImageKey('users/u1/profile/avatar.jpg'), null);
  assert.equal(
    parseSpaceMemoryImageKey('spaces/s1/memories/m1/img_abc.jpg', { spaceId: 's2' }),
    null,
  );
  assert.equal(
    parseSpaceMemoryImageKey('spaces/s1/memories/m1/img_abc.jpg', { memoryId: 'other' }),
    null,
  );
});

test('delete requests cannot target another space or memory via imageKey', () => {
  const own = parseSpaceMemoryImageKey('spaces/s1/memories/m1/img_abc.jpg', {
    spaceId: 's1',
    memoryId: 'm1',
  });
  assert.equal(own?.key, 'spaces/s1/memories/m1/img_abc.jpg');
  assert.equal(
    parseSpaceMemoryImageKey('spaces/s2/memories/m1/img_abc.jpg', { spaceId: 's1', memoryId: 'm1' }),
    null,
  );
  assert.equal(
    parseSpaceMemoryImageKey('spaces/s1/memories/m2/img_abc.jpg', { spaceId: 's1', memoryId: 'm1' }),
    null,
  );
});

test('only the object owner can delete; missing ownerUid is denied', () => {
  assert.equal(canDeleteOwnedMemoryImage('author-1', 'author-1'), true);
  assert.equal(canDeleteOwnedMemoryImage('author-1', 'member-2'), false);
  assert.equal(canDeleteOwnedMemoryImage(undefined, 'author-1'), false);
  assert.equal(canDeleteOwnedMemoryImage('', 'author-1'), false);
});

test('ownerUid metadata is taken from the verified uid, not the client', () => {
  assert.deepEqual(spaceMemoryImageCustomMetadata('author-1', 's1', 'm1'), {
    ownerUid: 'author-1',
    kind: 'space-memory',
    spaceId: 's1',
    memoryId: 'm1',
  });
});

test('existing memories are author-only; missing docs allow a member upload; lookup errors deny', () => {
  assert.equal(
    canUploadSpaceMemoryImage({ memoryExists: false, createdByUid: null, sessionUid: 'member-1' }),
    true,
  );
  assert.equal(
    canUploadSpaceMemoryImage({
      memoryExists: true,
      createdByUid: 'author-1',
      sessionUid: 'author-1',
    }),
    true,
  );
  assert.equal(
    canUploadSpaceMemoryImage({
      memoryExists: true,
      createdByUid: 'author-1',
      sessionUid: 'member-2',
    }),
    false,
  );
  assert.equal(
    canUploadSpaceMemoryImage({ memoryExists: true, createdByUid: null, sessionUid: 'member-1' }),
    false,
  );
});

test('server rejects non-image types used to bypass the jpeg/png/webp/heic allowlist', () => {
  assert.equal(spaceMemoryImageExtension('image/jpeg'), 'jpg');
  assert.equal(spaceMemoryImageExtension('image/png'), 'png');
  assert.equal(spaceMemoryImageExtension('image/webp'), 'webp');
  assert.equal(spaceMemoryImageExtension('image/heic'), 'heic');
  assert.equal(spaceMemoryImageExtension('image/svg+xml'), null);
  assert.equal(spaceMemoryImageExtension('image/gif'), null);
  assert.equal(spaceMemoryImageExtension('application/octet-stream'), null);
});

test('R2 prefix cap blocks a ninth object and concurrent puts over the cap', () => {
  assert.equal(SPACE_MEMORY_R2_OBJECT_MAX, 8);
  assert.equal(isSpaceMemoryR2CountAtCap(7), false);
  assert.equal(isSpaceMemoryR2CountAtCap(8), true);
  assert.equal(isSpaceMemoryR2CountOverCap(8), false);
  assert.equal(isSpaceMemoryR2CountOverCap(9), true);
});
