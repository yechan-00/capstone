const assert = require('assert');
const { HttpsError } = require('firebase-functions/v2/https');
const {
  AMOUNT_MAX,
  PARTICIPANT_MAX,
  PUBLIC_KEYS,
  parseAmount,
  parseDraft,
  createSpaceSharedExpenseHandler,
  updateSpaceSharedExpenseHandler,
} = require('../spaceSharedExpenses');

const OWNER = 'owner-1';
const MEMBER = 'member-1';
const OTHER = 'outsider-1';
const SPACE_ID = 'space-1';

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
    return;
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

function draft(overrides = {}) {
  return {
    spaceId: SPACE_ID,
    title: '점심',
    amount: 12000,
    dateKey: '2026-11-07',
    category: 'takeout',
    paidByUid: MEMBER,
    participantUids: [MEMBER, OWNER],
    memo: '',
    createdByUid: OTHER,
    expenseId: 'should-not-copy',
    ...overrides,
  };
}

function makeDb({
  space = { id: SPACE_ID, data: { status: 'active', ownerUid: OWNER } },
  members = { [OWNER]: { role: 'owner' }, [MEMBER]: { role: 'member' } },
  expenses = {},
  sharedExpenses = {},
  settlementLocks = {},
} = {}) {
  const writes = [];
  let autoId = 0;

  const db = {
    writes,
    collection(name) {
      if (name === 'spaces') {
        return {
          doc(spaceId) {
            return {
              id: spaceId,
              path: `spaces/${spaceId}`,
              async get() {
                if (space && space.id === spaceId) {
                  return { exists: true, data: () => ({ ...space.data }) };
                }
                return { exists: false, data: () => undefined };
              },
              collection(sub) {
                if (sub === 'space_members') {
                  return {
                    async get() {
                      const docs = Object.entries(members).map(([id, data]) => ({
                        id,
                        exists: true,
                        data: () => ({ ...data }),
                      }));
                      return { docs, size: docs.length };
                    },
                  };
                }
                if (sub === 'settlement_locks') {
                  return {
                    doc(lockId) {
                      const path = `spaces/${spaceId}/settlement_locks/${lockId}`;
                      return {
                        id: lockId,
                        path,
                        async get() {
                          const row = settlementLocks[lockId];
                          return row
                            ? { exists: true, id: lockId, data: () => ({ ...row }) }
                            : { exists: false, data: () => undefined };
                        },
                      };
                    },
                  };
                }
                if (sub === 'shared_expenses') {
                  return {
                    doc(id) {
                      const expenseId = id || `se-${++autoId}`;
                      const path = `spaces/${spaceId}/shared_expenses/${expenseId}`;
                      return {
                        id: expenseId,
                        path,
                        async get() {
                          const row = sharedExpenses[expenseId];
                          return row
                            ? { exists: true, id: expenseId, data: () => ({ ...row }) }
                            : { exists: false, data: () => undefined };
                        },
                        async update(data) {
                          writes.push({ op: 'update', path, data });
                          sharedExpenses[expenseId] = { ...(sharedExpenses[expenseId] || {}), ...data };
                        },
                      };
                    },
                  };
                }
                throw new Error(sub);
              },
            };
          },
        };
      }
      if (name === 'expenses') {
        return {
          doc(id) {
            return {
              id,
              path: `expenses/${id}`,
              async get() {
                const row = expenses[id];
                return row
                  ? { exists: true, data: () => ({ ...row }) }
                  : { exists: false, data: () => undefined };
              },
            };
          },
        };
      }
      if (name === 'accounts') {
        return {
          doc(accountId) {
            return {
              id: accountId,
              path: `accounts/${accountId}`,
              collection(sub) {
                if (sub !== 'space_expense_links') throw new Error(sub);
                return {
                  doc(linkId) {
                    return {
                      id: linkId,
                      path: `accounts/${accountId}/space_expense_links/${linkId}`,
                    };
                  },
                };
              },
            };
          },
        };
      }
      throw new Error(name);
    },
    batch() {
      const ops = [];
      return {
        set(ref, data) {
          ops.push({ op: 'set', path: ref.path, data });
        },
        update(ref, data) {
          ops.push({ op: 'update', path: ref.path, data });
        },
        async commit() {
          writes.push(...ops);
        },
      };
    },
  };
  return db;
}

describe('space shared expenses validation', () => {
  it('rejects zero, negative, decimal, and huge amounts', () => {
    expectHttpsError(() => parseAmount(0), 'invalid-argument');
    expectHttpsError(() => parseAmount(-2000), 'invalid-argument');
    expectHttpsError(() => parseAmount(1.5), 'invalid-argument');
    expectHttpsError(() => parseAmount('12.5'), 'invalid-argument');
    expectHttpsError(() => parseAmount(AMOUNT_MAX + 1), 'invalid-argument');
    assert.strictEqual(parseAmount(1), 1);
    assert.strictEqual(parseAmount('99000'), 99000);
  });

  it('rejects invalid dates and non-member paidBy on the draft', () => {
    expectHttpsError(() => parseDraft(draft({ dateKey: '2026-02-30' })), 'invalid-argument');
    expectHttpsError(() => parseDraft(draft({ paidByUid: OTHER })), 'invalid-argument');
    expectHttpsError(
      () => parseDraft(draft({ participantUids: Array.from({ length: PARTICIPANT_MAX + 1 }, (_, i) => `u${i}`) })),
      'invalid-argument',
    );
  });
});

describe('createSpaceSharedExpenseHandler', () => {
  it('writes a public copy without personal fields and ignores forged author uid', async () => {
    const db = makeDb();
    const result = await createSpaceSharedExpenseHandler({
      auth: registeredAuth(MEMBER),
      data: draft(),
      db,
    });
    assert.ok(result.sharedExpenseId);
    const write = db.writes.find((row) => row.path.includes('/shared_expenses/'));
    assert.ok(write);
    assert.deepStrictEqual(Object.keys(write.data).sort(), [...PUBLIC_KEYS].sort());
    assert.strictEqual(write.data.createdByUid, MEMBER);
    assert.strictEqual(write.data.expenseId, undefined);
    assert.strictEqual(write.data.reason, undefined);
    assert.strictEqual(db.writes.some((row) => row.path.startsWith('expenses/')), false);
  });

  it('stores the personal source link only on the author account', async () => {
    const db = makeDb({
      expenses: {
        'exp-1': { userId: MEMBER, accountId: `account_${MEMBER}`, amount: 4500, reason: '숨김' },
      },
    });
    const result = await createSpaceSharedExpenseHandler({
      auth: registeredAuth(MEMBER),
      data: draft({ sourceExpenseId: 'exp-1' }),
      db,
    });
    const shared = db.writes.find((row) => row.path.includes('/shared_expenses/'));
    const link = db.writes.find((row) => row.path.includes('/space_expense_links/'));
    assert.ok(shared);
    assert.ok(link);
    assert.strictEqual(shared.data.expenseId, undefined);
    assert.strictEqual(link.path, `accounts/account_${MEMBER}/space_expense_links/${SPACE_ID}_${result.sharedExpenseId}`);
    assert.strictEqual(link.data.expenseId, 'exp-1');
    assert.strictEqual(link.data.sharedExpenseId, result.sharedExpenseId);
    assert.strictEqual(db.writes.some((row) => row.op === 'update' && row.path.startsWith('expenses/')), false);
  });

  it('rejects another member\'s personal expense as the source', async () => {
    const db = makeDb({
      expenses: {
        'exp-2': { userId: OWNER, accountId: `account_${OWNER}` },
      },
    });
    await expectHttpsErrorAsync(
      createSpaceSharedExpenseHandler({
        auth: registeredAuth(MEMBER),
        data: draft({ sourceExpenseId: 'exp-2' }),
        db,
      }),
      'permission-denied',
    );
  });

  it('rejects a paidBy or participant who is not a current member', async () => {
    const db = makeDb();
    await expectHttpsErrorAsync(
      createSpaceSharedExpenseHandler({
        auth: registeredAuth(MEMBER),
        data: draft({ paidByUid: OTHER, participantUids: [MEMBER, OTHER] }),
        db,
      }),
      'invalid-argument',
    );
  });

  it('rejects non-members and other spaces', async () => {
    const db = makeDb();
    await expectHttpsErrorAsync(
      createSpaceSharedExpenseHandler({
        auth: registeredAuth(OTHER),
        data: draft({ paidByUid: OTHER, participantUids: [OTHER] }),
        db,
      }),
      'permission-denied',
    );
    await expectHttpsErrorAsync(
      createSpaceSharedExpenseHandler({
        auth: registeredAuth(MEMBER),
        data: draft({ spaceId: 'space-other' }),
        db,
      }),
      'not-found',
    );
  });
});

describe('updateSpaceSharedExpenseHandler', () => {
  it('lets only the author change mutable fields and never writes the personal expense', async () => {
    const db = makeDb({
      sharedExpenses: {
        'se-1': {
          title: '점심',
          amount: 1000,
          dateKey: '2026-11-01',
          category: 'takeout',
          paidByUid: MEMBER,
          participantUids: [MEMBER],
          memo: '',
          createdByUid: MEMBER,
        },
      },
      expenses: {
        'exp-1': { userId: MEMBER, amount: 1000, reason: '원본' },
      },
    });
    await updateSpaceSharedExpenseHandler({
      auth: registeredAuth(MEMBER),
      data: draft({ sharedExpenseId: 'se-1', title: '저녁', amount: 8000, sourceExpenseId: 'exp-1' }),
      db,
    });
    const write = db.writes.find((row) => row.op === 'update');
    assert.ok(write);
    assert.strictEqual(write.data.title, '저녁');
    assert.strictEqual(write.data.createdByUid, undefined);
    assert.strictEqual(write.data.createdAt, undefined);
    assert.strictEqual(db.writes.some((row) => row.path.startsWith('expenses/')), false);
  });

  it('keeps departed payer and participants when only title, memo, or amount change', async () => {
    const left = 'left-user';
    const db = makeDb({
      sharedExpenses: {
        'se-1': {
          title: '점심',
          amount: 1000,
          dateKey: '2026-11-01',
          category: 'takeout',
          paidByUid: left,
          participantUids: [MEMBER, left],
          memo: '원래',
          createdByUid: MEMBER,
        },
      },
    });
    await updateSpaceSharedExpenseHandler({
      auth: registeredAuth(MEMBER),
      data: draft({
        sharedExpenseId: 'se-1',
        title: '저녁',
        amount: 8000,
        memo: '메모만',
        paidByUid: left,
        participantUids: [MEMBER, left],
      }),
      db,
    });
    const write = db.writes.find((row) => row.op === 'update');
    assert.ok(write);
    assert.strictEqual(write.data.title, '저녁');
    assert.strictEqual(write.data.amount, 8000);
    assert.strictEqual(write.data.memo, '메모만');
    assert.strictEqual(write.data.paidByUid, left);
    assert.deepStrictEqual(write.data.participantUids, [MEMBER, left]);
    assert.strictEqual(db.writes.some((row) => row.path.startsWith('expenses/')), false);
  });

  it('allows adding a current member without dropping a departed participant', async () => {
    const left = 'left-user';
    const db = makeDb({
      sharedExpenses: {
        'se-1': {
          title: '점심',
          amount: 1000,
          dateKey: '2026-11-01',
          category: 'takeout',
          paidByUid: MEMBER,
          participantUids: [MEMBER, left],
          memo: '',
          createdByUid: MEMBER,
        },
      },
    });
    await updateSpaceSharedExpenseHandler({
      auth: registeredAuth(MEMBER),
      data: draft({
        sharedExpenseId: 'se-1',
        paidByUid: MEMBER,
        participantUids: [MEMBER, left, OWNER],
      }),
      db,
    });
    const write = db.writes.find((row) => row.op === 'update');
    assert.deepStrictEqual(write.data.participantUids, [MEMBER, left, OWNER]);
  });

  it('rejects adding a departed or other-space uid as a new participant or payer', async () => {
    const left = 'left-user';
    const db = makeDb({
      sharedExpenses: {
        'se-1': {
          title: '점심',
          amount: 1000,
          dateKey: '2026-11-01',
          category: 'takeout',
          paidByUid: MEMBER,
          participantUids: [MEMBER],
          memo: '',
          createdByUid: MEMBER,
        },
      },
    });
    await expectHttpsErrorAsync(
      updateSpaceSharedExpenseHandler({
        auth: registeredAuth(MEMBER),
        data: draft({
          sharedExpenseId: 'se-1',
          paidByUid: MEMBER,
          participantUids: [MEMBER, left],
        }),
        db,
      }),
      'invalid-argument',
    );
    await expectHttpsErrorAsync(
      updateSpaceSharedExpenseHandler({
        auth: registeredAuth(MEMBER),
        data: draft({
          sharedExpenseId: 'se-1',
          paidByUid: OTHER,
          participantUids: [MEMBER, OTHER],
        }),
        db,
      }),
      'invalid-argument',
    );
  });

  it('rejects updates after the author left the space', async () => {
    const db = makeDb({
      members: { [OWNER]: { role: 'owner' } },
      sharedExpenses: {
        'se-1': {
          title: '점심',
          amount: 1000,
          dateKey: '2026-11-01',
          category: 'takeout',
          paidByUid: MEMBER,
          participantUids: [MEMBER],
          memo: '',
          createdByUid: MEMBER,
        },
      },
    });
    await expectHttpsErrorAsync(
      updateSpaceSharedExpenseHandler({
        auth: registeredAuth(MEMBER),
        data: draft({ sharedExpenseId: 'se-1' }),
        db,
      }),
      'permission-denied',
    );
  });

  it('blocks amount payer and participant changes while an open settlement lock exists', async () => {
    const db = makeDb({
      sharedExpenses: {
        'se-1': {
          title: '점심',
          amount: 1000,
          dateKey: '2026-11-01',
          category: 'takeout',
          paidByUid: MEMBER,
          participantUids: [MEMBER, OWNER],
          memo: '',
          createdByUid: MEMBER,
        },
      },
      settlementLocks: {
        'se-1': { settlementId: 'st-1', sharedExpenseId: 'se-1', status: 'open' },
      },
    });
    await expectHttpsErrorAsync(
      updateSpaceSharedExpenseHandler({
        auth: registeredAuth(MEMBER),
        data: draft({ sharedExpenseId: 'se-1', amount: 2000 }),
        db,
      }),
      'failed-precondition',
    );
    await updateSpaceSharedExpenseHandler({
      auth: registeredAuth(MEMBER),
      data: draft({
        sharedExpenseId: 'se-1',
        title: '저녁',
        amount: 1000,
        memo: '제목만',
        paidByUid: MEMBER,
        participantUids: [MEMBER, OWNER],
      }),
      db,
    });
    const write = db.writes.find((row) => row.op === 'update');
    assert.strictEqual(write.data.title, '저녁');
    assert.strictEqual(write.data.amount, 1000);
  });

  it('rejects owner edits of another member\'s record', async () => {
    const db = makeDb({
      sharedExpenses: {
        'se-1': {
          title: '점심',
          amount: 1000,
          dateKey: '2026-11-01',
          category: 'takeout',
          paidByUid: MEMBER,
          participantUids: [MEMBER],
          memo: '',
          createdByUid: MEMBER,
        },
      },
    });
    await expectHttpsErrorAsync(
      updateSpaceSharedExpenseHandler({
        auth: registeredAuth(OWNER),
        data: draft({
          sharedExpenseId: 'se-1',
          paidByUid: OWNER,
          participantUids: [OWNER, MEMBER],
        }),
        db,
      }),
      'permission-denied',
    );
  });
});
