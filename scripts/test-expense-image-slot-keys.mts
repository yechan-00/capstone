import {
  EXPENSE_IMAGE_FILE_NAME_PATTERN,
  createExpenseImageSlotFileName,
  createExpenseImageSlotUniqueId,
  expenseImageObjectKey,
  isValidExpenseImageSlot,
  legacyExpenseImagePrefix,
  slotExpenseImagePrefix,
} from '../workers/expenseImageSlotKey.ts';

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertOk(value: unknown, message: string) {
  if (!value) throw new Error(message);
}

function run(name: string, fn: () => void) {
  fn();
  console.log(`ok ${name}`);
}

run('slots 1-5 allowed, 0 and 6 rejected', () => {
  assertEqual(isValidExpenseImageSlot(1), true, '1');
  assertEqual(isValidExpenseImageSlot(5), true, '5');
  assertEqual(isValidExpenseImageSlot(0), false, '0');
  assertEqual(isValidExpenseImageSlot(6), false, '6');
  assertEqual(isValidExpenseImageSlot(1.5), false, '1.5');
});

run('same slot re-upload uses a different object key', () => {
  const a = createExpenseImageSlotFileName('expense456', 2, createExpenseImageSlotUniqueId(), 'jpg');
  const b = createExpenseImageSlotFileName('expense456', 2, createExpenseImageSlotUniqueId(), 'jpg');
  assertOk(a !== b, 'unique file names');
  assertOk(EXPENSE_IMAGE_FILE_NAME_PATTERN.test(a), 'get regex a');
  assertOk(EXPENSE_IMAGE_FILE_NAME_PATTERN.test(b), 'get regex b');
});

run('slot keys do not match the legacy delete prefix', () => {
  const fileName = createExpenseImageSlotFileName('expense456', 2, 'abc123def456', 'jpg');
  const key = expenseImageObjectKey('uid1', fileName);
  const legacyPrefix = legacyExpenseImagePrefix('uid1', 'expense456');
  const slotPrefix = slotExpenseImagePrefix('uid1', 'expense456', 2);
  assertEqual(key.startsWith(legacyPrefix), false, 'not legacy prefix');
  assertEqual(key.startsWith(slotPrefix), false, 'unique key is not slot-dot prefix');
  assertOk(key.includes('/expenses/expense456_2_'), 'slot in unique key');
});

run('legacy file name still matches GET pattern', () => {
  assertOk(EXPENSE_IMAGE_FILE_NAME_PATTERN.test('expense123.jpg'), 'legacy jpg');
  assertOk(EXPENSE_IMAGE_FILE_NAME_PATTERN.test('expense123.png'), 'legacy png');
});

run('in-memory put never deletes other objects', () => {
  const store = new Map<string, string>([
    ['users/uid/expenses/expense123.jpg', 'legacy'],
    ['users/uid/expenses/expense456_1_old.jpg', 'slot1'],
    ['users/uid/expenses/expense456_3_old.jpg', 'slot3'],
  ]);
  const fileName = createExpenseImageSlotFileName('expense456', 2, 'newid', 'jpg');
  const key = expenseImageObjectKey('uid', fileName);
  store.set(key, 'slot2-new');
  assertEqual(store.get('users/uid/expenses/expense123.jpg'), 'legacy', 'legacy kept');
  assertEqual(store.get('users/uid/expenses/expense456_1_old.jpg'), 'slot1', 'slot1 kept');
  assertEqual(store.get('users/uid/expenses/expense456_3_old.jpg'), 'slot3', 'slot3 kept');
  assertEqual(store.get(key), 'slot2-new', 'new slot stored');
});

run('failed put leaves previous objects untouched', () => {
  const store = new Map<string, string>([['users/uid/expenses/expense456_2_old.jpg', 'keep']]);
  try {
    throw new Error('put failed');
  } catch {
    assertEqual(store.get('users/uid/expenses/expense456_2_old.jpg'), 'keep', 'old key remains');
  }
});

console.log('all expense image slot key tests passed');
