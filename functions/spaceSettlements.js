const { HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { requireRegisteredAuth } = require('./createSpace');
const { parseSpaceId } = require('./spaceMembers');

const AMOUNT_MIN = 0;
const AMOUNT_MAX = 99_999_999;
const EXPENSE_AMOUNT_MIN = 1;
const PARTICIPANT_MAX = 20;
const UID_MAX = 128;
const TITLE_MAX = 60;

function isUsableId(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= UID_MAX && !value.includes('/');
}

function parseShareAmount(raw) {
  if (typeof raw === 'number') {
    if (!Number.isInteger(raw) || !Number.isSafeInteger(raw) || raw < AMOUNT_MIN || raw > AMOUNT_MAX) {
      return null;
    }
    return raw;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!/^\d+$/.test(trimmed) || trimmed.length > 8) return null;
    const amount = Number(trimmed);
    if (!Number.isSafeInteger(amount) || amount < AMOUNT_MIN || amount > AMOUNT_MAX) return null;
    return amount;
  }
  return null;
}

function parseSplitMode(raw) {
  if (raw === 'equal' || raw === 'custom') return raw;
  throw new HttpsError('invalid-argument', '균등 분할 또는 직접 입력을 선택해 주세요.');
}

function existingUidList(raw) {
  if (!Array.isArray(raw)) return [];
  const uids = [];
  const seen = new Set();
  for (const item of raw) {
    if (!isUsableId(item) || seen.has(item)) continue;
    seen.add(item);
    uids.push(item);
  }
  return uids;
}

function sameUidList(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
  return a.every((uid, index) => uid === b[index]);
}

function splitEqually(total, participantUids) {
  if (!Number.isInteger(total) || total < EXPENSE_AMOUNT_MIN || total > AMOUNT_MAX) {
    throw new HttpsError('invalid-argument', '정산 금액을 확인할 수 없어요.');
  }
  if (!Array.isArray(participantUids) || participantUids.length < 1 || participantUids.length > PARTICIPANT_MAX) {
    throw new HttpsError('invalid-argument', '정산 참여자를 확인할 수 없어요.');
  }
  const n = participantUids.length;
  const base = Math.floor(total / n);
  const remainder = total - base * n;
  return participantUids.map((uid, index) => ({
    uid,
    amount: base + (index < remainder ? 1 : 0),
  }));
}

function parseCustomShares(raw, expectedUids, total) {
  if (!Array.isArray(raw) || raw.length !== expectedUids.length) {
    throw new HttpsError('invalid-argument', '참여자별 부담액을 다시 확인해 주세요.');
  }
  const expected = new Set(expectedUids);
  const seen = new Set();
  const shares = [];
  let sum = 0;
  for (const item of raw) {
    const uid = item?.uid;
    const amount = parseShareAmount(item?.amount);
    if (!isUsableId(uid) || seen.has(uid) || !expected.has(uid) || amount == null) {
      throw new HttpsError('invalid-argument', '참여자별 부담액을 다시 확인해 주세요.');
    }
    seen.add(uid);
    shares.push({ uid, amount });
    sum += amount;
  }
  if (seen.size !== expected.size || sum !== total) {
    throw new HttpsError('invalid-argument', '부담액 합계가 총금액과 같아야 해요.');
  }
  return shares;
}

function buildTransfers(paidByUid, shares) {
  if (!isUsableId(paidByUid) || !shares.some((row) => row.uid === paidByUid)) {
    throw new HttpsError('invalid-argument', '결제자는 정산 참여자에 포함되어야 해요.');
  }
  const transfers = [];
  for (const share of shares) {
    if (share.uid === paidByUid || share.amount === 0) continue;
    transfers.push({
      fromUid: share.uid,
      toUid: paidByUid,
      amount: share.amount,
      status: 'pending',
      completedByUid: null,
      completedAt: null,
    });
  }
  return transfers;
}

function pendingAmountOf(transfers) {
  return transfers.reduce((sum, row) => (row.status === 'pending' ? sum + row.amount : sum), 0);
}

function completedCountOf(transfers) {
  return transfers.filter((row) => row.status === 'completed').length;
}

function deriveStatus(transfers) {
  if (transfers.length === 0) return 'completed';
  return transfers.every((row) => row.status === 'completed') ? 'completed' : 'open';
}

function hasCompletedTransfer(transfers) {
  return Array.isArray(transfers) && transfers.some((row) => row.status === 'completed');
}

async function loadActiveSpaceMember(db, spaceId, uid) {
  const spaceRef = db.collection('spaces').doc(spaceId);
  const spaceSnap = await spaceRef.get();
  if (!spaceSnap.exists) {
    throw new HttpsError('not-found', '공간을 찾을 수 없어요.');
  }
  const space = spaceSnap.data() || {};
  if (space.status !== 'active') {
    throw new HttpsError('failed-precondition', '현재 이용할 수 없는 공간이에요.');
  }
  const memberSnap = await spaceRef.collection('space_members').doc(uid).get();
  if (!memberSnap.exists) {
    throw new HttpsError('permission-denied', '이 공간의 멤버만 정산을 이용할 수 있어요.');
  }
  return spaceRef;
}

function parseExpenseSnapshot(data) {
  const title = typeof data.title === 'string' ? data.title.trim() : '';
  if (!title || title.length > TITLE_MAX) {
    throw new HttpsError('failed-precondition', '공동 소비 내용을 확인할 수 없어요.');
  }
  const amount = parseShareAmount(data.amount);
  if (amount == null || amount < EXPENSE_AMOUNT_MIN) {
    throw new HttpsError('failed-precondition', '공동 소비 금액을 확인할 수 없어요.');
  }
  const participantUids = existingUidList(data.participantUids);
  if (participantUids.length < 1 || participantUids.length > PARTICIPANT_MAX) {
    throw new HttpsError('failed-precondition', '공동 소비 참여자를 확인할 수 없어요.');
  }
  const paidByUid = typeof data.paidByUid === 'string' ? data.paidByUid : '';
  if (!isUsableId(paidByUid) || !participantUids.includes(paidByUid)) {
    throw new HttpsError(
      'failed-precondition',
      '결제자가 참여자 목록에 없어 정산을 만들 수 없어요.',
    );
  }
  const dateKey = typeof data.dateKey === 'string' ? data.dateKey : '';
  const createdByUid = typeof data.createdByUid === 'string' ? data.createdByUid : '';
  if (!isUsableId(createdByUid)) {
    throw new HttpsError('failed-precondition', '공동 소비 작성자를 확인할 수 없어요.');
  }
  return { title, amount, dateKey, paidByUid, participantUids, createdByUid };
}

function settlementPayload({
  sharedExpenseId,
  snapshot,
  splitMode,
  shares,
  transfers,
  status,
  createdByUid,
  timestamps,
}) {
  return {
    sharedExpenseId,
    titleSnapshot: snapshot.title,
    dateKeySnapshot: snapshot.dateKey,
    amountSnapshot: snapshot.amount,
    paidByUidSnapshot: snapshot.paidByUid,
    participantUidsSnapshot: snapshot.participantUids,
    splitMode,
    shares,
    transfers,
    status,
    pendingAmount: pendingAmountOf(transfers),
    completedTransferCount: completedCountOf(transfers),
    createdByUid,
    createdAt: timestamps.createdAt,
    updatedAt: timestamps.updatedAt,
  };
}

function lockPayload(settlementId, sharedExpenseId, status, now) {
  return {
    settlementId,
    sharedExpenseId,
    status,
    updatedAt: now,
  };
}

async function createSpaceSettlementHandler({ auth, data, db }) {
  const uid = requireRegisteredAuth(auth);
  const spaceId = parseSpaceId(data?.spaceId);
  if (!isUsableId(data?.sharedExpenseId)) {
    throw new HttpsError('invalid-argument', '공동 소비를 확인할 수 없어요.');
  }
  const sharedExpenseId = data.sharedExpenseId.trim();
  const splitMode = parseSplitMode(data?.splitMode);
  const spaceRef = await loadActiveSpaceMember(db, spaceId, uid);
  const expenseRef = spaceRef.collection('shared_expenses').doc(sharedExpenseId);
  const lockRef = spaceRef.collection('settlement_locks').doc(sharedExpenseId);
  const settlementRef = spaceRef.collection('settlements').doc();
  const now = admin.firestore.FieldValue.serverTimestamp();

  try {
    await db.runTransaction(async (tx) => {
      const lockSnap = await tx.get(lockRef);
      const expenseSnap = await tx.get(expenseRef);
      if (lockSnap.exists) {
        throw new HttpsError('already-exists', '이미 이 소비에 대한 정산이 있어요.');
      }
      if (!expenseSnap.exists) {
        throw new HttpsError('not-found', '공동 소비를 찾을 수 없어요.');
      }
      const snapshot = parseExpenseSnapshot(expenseSnap.data() || {});
      if (snapshot.createdByUid !== uid) {
        throw new HttpsError('permission-denied', '공동 소비를 작성한 멤버만 정산을 시작할 수 있어요.');
      }
      const shares = splitMode === 'equal'
        ? splitEqually(snapshot.amount, snapshot.participantUids)
        : parseCustomShares(data?.shares, snapshot.participantUids, snapshot.amount);
      const transfers = buildTransfers(snapshot.paidByUid, shares);
      const status = deriveStatus(transfers);
      tx.set(
        settlementRef,
        settlementPayload({
          sharedExpenseId,
          snapshot,
          splitMode,
          shares,
          transfers,
          status,
          createdByUid: uid,
          timestamps: { createdAt: now, updatedAt: now },
        }),
      );
      tx.set(lockRef, lockPayload(settlementRef.id, sharedExpenseId, status === 'completed' ? 'completed' : 'open', now));
    });
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('[createSpaceSettlement]', error);
    throw new HttpsError('internal', '정산을 만들지 못했어요. 잠시 후 다시 시도해 주세요.');
  }
  return { spaceId, settlementId: settlementRef.id };
}

async function updateSpaceSettlementHandler({ auth, data, db }) {
  const uid = requireRegisteredAuth(auth);
  const spaceId = parseSpaceId(data?.spaceId);
  if (!isUsableId(data?.settlementId)) {
    throw new HttpsError('invalid-argument', '정산을 확인할 수 없어요.');
  }
  const settlementId = data.settlementId.trim();
  const splitMode = parseSplitMode(data?.splitMode);
  const spaceRef = await loadActiveSpaceMember(db, spaceId, uid);
  const settlementRef = spaceRef.collection('settlements').doc(settlementId);
  const now = admin.firestore.FieldValue.serverTimestamp();

  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(settlementRef);
      if (!snap.exists) {
        throw new HttpsError('not-found', '정산을 찾을 수 없어요.');
      }
      const existing = snap.data() || {};
      if (existing.createdByUid !== uid) {
        throw new HttpsError('permission-denied', '정산을 만든 멤버만 수정할 수 있어요.');
      }
      if (existing.status === 'cancelled') {
        throw new HttpsError('failed-precondition', '취소된 정산은 수정할 수 없어요.');
      }
      if (existing.status === 'completed') {
        throw new HttpsError('failed-precondition', '완료된 정산은 수정할 수 없어요.');
      }
      if (hasCompletedTransfer(existing.transfers)) {
        throw new HttpsError('failed-precondition', '일부 완료된 정산은 부담액을 바꿀 수 없어요.');
      }
      const snapshot = {
        title: existing.titleSnapshot,
        dateKey: existing.dateKeySnapshot,
        amount: existing.amountSnapshot,
        paidByUid: existing.paidByUidSnapshot,
        participantUids: existingUidList(existing.participantUidsSnapshot),
      };
      const shares = splitMode === 'equal'
        ? splitEqually(snapshot.amount, snapshot.participantUids)
        : parseCustomShares(data?.shares, snapshot.participantUids, snapshot.amount);
      const transfers = buildTransfers(snapshot.paidByUid, shares);
      const status = deriveStatus(transfers);
      tx.update(settlementRef, {
        splitMode,
        shares,
        transfers,
        status,
        pendingAmount: pendingAmountOf(transfers),
        completedTransferCount: completedCountOf(transfers),
        updatedAt: now,
      });
      const lockRef = spaceRef.collection('settlement_locks').doc(existing.sharedExpenseId);
      tx.set(lockRef, lockPayload(settlementId, existing.sharedExpenseId, status === 'completed' ? 'completed' : 'open', now));
    });
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('[updateSpaceSettlement]', error);
    throw new HttpsError('internal', '정산을 수정하지 못했어요. 잠시 후 다시 시도해 주세요.');
  }
  return { spaceId, settlementId };
}

async function cancelSpaceSettlementHandler({ auth, data, db }) {
  const uid = requireRegisteredAuth(auth);
  const spaceId = parseSpaceId(data?.spaceId);
  if (!isUsableId(data?.settlementId)) {
    throw new HttpsError('invalid-argument', '정산을 확인할 수 없어요.');
  }
  const settlementId = data.settlementId.trim();
  const spaceRef = await loadActiveSpaceMember(db, spaceId, uid);
  const settlementRef = spaceRef.collection('settlements').doc(settlementId);
  const now = admin.firestore.FieldValue.serverTimestamp();

  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(settlementRef);
      if (!snap.exists) {
        throw new HttpsError('not-found', '정산을 찾을 수 없어요.');
      }
      const existing = snap.data() || {};
      if (existing.createdByUid !== uid) {
        throw new HttpsError('permission-denied', '정산을 만든 멤버만 취소할 수 있어요.');
      }
      if (existing.status === 'cancelled') {
        throw new HttpsError('failed-precondition', '이미 취소된 정산이에요.');
      }
      if (existing.status === 'completed') {
        throw new HttpsError('failed-precondition', '완료된 정산은 취소할 수 없어요.');
      }
      tx.update(settlementRef, {
        status: 'cancelled',
        updatedAt: now,
      });
      if (isUsableId(existing.sharedExpenseId)) {
        tx.delete(spaceRef.collection('settlement_locks').doc(existing.sharedExpenseId));
      }
    });
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('[cancelSpaceSettlement]', error);
    throw new HttpsError('internal', '정산을 취소하지 못했어요. 잠시 후 다시 시도해 주세요.');
  }
  return { spaceId, settlementId };
}

async function setSpaceSettlementTransferStatusHandler({ auth, data, db }) {
  const uid = requireRegisteredAuth(auth);
  const spaceId = parseSpaceId(data?.spaceId);
  if (!isUsableId(data?.settlementId) || !isUsableId(data?.fromUid)) {
    throw new HttpsError('invalid-argument', '정산 대상을 확인할 수 없어요.');
  }
  if (typeof data?.completed !== 'boolean') {
    throw new HttpsError('invalid-argument', '완료 여부를 확인해 주세요.');
  }
  const settlementId = data.settlementId.trim();
  const fromUid = data.fromUid.trim();
  const completed = data.completed;
  const spaceRef = await loadActiveSpaceMember(db, spaceId, uid);
  const settlementRef = spaceRef.collection('settlements').doc(settlementId);
  const now = admin.firestore.FieldValue.serverTimestamp();

  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(settlementRef);
      if (!snap.exists) {
        throw new HttpsError('not-found', '정산을 찾을 수 없어요.');
      }
      const existing = snap.data() || {};
      if (existing.status === 'cancelled') {
        throw new HttpsError('failed-precondition', '취소된 정산은 완료 처리할 수 없어요.');
      }
      if (!completed && existing.status === 'completed') {
        throw new HttpsError('failed-precondition', '모두 완료된 정산은 되돌릴 수 없어요.');
      }
      const transfers = Array.isArray(existing.transfers) ? existing.transfers.map((row) => ({ ...row })) : [];
      const index = transfers.findIndex((row) => row.fromUid === fromUid);
      if (index < 0) {
        throw new HttpsError('not-found', '정산 대상을 찾을 수 없어요.');
      }
      const transfer = transfers[index];
      if (uid !== transfer.fromUid && uid !== transfer.toUid) {
        throw new HttpsError('permission-denied', '송금할 사람 또는 받을 사람만 완료 처리할 수 있어요.');
      }
      if (completed) {
        transfers[index] = {
          ...transfer,
          status: 'completed',
          completedByUid: uid,
          completedAt: now,
        };
      } else {
        transfers[index] = {
          ...transfer,
          status: 'pending',
          completedByUid: null,
          completedAt: null,
        };
      }
      const status = deriveStatus(transfers);
      tx.update(settlementRef, {
        transfers,
        status,
        pendingAmount: pendingAmountOf(transfers),
        completedTransferCount: completedCountOf(transfers),
        updatedAt: now,
      });
      if (isUsableId(existing.sharedExpenseId)) {
        const lockRef = spaceRef.collection('settlement_locks').doc(existing.sharedExpenseId);
        tx.set(lockRef, lockPayload(settlementId, existing.sharedExpenseId, status === 'completed' ? 'completed' : 'open', now));
      }
    });
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    console.error('[setSpaceSettlementTransferStatus]', error);
    throw new HttpsError('internal', '정산 상태를 바꾸지 못했어요. 잠시 후 다시 시도해 주세요.');
  }
  return { spaceId, settlementId };
}

function settlementFieldsChanged(existing, draft) {
  if (existing.amount !== draft.amount) return true;
  if (existing.paidByUid !== draft.paidByUid) return true;
  return !sameUidList(existingUidList(existing.participantUids), draft.participantUids);
}

async function assertNoOpenSettlementLock(spaceRef, sharedExpenseId, existing, draft) {
  const lockSnap = await spaceRef.collection('settlement_locks').doc(sharedExpenseId).get();
  if (!lockSnap.exists) return;
  const lock = lockSnap.data() || {};
  if (lock.status !== 'open') return;
  if (settlementFieldsChanged(existing, draft)) {
    throw new HttpsError(
      'failed-precondition',
      '진행 중인 정산이 있어 금액·결제자·참여자를 바꿀 수 없어요. 정산을 먼저 취소해 주세요.',
    );
  }
}

module.exports = {
  AMOUNT_MAX,
  splitEqually,
  parseCustomShares,
  buildTransfers,
  deriveStatus,
  sameUidList,
  settlementFieldsChanged,
  assertNoOpenSettlementLock,
  createSpaceSettlementHandler,
  updateSpaceSettlementHandler,
  cancelSpaceSettlementHandler,
  setSpaceSettlementTransferStatusHandler,
};
