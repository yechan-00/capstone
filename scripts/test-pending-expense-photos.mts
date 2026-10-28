import {
  MAX_EXPENSE_PHOTOS,
  mergePendingExpensePhotos,
  remainingExpensePhotoSlots,
  removePendingExpensePhoto,
  setCoverPendingExpensePhoto,
  type PendingExpensePhoto,
} from '../src/utils/pendingExpensePhotos.ts';

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

function photo(id: string, uri = `file://${id}.jpg`): PendingExpensePhoto {
  return { id, uri };
}

run('empty stays empty', () => {
  assertEqual(mergePendingExpensePhotos([], []), [], 'none');
  assertEqual(remainingExpensePhotoSlots([]), MAX_EXPENSE_PHOTOS, 'five open');
});

run('adds photos in selection order', () => {
  const merged = mergePendingExpensePhotos([], [photo('a'), photo('b'), photo('c')]);
  assertEqual(merged.map((item) => item.id), ['a', 'b', 'c'], 'order');
});

run('blocks duplicates by id and uri', () => {
  const existing = [photo('a')];
  const merged = mergePendingExpensePhotos(existing, [
    photo('a'),
    { id: 'b', uri: 'file://a.jpg' },
    photo('c'),
  ]);
  assertEqual(merged.map((item) => item.id), ['a', 'c'], 'deduped');
});

run('caps at five and keeps earlier photos', () => {
  const existing = [photo('1'), photo('2'), photo('3')];
  const merged = mergePendingExpensePhotos(existing, [photo('4'), photo('5'), photo('6')]);
  assertEqual(merged.map((item) => item.id), ['1', '2', '3', '4', '5'], 'cap');
  assertEqual(remainingExpensePhotoSlots(merged), 0, 'full');
});

run('three existing only accept two more', () => {
  const existing = [photo('1'), photo('2'), photo('3')];
  assertEqual(remainingExpensePhotoSlots(existing), 2, 'two slots');
  const merged = mergePendingExpensePhotos(existing, [photo('4'), photo('5'), photo('6')]);
  assertEqual(merged.length, 5, 'still five');
});

run('remove keeps the rest in order', () => {
  const next = removePendingExpensePhoto([photo('a'), photo('b'), photo('c')], 'b');
  assertEqual(next.map((item) => item.id), ['a', 'c'], 'removed');
});

run('set cover moves the photo to the front', () => {
  const next = setCoverPendingExpensePhoto([photo('a'), photo('b'), photo('c')], 'c');
  assertEqual(next.map((item) => item.id), ['c', 'a', 'b'], 'cover first');
});

run('set cover on first photo is a no-op', () => {
  const current = [photo('a'), photo('b')];
  assertEqual(setCoverPendingExpensePhoto(current, 'a'), current, 'same array');
});

run('drops empty ids and uris', () => {
  const merged = mergePendingExpensePhotos([], [
    { id: '', uri: 'file://x.jpg' },
    { id: 'ok', uri: '   ' },
    photo('keep'),
  ]);
  assertEqual(merged.map((item) => item.id), ['keep'], 'valid only');
});

console.log('all pending expense photo tests passed');
