import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  SETTLEMENT_AMOUNT_MAX,
  SPACE_SETTLEMENT_AUTHOR_FALLBACK_NAME,
  buildSettlementTransfers,
  canCompleteSettlementTransfer,
  canCreateSpaceSettlement,
  canEditOrCancelSpaceSettlement,
  deriveSettlementStatus,
  expenseDiffersFromSettlement,
  isValidCustomShares,
  parseSettlementShareAmount,
  parseSettlementShares,
  parseSpaceSettlement,
  parseSpaceSettlementLock,
  resolveSettlementMember,
  settlementOverallLabel,
  splitEqually,
  summarizeSettlements,
  type SpaceSettlement,
} from './spaceSettlement.ts';

test('equal split assigns remainder to the first participants in stored order', () => {
  assert.deepEqual(
    splitEqually(45000, ['a', 'b', 'c']),
    [
      { uid: 'a', amount: 15000 },
      { uid: 'b', amount: 15000 },
      { uid: 'c', amount: 15000 },
    ],
  );
  assert.deepEqual(
    splitEqually(10000, ['a', 'b', 'c']),
    [
      { uid: 'a', amount: 3334 },
      { uid: 'b', amount: 3333 },
      { uid: 'c', amount: 3333 },
    ],
  );
  assert.deepEqual(
    splitEqually(1, ['a', 'b']),
    [
      { uid: 'a', amount: 1 },
      { uid: 'b', amount: 0 },
    ],
  );
  assert.deepEqual(splitEqually(100, ['only']), [{ uid: 'only', amount: 100 }]);
  const tenThousand = splitEqually(10000, ['a', 'b', 'c']);
  assert.equal(tenThousand?.reduce((sum, row) => sum + row.amount, 0), 10000);
  const oddTwo = splitEqually(10001, ['a', 'b']);
  assert.deepEqual(oddTwo, [
    { uid: 'a', amount: 5001 },
    { uid: 'b', amount: 5000 },
  ]);
  assert.equal(oddTwo?.reduce((sum, row) => sum + row.amount, 0), 10001);
  const oneWon = splitEqually(1, ['a', 'b', 'c']);
  assert.deepEqual(oneWon, [
    { uid: 'a', amount: 1 },
    { uid: 'b', amount: 0 },
    { uid: 'c', amount: 0 },
  ]);
  assert.equal(oneWon?.reduce((sum, row) => sum + row.amount, 0), 1);
});

test('equal split rejects invalid totals and duplicate participants', () => {
  assert.equal(splitEqually(0, ['a']), null);
  assert.equal(splitEqually(1.5, ['a']), null);
  assert.equal(splitEqually(10000, []), null);
  assert.equal(splitEqually(10000, ['a', 'a']), null);
  assert.equal(splitEqually(10000, ['a/b']), null);
});

test('custom shares accept zero and reject negatives, decimals, and mismatched totals', () => {
  const uids = ['a', 'b', 'c'];
  assert.equal(
    isValidCustomShares(10000, uids, [
      { uid: 'a', amount: 10000 },
      { uid: 'b', amount: 0 },
      { uid: 'c', amount: 0 },
    ]),
    true,
  );
  assert.equal(
    isValidCustomShares(10000, uids, [
      { uid: 'a', amount: 5000 },
      { uid: 'b', amount: 5000 },
    ]),
    false,
  );
  assert.equal(
    isValidCustomShares(10000, uids, [
      { uid: 'a', amount: 4000 },
      { uid: 'b', amount: 3000 },
      { uid: 'c', amount: 2000 },
    ]),
    false,
  );
  assert.equal(parseSettlementShareAmount(-1), null);
  assert.equal(parseSettlementShareAmount(1.5), null);
  assert.equal(parseSettlementShareAmount('1.5'), null);
  assert.equal(parseSettlementShareAmount(SETTLEMENT_AMOUNT_MAX + 1), null);
  assert.equal(parseSettlementShareAmount(0), 0);
  assert.equal(
    parseSettlementShares(
      [
        { uid: 'a', amount: 1 },
        { uid: 'a', amount: 2 },
      ],
      ['a', 'b'],
    ),
    null,
  );
  assert.equal(
    parseSettlementShares(
      [
        { uid: 'a', amount: 1 },
        { uid: 'outsider', amount: 2 },
      ],
      ['a', 'b'],
    ),
    null,
  );
});

test('transfers skip the payer and zero shares', () => {
  const transfers = buildSettlementTransfers('a', [
    { uid: 'a', amount: 15000 },
    { uid: 'b', amount: 15000 },
    { uid: 'c', amount: 0 },
  ]);
  assert.deepEqual(transfers, [
    {
      fromUid: 'b',
      toUid: 'a',
      amount: 15000,
      status: 'pending',
      completedByUid: null,
      completedAt: null,
    },
  ]);
  assert.equal(buildSettlementTransfers('missing', [{ uid: 'a', amount: 100 }]), null);
  assert.equal(deriveSettlementStatus([]), 'completed');
  assert.equal(
    deriveSettlementStatus([
      {
        fromUid: 'b',
        toUid: 'a',
        amount: 1,
        status: 'pending',
        completedByUid: null,
        completedAt: null,
      },
    ]),
    'open',
  );
});

test('permissions: author creates, creator edits, payer or sender completes', () => {
  assert.equal(canCreateSpaceSettlement('author', 'author'), true);
  assert.equal(canCreateSpaceSettlement('author', 'payer'), false);
  assert.equal(canEditOrCancelSpaceSettlement('creator', 'creator'), true);
  assert.equal(canEditOrCancelSpaceSettlement('creator', 'payer'), false);
  assert.equal(
    canCompleteSettlementTransfer(
      {
        fromUid: 'b',
        toUid: 'a',
        amount: 1,
        status: 'pending',
        completedByUid: null,
        completedAt: null,
      },
      'b',
    ),
    true,
  );
  assert.equal(
    canCompleteSettlementTransfer(
      {
        fromUid: 'b',
        toUid: 'a',
        amount: 1,
        status: 'pending',
        completedByUid: null,
        completedAt: null,
      },
      'a',
    ),
    true,
  );
  assert.equal(
    canCompleteSettlementTransfer(
      {
        fromUid: 'b',
        toUid: 'a',
        amount: 1,
        status: 'pending',
        completedByUid: null,
        completedAt: null,
      },
      'c',
    ),
    false,
  );
});

test('summary counts pending transfer amounts without netting across settlements', () => {
  const rows: SpaceSettlement[] = [
    {
      id: 's1',
      sharedExpenseId: 'e1',
      titleSnapshot: '점심',
      dateKeySnapshot: '2026-11-07',
      amountSnapshot: 30000,
      paidByUidSnapshot: 'a',
      participantUidsSnapshot: ['a', 'b'],
      splitMode: 'equal',
      shares: [
        { uid: 'a', amount: 15000 },
        { uid: 'b', amount: 15000 },
      ],
      transfers: [
        {
          fromUid: 'b',
          toUid: 'a',
          amount: 15000,
          status: 'pending',
          completedByUid: null,
          completedAt: null,
        },
      ],
      status: 'open',
      pendingAmount: 15000,
      completedTransferCount: 0,
      createdByUid: 'a',
      createdAt: null,
      updatedAt: null,
    },
    {
      id: 's2',
      sharedExpenseId: 'e2',
      titleSnapshot: '커피',
      dateKeySnapshot: '2026-11-07',
      amountSnapshot: 6000,
      paidByUidSnapshot: 'b',
      participantUidsSnapshot: ['a', 'b'],
      splitMode: 'equal',
      shares: [
        { uid: 'a', amount: 3000 },
        { uid: 'b', amount: 3000 },
      ],
      transfers: [
        {
          fromUid: 'a',
          toUid: 'b',
          amount: 3000,
          status: 'pending',
          completedByUid: null,
          completedAt: null,
        },
      ],
      status: 'open',
      pendingAmount: 3000,
      completedTransferCount: 0,
      createdByUid: 'a',
      createdAt: null,
      updatedAt: null,
    },
    {
      id: 's3',
      sharedExpenseId: 'e3',
      titleSnapshot: '취소',
      dateKeySnapshot: '2026-11-07',
      amountSnapshot: 1000,
      paidByUidSnapshot: 'a',
      participantUidsSnapshot: ['a', 'b'],
      splitMode: 'equal',
      shares: [
        { uid: 'a', amount: 500 },
        { uid: 'b', amount: 500 },
      ],
      transfers: [
        {
          fromUid: 'b',
          toUid: 'a',
          amount: 500,
          status: 'pending',
          completedByUid: null,
          completedAt: null,
        },
      ],
      status: 'cancelled',
      pendingAmount: 500,
      completedTransferCount: 0,
      createdByUid: 'a',
      createdAt: null,
      updatedAt: null,
    },
  ];
  const summary = summarizeSettlements(rows, 'a');
  assert.equal(summary.openCount, 2);
  assert.equal(summary.completedCount, 0);
  assert.equal(summary.unpaidTotal, 18000);
  assert.equal(summary.myToSend, 3000);
  assert.equal(summary.myToReceive, 15000);
});

test('parse settlement snapshot and departed-member fallback name', () => {
  const parsed = parseSpaceSettlement('st-1', {
    sharedExpenseId: 'se-1',
    titleSnapshot: '점심',
    dateKeySnapshot: '2026-11-07',
    amountSnapshot: 10000,
    paidByUidSnapshot: 'a',
    participantUidsSnapshot: ['a', 'b', 'left'],
    splitMode: 'custom',
    shares: [
      { uid: 'a', amount: 4000 },
      { uid: 'b', amount: 3000 },
      { uid: 'left', amount: 3000 },
    ],
    transfers: [
      {
        fromUid: 'b',
        toUid: 'a',
        amount: 3000,
        status: 'pending',
        completedByUid: null,
        completedAt: null,
      },
      {
        fromUid: 'left',
        toUid: 'a',
        amount: 3000,
        status: 'completed',
        completedByUid: 'a',
        completedAt: new Date('2026-11-07T00:00:00Z'),
      },
    ],
    status: 'open',
    createdByUid: 'a',
    createdAt: new Date('2026-11-07T00:00:00Z'),
    updatedAt: new Date('2026-11-07T00:00:00Z'),
  });
  assert.ok(parsed);
  assert.equal(parsed?.pendingAmount, 3000);
  assert.equal(parsed?.completedTransferCount, 1);
  assert.equal(settlementOverallLabel('open', parsed!.transfers), '일부 완료');
  assert.equal(resolveSettlementMember('left', []).displayName, SPACE_SETTLEMENT_AUTHOR_FALLBACK_NAME);
  assert.equal(parseSpaceSettlementLock({ settlementId: 'st-1', sharedExpenseId: 'se-1', status: 'open' })?.settlementId, 'st-1');
  assert.equal(
    expenseDiffersFromSettlement(
      { title: '점심', amount: 12000, paidByUid: 'a', participantUids: ['a', 'b', 'left'] },
      parsed!,
    ),
    true,
  );
});
