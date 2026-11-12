import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SHARED_EXPENSE_AMOUNT_MAX,
  SHARED_EXPENSE_AUTHOR_FALLBACK_NAME,
  SHARED_EXPENSE_PARTICIPANT_MAX,
  categoryShareFallbackTitle,
  dateKeysWithSharedExpenses,
  defaultSharedExpensePaidBy,
  defaultSharedExpenseParticipants,
  isAllowedSharedExpenseMembershipCreate,
  isAllowedSharedExpenseMembershipUpdate,
  parseSharedExpenseAmount,
  parseSpaceSharedExpense,
  pickPersonalExpenseShareFields,
  sharedExpensePublicKeys,
  sharedExpensesOnDate,
  sortSpaceSharedExpenses,
  toSpaceSharedExpenseWritePayload,
  type SpaceSharedExpense,
} from './spaceSharedExpense.ts';

function expense(partial: Partial<SpaceSharedExpense> & Pick<SpaceSharedExpense, 'id' | 'dateKey'>): SpaceSharedExpense {
  return {
    title: '점심',
    amount: 12000,
    category: 'takeout',
    paidByUid: 'u1',
    participantUids: ['u1'],
    memo: '',
    createdByUid: 'u1',
    createdAt: null,
    updatedAt: null,
    ...partial,
  };
}

const validDoc = {
  title: '  점심  ',
  amount: 12000,
  dateKey: '2026-11-07',
  category: 'takeout',
  paidByUid: 'member-1',
  participantUids: ['member-1', 'owner-1'],
  memo: '  메모  ',
  createdByUid: 'member-1',
};

test('rejects zero, negative, decimal, and huge amounts', () => {
  assert.equal(parseSharedExpenseAmount(0), null);
  assert.equal(parseSharedExpenseAmount(-1), null);
  assert.equal(parseSharedExpenseAmount(1.5), null);
  assert.equal(parseSharedExpenseAmount('1.5'), null);
  assert.equal(parseSharedExpenseAmount('12,000'), null);
  assert.equal(parseSharedExpenseAmount(SHARED_EXPENSE_AMOUNT_MAX + 1), null);
  assert.equal(parseSharedExpenseAmount(1), 1);
  assert.equal(parseSharedExpenseAmount('99000'), 99000);
  assert.equal(parseSharedExpenseAmount(SHARED_EXPENSE_AMOUNT_MAX), SHARED_EXPENSE_AMOUNT_MAX);
});

test('rejects invalid dates, categories, and participant lists', () => {
  assert.equal(
    toSpaceSharedExpenseWritePayload({
      ...validDoc,
      title: '점심',
      dateKey: '2026-13-40',
      memo: '',
    }),
    null,
  );
  assert.equal(
    toSpaceSharedExpenseWritePayload({
      ...validDoc,
      title: '점심',
      category: 'travel' as 'takeout',
      memo: '',
    }),
    null,
  );
  assert.equal(
    toSpaceSharedExpenseWritePayload({
      title: '점심',
      amount: 1000,
      dateKey: '2026-11-07',
      category: 'cafe',
      paidByUid: 'outsider',
      participantUids: ['member-1'],
      memo: '',
    }),
    null,
  );
  const tooMany = Array.from({ length: SHARED_EXPENSE_PARTICIPANT_MAX + 1 }, (_, i) => `u${i}`);
  assert.equal(
    toSpaceSharedExpenseWritePayload({
      title: '점심',
      amount: 1000,
      dateKey: '2026-11-07',
      category: 'cafe',
      paidByUid: 'u0',
      participantUids: tooMany,
      memo: '',
    }),
    null,
  );
});

test('parses shared docs and strips personal fields', () => {
  const parsed = parseSpaceSharedExpense('se1', {
    ...validDoc,
    expenseId: 'personal-secret',
    reason: '충동',
    mood: 'bad',
    imageUrls: ['https://example.com/a.jpg'],
    accountId: 'account_member-1',
  });
  assert.ok(parsed);
  assert.equal(parsed.title, '점심');
  assert.equal(parsed.memo, '메모');
  assert.equal(parsed.amount, 12000);
  assert.equal('expenseId' in parsed, false);
  assert.equal('reason' in parsed, false);
  assert.equal('mood' in parsed, false);
  assert.equal('imageUrls' in parsed, false);
  assert.deepEqual(sharedExpensePublicKeys().includes('expenseId'), false);
});

test('sorts by dateKey descending then createdAt', () => {
  const sorted = sortSpaceSharedExpenses([
    expense({ id: 'old', dateKey: '2026-11-01', createdAt: new Date('2026-11-01T01:00:00Z') }),
    expense({ id: 'new', dateKey: '2026-11-07', createdAt: new Date('2026-11-07T01:00:00Z') }),
    expense({ id: 'mid', dateKey: '2026-11-07', createdAt: new Date('2026-11-07T00:00:00Z') }),
  ]);
  assert.deepEqual(sorted.map((row) => row.id), ['new', 'mid', 'old']);
  assert.equal(sharedExpensesOnDate(sorted, '2026-11-07').length, 2);
  assert.deepEqual([...dateKeysWithSharedExpenses(sorted)].sort(), ['2026-11-01', '2026-11-07']);
});

test('personal share copies only selected public fields', () => {
  const source = {
    item: '김밥',
    content: '편의점',
    amount: 4500,
    category: 'takeout',
    reason: '스트레스',
    mood: 'bad',
    tags: ['야식'],
    summaryLine: '후회함',
    imageUrl: 'https://example.com/secret.jpg',
    imageUrls: ['https://example.com/secret.jpg'],
  };
  const picked = pickPersonalExpenseShareFields(source, '2026-11-07', true);
  assert.ok(picked);
  assert.deepEqual(Object.keys(picked).sort(), ['amount', 'category', 'dateKey', 'title']);
  assert.equal(picked.title, '김밥');
  assert.equal(picked.amount, 4500);
  assert.equal('reason' in picked, false);
  assert.equal('mood' in picked, false);
  assert.equal('imageUrl' in picked, false);
  assert.equal('summaryLine' in picked, false);

  const untitled = pickPersonalExpenseShareFields(
    { amount: 2000, category: 'cafe', reason: '숨김' },
    '2026-11-07',
    false,
  );
  assert.ok(untitled);
  assert.equal(untitled.title, categoryShareFallbackTitle('cafe'));
  assert.equal(untitled.amount, 2000);
});

test('still parses records whose payer later left the space', () => {
  const parsed = parseSpaceSharedExpense('se1', {
    ...validDoc,
    paidByUid: 'left-user',
    participantUids: ['left-user', 'member-1'],
  });
  assert.ok(parsed);
  assert.equal(parsed.paidByUid, 'left-user');
  assert.deepEqual(parsed.participantUids, ['left-user', 'member-1']);
});

test('create requires current members; update may keep departed payer and participants', () => {
  const current = ['owner-1', 'member-1'];
  const existing = { paidByUid: 'left-user', participantUids: ['member-1', 'left-user'] };
  assert.equal(isAllowedSharedExpenseMembershipCreate('left-user', ['member-1', 'left-user'], current), false);
  assert.equal(isAllowedSharedExpenseMembershipCreate('member-1', ['member-1'], current), true);
  assert.equal(
    isAllowedSharedExpenseMembershipUpdate(existing, {
      paidByUid: 'left-user',
      participantUids: ['member-1', 'left-user'],
    }, current),
    true,
  );
  assert.equal(
    isAllowedSharedExpenseMembershipUpdate(existing, {
      paidByUid: 'left-user',
      participantUids: ['member-1', 'left-user', 'owner-1'],
    }, current),
    true,
  );
  assert.equal(
    isAllowedSharedExpenseMembershipUpdate(existing, {
      paidByUid: 'member-1',
      participantUids: ['member-1', 'left-user'],
    }, current),
    true,
  );
  assert.equal(
    isAllowedSharedExpenseMembershipUpdate(existing, {
      paidByUid: 'left-user',
      participantUids: ['member-1', 'left-user', 'outsider-1'],
    }, current),
    false,
  );
  assert.equal(
    isAllowedSharedExpenseMembershipUpdate(existing, {
      paidByUid: 'outsider-1',
      participantUids: ['member-1', 'left-user', 'outsider-1'],
    }, current),
    false,
  );
});

test('departed members keep fallback names and defaults stay in the space', () => {
  const paidBy = defaultSharedExpensePaidBy(['owner-1', 'member-1'], 'member-1');
  assert.equal(paidBy, 'member-1');
  assert.deepEqual(defaultSharedExpenseParticipants(['owner-1', 'member-1'], 'member-1'), [
    'owner-1',
    'member-1',
  ]);
  assert.equal(SHARED_EXPENSE_AUTHOR_FALLBACK_NAME, '이름 없음');
});
