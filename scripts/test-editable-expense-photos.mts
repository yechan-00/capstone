import { getExpenseImageUrls } from '../src/utils/expenseImage.ts';
import {
  assembleEditedImageUrls,
  buildEditedImagePersistFields,
  cloneEditablePhotos,
  editablePhotosUnchanged,
  type EditableExpensePhoto,
} from '../src/utils/editedImagePersist.ts';

function assertEqual(actual: unknown, expected: unknown, message: string) {
  const left = JSON.stringify(actual);
  const right = JSON.stringify(expected);
  if (left !== right) {
    throw new Error(`${message}: expected ${right}, got ${left}`);
  }
}

function run(name: string, fn: () => void) {
  fn();
  console.log(`ok ${name}`);
}

const a = 'https://img.example/a.jpg?token=1';
const b = 'https://img.example/b.jpg?token=2';
const c = 'https://img.example/c.jpg?token=3';
const d = 'https://img.example/d.jpg?token=4';

const remote = (url: string): EditableExpensePhoto => ({ id: `remote:${url}`, kind: 'remote', uri: url });
const local = (id: string, uri = `file://${id}.jpg`): EditableExpensePhoto => ({ id, kind: 'local', uri });

run('legacy imageUrl becomes one url for edit load', () => {
  assertEqual(getExpenseImageUrls({ imageUrl: a }), [a], 'from imageUrl');
});

run('empty imageUrls means no photos', () => {
  assertEqual(getExpenseImageUrls({ imageUrl: a, imageUrls: [] }), [], 'empty wins');
});

run('unchanged remote list skips persist', () => {
  const original = [remote(a), remote(b)];
  assertEqual(editablePhotosUnchanged(original, cloneEditablePhotos(original)), true, 'same');
  assertEqual(editablePhotosUnchanged(original, [remote(b), remote(a)]), false, 'reordered');
  assertEqual(editablePhotosUnchanged(original, [remote(a), local('x')]), false, 'has local');
});

run('assemble keeps order and drops failed locals', () => {
  const photos = [remote(c), local('new-d'), remote(a)];
  const assembled = assembleEditedImageUrls(photos, { 'new-d': d });
  assertEqual(assembled.urls, [c, d, a], 'order');
  assertEqual(assembled.failedLocalCount, 0, 'ok');
  const failed = assembleEditedImageUrls(photos, {});
  assertEqual(failed.urls, [c, a], 'skip failed local');
  assertEqual(failed.failedLocalCount, 1, 'one fail');
  assertEqual(failed.totalLocal, 1, 'one local');
});

run('all local failures keep no new urls so save can abort', () => {
  const photos = [local('x'), local('y')];
  const assembled = assembleEditedImageUrls(photos, {});
  assertEqual(assembled.urls, [], 'none');
  assertEqual(assembled.failedLocalCount, 2, 'both');
  assertEqual(assembled.totalLocal === assembled.failedLocalCount, true, 'abort persist');
});

run('persist fields for legacy empty/single/multi', () => {
  assertEqual(buildEditedImagePersistFields([], false), { imageUrl: null }, 'legacy empty');
  assertEqual(
    buildEditedImagePersistFields([], true),
    { imageUrl: null, imageUrls: [] },
    'new empty',
  );
  assertEqual(buildEditedImagePersistFields([a], false), { imageUrl: a }, 'legacy still one');
  assertEqual(
    buildEditedImagePersistFields([a, b], false),
    { imageUrl: a, imageUrls: [a, b] },
    'legacy expanded',
  );
  assertEqual(
    buildEditedImagePersistFields([c, d, a], true),
    { imageUrl: c, imageUrls: [c, d, a] },
    'synced cover',
  );
});

console.log('all editable expense photo tests passed');
