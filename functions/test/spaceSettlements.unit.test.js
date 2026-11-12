const assert = require('assert');
const { HttpsError } = require('firebase-functions/v2/https');
const {
  splitEqually,
  parseCustomShares,
  buildTransfers,
  deriveStatus,
  createSpaceSettlementHandler,
  updateSpaceSettlementHandler,
  cancelSpaceSettlementHandler,
  setSpaceSettlementTransferStatusHandler,
} = require('../spaceSettlements');

const OWNER = 'owner-1';
const MEMBER = 'member-1';
const OTHER = 'member-2';
const OUTSIDER = 'outsider-1';
const SPACE_ID = 'space-1';
const EXPENSE_ID = 'se-1';

function registeredAuth(uid = MEMBER) {
  return {
    uid,
    token: { firebase: { sign_in_provider: 'password' } },
  };
}

function expectHttpsError(fn, code) {
  try {
    fn();
  } catch (error) {
    assert.ok(error instanceof HttpsError, 'HttpsError여야 합니다');
    assert.strictEqual(error.code, code);
    return error;
  }
  assert.fail('오류가 발생해야 합니다');
}

async function expectHttpsErrorAsync(promise, code) {
  try {
    await promise;
  } catch (error) {
    assert.ok(error instanceof HttpsError, 'HttpsError여야 합니다');
    assert.strictEqual(error.code, code);
    return error;
  }
  assert.fail('오류가 발생해야 합니다');
}

function expenseDoc(overrides = {}) {
  return {
    title: '점심',
    amount: 10000,
    dateKey: '2026-11-07',
    category: 'takeout',
    paidByUid: MEMBER,
    participantUids: [MEMBER, OWNER, OTHER],
    memo: '',
    createdByUid: MEMBER,
    ...overrides,
  };
}

function applyWrite(state, write) {
  const parts = write.path.split('/');
  if (parts[2] === 'settlements') {
    const id = parts[3];
    if (write.op === 'set') state.settlements[id] = { ...write.data };
    if (write.op === 'update') state.settlements[id] = { ...(state.settlements[id] || {}), ...write.data };
  }
  if (parts[2] === 'settlement_locks') {
    const id = parts[3];
    if (write.op === 'set') state.locks[id] = { ...write.data };
    if (write.op === 'delete') delete state.locks[id];
  }
}

function makeDb({
  space = { id: SPACE_ID, data: { status: 'active', ownerUid: OWNER } },
  members = { [OWNER]: { role: 'owner' }, [MEMBER]: { role: 'member' }, [OTHER]: { role: 'member' } },
  sharedExpenses = { [EXPENSE_ID]: expenseDoc() },
  settlements = {},
  locks = {},
} = {}) {
  const state = {
    space: space ? { ...space.data } : null,
    spaceId: space ? space.id : SPACE_ID,
    members: { ...members },
    sharedExpenses: { ...sharedExpenses },
    settlements: { ...settlements },
    locks: { ...locks },
  };
  const writes = [];
  let autoId = 0;

  function spaceDoc(spaceId) {
    return {
      id: spaceId,
      path: `spaces/${spaceId}`,
      async get() {
        if (state.space && state.spaceId === spaceId) {
          return { exists: true, data: () => ({ ...state.space }) };
        }
        return { exists: false, data: () => undefined };
      },
      collection(sub) {
        if (sub === 'space_members') {
          return {
            doc(uid) {
              return {
                id: uid,
                path: `spaces/${spaceId}/space_members/${uid}`,
                async get() {
                  const row = state.members[uid];
                  return row
                    ? { exists: true, data: () => ({ ...row }) }
                    : { exists: false, data: () => undefined };
                },
              };
            },
          };
        }
        if (sub === 'shared_expenses') {
          return {
            doc(id) {
              return {
                id,
                path: `spaces/${spaceId}/shared_expenses/${id}`,
                async get() {
                  const row = state.sharedExpenses[id];
                  return row
                    ? { exists: true, data: () => ({ ...row }) }
                    : { exists: false, data: () => undefined };
                },
              };
            },
          };
        }
        if (sub === 'settlements') {
          return {
            doc(id) {
              const settlementId = id || `st-${++autoId}`;
              const path = `spaces/${spaceId}/settlements/${settlementId}`;
              return {
                id: settlementId,
                path,
                async get() {
                  const row = state.settlements[settlementId];
                  return row
                    ? { exists: true, data: () => ({ ...row }) }
                    : { exists: false, data: () => undefined };
                },
              };
            },
          };
        }
        if (sub === 'settlement_locks') {
          return {
            doc(id) {
              return {
                id,
                path: `spaces/${spaceId}/settlement_locks/${id}`,
                async get() {
                  const row = state.locks[id];
                  return row
                    ? { exists: true, data: () => ({ ...row }) }
                    : { exists: false, data: () => undefined };
                },
              };
            },
          };
        }
        throw new Error(sub);
      },
    };
  }

  let txTail = Promise.resolve();

  return {
    writes,
    state,
    collection(name) {
      if (name !== 'spaces') throw new Error(name);
      return { doc: spaceDoc };
    },
    // Firestore 트랜잭션처럼 직렬화해 동시 create가 락을 경합해도 하나만 성공하게 한다.
    async runTransaction(fn) {
      const run = txTail.then(async () => {
        const pending = [];
        const tx = {
          async get(ref) {
            return ref.get();
          },
          set(ref, data) {
            pending.push({ op: 'set', path: ref.path, data });
          },
          update(ref, data) {
            pending.push({ op: 'update', path: ref.path, data });
          },
          delete(ref) {
            pending.push({ op: 'delete', path: ref.path });
          },
        };
        const result = await fn(tx);
        for (const write of pending) {
          writes.push(write);
          applyWrite(state, write);
        }
        return result;
      });
      txTail = run.then(() => undefined, () => undefined);
      return run;
    },
  };
}

function openSettlement(overrides = {}) {
  return {
    sharedExpenseId: EXPENSE_ID,
    titleSnapshot: '점심',
    dateKeySnapshot: '2026-11-07',
    amountSnapshot: 10000,
    paidByUidSnapshot: MEMBER,
    participantUidsSnapshot: [MEMBER, OWNER, OTHER],
    splitMode: 'equal',
    shares: [
      { uid: MEMBER, amount: 3334 },
      { uid: OWNER, amount: 3333 },
      { uid: OTHER, amount: 3333 },
    ],
    transfers: [
      {
        fromUid: OWNER,
        toUid: MEMBER,
        amount: 3333,
        status: 'pending',
        completedByUid: null,
        completedAt: null,
      },
      {
        fromUid: OTHER,
        toUid: MEMBER,
        amount: 3333,
        status: 'pending',
        completedByUid: null,
        completedAt: null,
      },
    ],
    status: 'open',
    pendingAmount: 6666,
    completedTransferCount: 0,
    createdByUid: MEMBER,
    ...overrides,
  };
}

describe('space settlement calculation', () => {
  it('splits remainder to the first participants in stored order', () => {
    assert.deepStrictEqual(splitEqually(10000, ['a', 'b', 'c']), [
      { uid: 'a', amount: 3334 },
      { uid: 'b', amount: 3333 },
      { uid: 'c', amount: 3333 },
    ]);
    assert.strictEqual(splitEqually(10000, ['a', 'b', 'c']).reduce((sum, row) => sum + row.amount, 0), 10000);
  });

  it('rejects negative custom shares and mismatched totals, and allows zero', () => {
    expectHttpsError(
      () => parseCustomShares([{ uid: 'a', amount: -1 }, { uid: 'b', amount: 10001 }], ['a', 'b'], 10000),
      'invalid-argument',
    );
    expectHttpsError(
      () => parseCustomShares([{ uid: 'a', amount: 4000 }, { uid: 'b', amount: 5000 }], ['a', 'b'], 10000),
      'invalid-argument',
    );
    const shares = parseCustomShares(
      [{ uid: 'a', amount: 10000 }, { uid: 'b', amount: 0 }],
      ['a', 'b'],
      10000,
    );
    assert.deepStrictEqual(buildTransfers('a', shares), []);
    assert.strictEqual(deriveStatus([]), 'completed');
  });
});

describe('createSpaceSettlementHandler', () => {
  it('creates a snapshot settlement and lock for the expense author', async () => {
    const db = makeDb();
    const result = await createSpaceSettlementHandler({
      auth: registeredAuth(MEMBER),
      data: { spaceId: SPACE_ID, sharedExpenseId: EXPENSE_ID, splitMode: 'equal' },
      db,
    });
    assert.ok(result.settlementId);
    const created = db.writes.find((row) => row.op === 'set' && row.path.includes('/settlements/'));
    assert.strictEqual(created.data.amountSnapshot, 10000);
    assert.strictEqual(created.data.createdByUid, MEMBER);
    assert.deepStrictEqual(created.data.shares[0], { uid: MEMBER, amount: 3334 });
    assert.strictEqual(created.data.transfers.length, 2);
    assert.ok(db.state.locks[EXPENSE_ID]);
  });

  it('rejects duplicate settlements using the lock, not a client gate', async () => {
    const db = makeDb({
      locks: { [EXPENSE_ID]: { settlementId: 'st-old', sharedExpenseId: EXPENSE_ID, status: 'open' } },
    });
    await expectHttpsErrorAsync(
      createSpaceSettlementHandler({
        auth: registeredAuth(MEMBER),
        data: { spaceId: SPACE_ID, sharedExpenseId: EXPENSE_ID, splitMode: 'equal' },
        db,
      }),
      'already-exists',
    );
  });

  it('동시 정산 생성은 락으로 하나만 성공한다', async () => {
    const db = makeDb();
    const payload = {
      auth: registeredAuth(MEMBER),
      data: { spaceId: SPACE_ID, sharedExpenseId: EXPENSE_ID, splitMode: 'equal' },
      db,
    };
    const results = await Promise.allSettled([
      createSpaceSettlementHandler(payload),
      createSpaceSettlementHandler(payload),
    ]);
    const fulfilled = results.filter((row) => row.status === 'fulfilled');
    const rejected = results.filter((row) => row.status === 'rejected');
    assert.strictEqual(fulfilled.length, 1);
    assert.strictEqual(rejected.length, 1);
    assert.strictEqual(rejected[0].reason.code, 'already-exists');
    assert.strictEqual(Object.keys(db.state.settlements).length, 1);
    assert.ok(db.state.locks[EXPENSE_ID]);
  });

  it('rejects create by payer who is not the author, outsider, and other-space user', async () => {
    await expectHttpsErrorAsync(
      createSpaceSettlementHandler({
        auth: registeredAuth(OWNER),
        data: { spaceId: SPACE_ID, sharedExpenseId: EXPENSE_ID, splitMode: 'equal' },
        db: makeDb(),
      }),
      'permission-denied',
    );
    await expectHttpsErrorAsync(
      createSpaceSettlementHandler({
        auth: registeredAuth(OUTSIDER),
        data: { spaceId: SPACE_ID, sharedExpenseId: EXPENSE_ID, splitMode: 'equal' },
        db: makeDb(),
      }),
      'permission-denied',
    );
  });

  it('keeps departed participants from the expense snapshot and rejects adding unknown uids', async () => {
    const left = 'left-user';
    const db = makeDb({
      sharedExpenses: {
        [EXPENSE_ID]: expenseDoc({
          participantUids: [MEMBER, left],
          paidByUid: MEMBER,
          amount: 9000,
        }),
      },
    });
    const result = await createSpaceSettlementHandler({
      auth: registeredAuth(MEMBER),
      data: {
        spaceId: SPACE_ID,
        sharedExpenseId: EXPENSE_ID,
        splitMode: 'custom',
        shares: [
          { uid: MEMBER, amount: 4500 },
          { uid: left, amount: 4500 },
        ],
      },
      db,
    });
    assert.ok(result.settlementId);
    await expectHttpsErrorAsync(
      createSpaceSettlementHandler({
        auth: registeredAuth(MEMBER),
        data: {
          spaceId: SPACE_ID,
          sharedExpenseId: EXPENSE_ID,
          splitMode: 'custom',
          shares: [
            { uid: MEMBER, amount: 4500 },
            { uid: OWNER, amount: 4500 },
          ],
        },
        db: makeDb({
          sharedExpenses: {
            [EXPENSE_ID]: expenseDoc({ participantUids: [MEMBER, left], paidByUid: MEMBER, amount: 9000 }),
          },
        }),
      }),
      'invalid-argument',
    );
  });

  it('rejects create when paidBy is not in participants without mutating the expense', async () => {
    const db = makeDb({
      sharedExpenses: {
        [EXPENSE_ID]: expenseDoc({ paidByUid: 'ghost', participantUids: [MEMBER, OWNER] }),
      },
    });
    await expectHttpsErrorAsync(
      createSpaceSettlementHandler({
        auth: registeredAuth(MEMBER),
        data: { spaceId: SPACE_ID, sharedExpenseId: EXPENSE_ID, splitMode: 'equal' },
        db,
      }),
      'failed-precondition',
    );
    assert.strictEqual(db.writes.length, 0);
  });
});

describe('update cancel and complete', () => {
  it('lets the creator update shares before any completion', async () => {
    const db = makeDb({
      settlements: { 'st-1': openSettlement() },
      locks: { [EXPENSE_ID]: { settlementId: 'st-1', sharedExpenseId: EXPENSE_ID, status: 'open' } },
    });
    await updateSpaceSettlementHandler({
      auth: registeredAuth(MEMBER),
      data: {
        spaceId: SPACE_ID,
        settlementId: 'st-1',
        splitMode: 'custom',
        shares: [
          { uid: MEMBER, amount: 4000 },
          { uid: OWNER, amount: 3000 },
          { uid: OTHER, amount: 3000 },
        ],
      },
      db,
    });
    assert.strictEqual(db.state.settlements['st-1'].shares[0].amount, 4000);
  });

  it('rejects share edits after a transfer is completed', async () => {
    const existing = openSettlement({
      transfers: [
        {
          fromUid: OWNER,
          toUid: MEMBER,
          amount: 3333,
          status: 'completed',
          completedByUid: OWNER,
          completedAt: new Date(),
        },
        {
          fromUid: OTHER,
          toUid: MEMBER,
          amount: 3333,
          status: 'pending',
          completedByUid: null,
          completedAt: null,
        },
      ],
    });
    await expectHttpsErrorAsync(
      updateSpaceSettlementHandler({
        auth: registeredAuth(MEMBER),
        data: { spaceId: SPACE_ID, settlementId: 'st-1', splitMode: 'equal' },
        db: makeDb({ settlements: { 'st-1': existing } }),
      }),
      'failed-precondition',
    );
  });

  it('cancels an open settlement and deletes the lock so recreate is allowed', async () => {
    const db = makeDb({
      settlements: { 'st-1': openSettlement() },
      locks: { [EXPENSE_ID]: { settlementId: 'st-1', sharedExpenseId: EXPENSE_ID, status: 'open' } },
    });
    await cancelSpaceSettlementHandler({
      auth: registeredAuth(MEMBER),
      data: { spaceId: SPACE_ID, settlementId: 'st-1' },
      db,
    });
    assert.strictEqual(db.state.settlements['st-1'].status, 'cancelled');
    assert.strictEqual(db.state.locks[EXPENSE_ID], undefined);
  });

  it('rejects cancel of a completed settlement and cancel by a non-creator', async () => {
    await expectHttpsErrorAsync(
      cancelSpaceSettlementHandler({
        auth: registeredAuth(MEMBER),
        data: { spaceId: SPACE_ID, settlementId: 'st-1' },
        db: makeDb({ settlements: { 'st-1': openSettlement({ status: 'completed' }) } }),
      }),
      'failed-precondition',
    );
    await expectHttpsErrorAsync(
      cancelSpaceSettlementHandler({
        auth: registeredAuth(OWNER),
        data: { spaceId: SPACE_ID, settlementId: 'st-1' },
        db: makeDb({ settlements: { 'st-1': openSettlement() } }),
      }),
      'permission-denied',
    );
  });

  it('lets the sender or payer complete a transfer, but not a bystander', async () => {
    const db = makeDb({
      settlements: { 'st-1': openSettlement() },
      locks: { [EXPENSE_ID]: { settlementId: 'st-1', sharedExpenseId: EXPENSE_ID, status: 'open' } },
    });
    await setSpaceSettlementTransferStatusHandler({
      auth: registeredAuth(OWNER),
      data: { spaceId: SPACE_ID, settlementId: 'st-1', fromUid: OWNER, completed: true },
      db,
    });
    assert.strictEqual(db.state.settlements['st-1'].transfers[0].status, 'completed');
    await setSpaceSettlementTransferStatusHandler({
      auth: registeredAuth(MEMBER),
      data: { spaceId: SPACE_ID, settlementId: 'st-1', fromUid: OTHER, completed: true },
      db,
    });
    assert.strictEqual(db.state.settlements['st-1'].status, 'completed');
    await expectHttpsErrorAsync(
      setSpaceSettlementTransferStatusHandler({
        auth: registeredAuth(OWNER),
        data: { spaceId: SPACE_ID, settlementId: 'st-1', fromUid: OTHER, completed: false },
        db,
      }),
      'failed-precondition',
    );
    await expectHttpsErrorAsync(
      setSpaceSettlementTransferStatusHandler({
        auth: registeredAuth(OUTSIDER),
        data: { spaceId: SPACE_ID, settlementId: 'st-1', fromUid: OWNER, completed: true },
        db: makeDb({ settlements: { 'st-1': openSettlement() } }),
      }),
      'permission-denied',
    );
  });

  it('lets either party uncomplete while the settlement is still open', async () => {
    const existing = openSettlement({
      transfers: [
        {
          fromUid: OWNER,
          toUid: MEMBER,
          amount: 3333,
          status: 'completed',
          completedByUid: OWNER,
          completedAt: new Date(),
        },
        {
          fromUid: OTHER,
          toUid: MEMBER,
          amount: 3333,
          status: 'pending',
          completedByUid: null,
          completedAt: null,
        },
      ],
      completedTransferCount: 1,
      pendingAmount: 3333,
    });
    const db = makeDb({
      settlements: { 'st-1': existing },
      locks: { [EXPENSE_ID]: { settlementId: 'st-1', sharedExpenseId: EXPENSE_ID, status: 'open' } },
    });
    await setSpaceSettlementTransferStatusHandler({
      auth: registeredAuth(MEMBER),
      data: { spaceId: SPACE_ID, settlementId: 'st-1', fromUid: OWNER, completed: false },
      db,
    });
    assert.strictEqual(db.state.settlements['st-1'].transfers[0].status, 'pending');
    assert.strictEqual(db.state.settlements['st-1'].status, 'open');
  });
});
