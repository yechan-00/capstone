import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  localMemoryPhotos,
  moveMemoryPhoto,
  remainingMemoryPhotoSlots,
  remoteMemoryPhotos,
  spaceMemoryImageUri,
  type MemoryPhotoDraft,
} from './spaceMemoryImage.ts';

test('builds auth-gated worker urls from image keys and rejects foreign keys', () => {
  assert.equal(
    spaceMemoryImageUri(
      'https://img.example',
      's1',
      'm1',
      'spaces/s1/memories/m1/img_abc.jpg',
    ),
    'https://img.example/v1/spaces/s1/memories/m1/images/img_abc.jpg',
  );
  assert.equal(
    spaceMemoryImageUri('https://img.example', 's1', 'm1', 'users/u1/expenses/e1.jpg'),
    null,
  );
  assert.equal(spaceMemoryImageUri(null, 's1', 'm1', 'spaces/s1/memories/m1/img_abc.jpg'), null);
});

test('photo drafts keep order and remaining slots', () => {
  const photos: MemoryPhotoDraft[] = [
    ...remoteMemoryPhotos(['spaces/s1/memories/m1/a.jpg', 'spaces/s1/memories/m1/b.jpg'], 's1', 'm1'),
    { kind: 'local', id: 'local-1', uri: 'file://one.jpg' },
  ];
  assert.equal(photos[0]?.kind, 'remote');
  assert.equal(remainingMemoryPhotoSlots(photos), 2);
  assert.equal(localMemoryPhotos(photos).length, 1);
  const moved = moveMemoryPhoto(photos, 2, 0);
  assert.equal(moved[0]?.kind, 'local');
  assert.equal(moved[1]?.kind, 'remote');
});
