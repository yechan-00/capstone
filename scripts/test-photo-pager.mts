import { pageIndexFromOffset } from '../src/utils/photoPager.ts';

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${expected}, got ${actual}`);
  }
}

function run(name: string, fn: () => void) {
  fn();
  console.log(`ok ${name}`);
}

run('zero width or count stays at 0', () => {
  assertEqual(pageIndexFromOffset(120, 0, 3), 0, 'width');
  assertEqual(pageIndexFromOffset(120, 100, 0), 0, 'count');
});

run('snaps to nearest page', () => {
  assertEqual(pageIndexFromOffset(0, 200, 5), 0, 'first');
  assertEqual(pageIndexFromOffset(199, 200, 5), 1, 'almost second');
  assertEqual(pageIndexFromOffset(200, 200, 5), 1, 'second');
  assertEqual(pageIndexFromOffset(801, 200, 5), 4, 'last');
});

run('does not go past first or last', () => {
  assertEqual(pageIndexFromOffset(-40, 200, 3), 0, 'before first');
  assertEqual(pageIndexFromOffset(900, 200, 3), 2, 'after last');
});

console.log('all photo pager tests passed');
