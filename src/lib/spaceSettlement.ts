export const SPACE_SETTLEMENTS_COLLECTION = 'settlements';
export const SPACE_SETTLEMENT_LOCKS_COLLECTION = 'settlement_locks';
export const SPACE_SETTLEMENT_PAGE_SIZE = 20;
export const SPACE_SETTLEMENT_AUTHOR_FALLBACK_NAME = '이름 없음';
export const SETTLEMENT_AMOUNT_MIN = 0;
export const SETTLEMENT_AMOUNT_MAX = 99_999_999;
export const SETTLEMENT_PARTICIPANT_MAX = 20;

const UID_MAX = 128;

export type SettlementSplitMode = 'equal' | 'custom';
export type SettlementStatus = 'open' | 'completed' | 'cancelled';
export type SettlementTransferStatus = 'pending' | 'completed';

export type SettlementShare = {
  uid: string;
  amount: number;
};

export type SettlementTransfer = {
  fromUid: string;
  toUid: string;
  amount: number;
  status: SettlementTransferStatus;
  completedByUid: string | null;
  completedAt: Date | null;
};

export type SpaceSettlement = {
  id: string;
  sharedExpenseId: string;
  titleSnapshot: string;
  dateKeySnapshot: string;
  amountSnapshot: number;
  paidByUidSnapshot: string;
  participantUidsSnapshot: string[];
  splitMode: SettlementSplitMode;
  shares: SettlementShare[];
  transfers: SettlementTransfer[];
  status: SettlementStatus;
  pendingAmount: number;
  completedTransferCount: number;
  createdByUid: string;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type SpaceSettlementLock = {
  settlementId: string;
  sharedExpenseId: string;
  status: 'open' | 'completed';
};

export type SettlementSummary = {
  openCount: number;
  completedCount: number;
  unpaidTotal: number;
  myToSend: number;
  myToReceive: number;
};

type MemberSource = {
  uid: string;
  displayName: string;
  photoURL?: string;
};

function timestampToDateOrNull(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    try {
      const date = (value as { toDate: () => Date }).toDate();
      return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
    } catch {
      return null;
    }
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

export function isUsableSettlementId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= UID_MAX && !value.includes('/');
}

export function parseSettlementShareAmount(raw: unknown): number | null {
  if (typeof raw === 'number') {
    if (!Number.isInteger(raw) || !Number.isSafeInteger(raw)) return null;
    if (raw < SETTLEMENT_AMOUNT_MIN || raw > SETTLEMENT_AMOUNT_MAX) return null;
    return raw;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (trimmed === '') return null;
    if (!/^\d+$/.test(trimmed) || trimmed.length > 8) return null;
    const amount = Number(trimmed);
    if (!Number.isSafeInteger(amount)) return null;
    if (amount < SETTLEMENT_AMOUNT_MIN || amount > SETTLEMENT_AMOUNT_MAX) return null;
    return amount;
  }
  return null;
}

/**
 * 균등 분할. 나머지는 participantUids 앞쪽부터 1원씩 준다.
 * 10,000 / 3 → 3,334 / 3,333 / 3,333
 */
export function splitEqually(total: number, participantUids: string[]): SettlementShare[] | null {
  if (!Number.isInteger(total) || total < 1 || total > SETTLEMENT_AMOUNT_MAX) return null;
  if (!Array.isArray(participantUids) || participantUids.length < 1 || participantUids.length > SETTLEMENT_PARTICIPANT_MAX) {
    return null;
  }
  const seen = new Set<string>();
  for (const uid of participantUids) {
    if (!isUsableSettlementId(uid) || seen.has(uid)) return null;
    seen.add(uid);
  }
  const n = participantUids.length;
  const base = Math.floor(total / n);
  const remainder = total - base * n;
  return participantUids.map((uid, index) => ({
    uid,
    amount: base + (index < remainder ? 1 : 0),
  }));
}

export function sharesSum(shares: SettlementShare[]): number {
  return shares.reduce((sum, row) => sum + row.amount, 0);
}

export function parseSettlementShares(
  raw: unknown,
  expectedUids: string[],
): SettlementShare[] | null {
  if (!Array.isArray(raw) || raw.length !== expectedUids.length) return null;
  const expected = new Set(expectedUids);
  if (expected.size !== expectedUids.length) return null;
  const shares: SettlementShare[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const row = asRecord(item);
    if (!row) return null;
    if (!isUsableSettlementId(row.uid) || seen.has(row.uid) || !expected.has(row.uid)) return null;
    const amount = parseSettlementShareAmount(row.amount);
    if (amount == null) return null;
    seen.add(row.uid);
    shares.push({ uid: row.uid, amount });
  }
  if (seen.size !== expected.size) return null;
  return shares;
}

export function buildSettlementTransfers(
  paidByUid: string,
  shares: SettlementShare[],
): SettlementTransfer[] | null {
  if (!isUsableSettlementId(paidByUid)) return null;
  const paidByShare = shares.find((row) => row.uid === paidByUid);
  if (!paidByShare) return null;
  const transfers: SettlementTransfer[] = [];
  for (const share of shares) {
    if (share.uid === paidByUid) continue;
    if (share.amount === 0) continue;
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

export function settlementPendingAmount(transfers: SettlementTransfer[]): number {
  return transfers.reduce((sum, row) => (row.status === 'pending' ? sum + row.amount : sum), 0);
}

export function settlementCompletedTransferCount(transfers: SettlementTransfer[]): number {
  return transfers.filter((row) => row.status === 'completed').length;
}

export function deriveSettlementStatus(transfers: SettlementTransfer[]): Exclude<SettlementStatus, 'cancelled'> {
  if (transfers.length === 0) return 'completed';
  return transfers.every((row) => row.status === 'completed') ? 'completed' : 'open';
}

export function isValidCustomShares(total: number, expectedUids: string[], shares: SettlementShare[]): boolean {
  if (sharesSum(shares) !== total) return false;
  if (shares.length !== expectedUids.length) return false;
  const expected = new Set(expectedUids);
  const seen = new Set<string>();
  for (const share of shares) {
    if (!expected.has(share.uid) || seen.has(share.uid)) return false;
    if (parseSettlementShareAmount(share.amount) == null) return false;
    seen.add(share.uid);
  }
  return seen.size === expected.size;
}

function parseSplitMode(raw: unknown): SettlementSplitMode | null {
  if (raw === 'equal' || raw === 'custom') return raw;
  return null;
}

function parseStatus(raw: unknown): SettlementStatus | null {
  if (raw === 'open' || raw === 'completed' || raw === 'cancelled') return raw;
  return null;
}

function parseTransferStatus(raw: unknown): SettlementTransferStatus | null {
  if (raw === 'pending' || raw === 'completed') return raw;
  return null;
}

function parseTransfers(raw: unknown, paidByUid: string): SettlementTransfer[] | null {
  if (!Array.isArray(raw)) return null;
  const transfers: SettlementTransfer[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const row = asRecord(item);
    if (!row) return null;
    if (!isUsableSettlementId(row.fromUid) || row.fromUid === paidByUid) return null;
    if (row.toUid !== paidByUid) return null;
    if (seen.has(row.fromUid)) return null;
    const amount = parseSettlementShareAmount(row.amount);
    if (amount == null || amount < 1) return null;
    const status = parseTransferStatus(row.status);
    if (!status) return null;
    const completedByUid = row.completedByUid == null ? null : row.completedByUid;
    if (completedByUid != null && !isUsableSettlementId(completedByUid)) return null;
    if (status === 'pending' && (completedByUid != null || row.completedAt != null)) return null;
    if (status === 'completed' && !completedByUid) return null;
    seen.add(row.fromUid);
    transfers.push({
      fromUid: row.fromUid,
      toUid: paidByUid,
      amount,
      status,
      completedByUid,
      completedAt: timestampToDateOrNull(row.completedAt),
    });
  }
  return transfers;
}

export function parseSpaceSettlement(id: string, data: unknown): SpaceSettlement | null {
  if (!isUsableSettlementId(id)) return null;
  const row = asRecord(data);
  if (!row) return null;
  if (!isUsableSettlementId(row.sharedExpenseId)) return null;
  if (typeof row.titleSnapshot !== 'string' || row.titleSnapshot.trim().length === 0) return null;
  if (typeof row.dateKeySnapshot !== 'string') return null;
  const amountSnapshot = parseSettlementShareAmount(row.amountSnapshot);
  if (amountSnapshot == null || amountSnapshot < 1) return null;
  if (!isUsableSettlementId(row.paidByUidSnapshot)) return null;
  if (!Array.isArray(row.participantUidsSnapshot)) return null;
  const participantUids = row.participantUidsSnapshot.filter((uid) => isUsableSettlementId(uid));
  if (participantUids.length !== row.participantUidsSnapshot.length) return null;
  if (!participantUids.includes(row.paidByUidSnapshot)) return null;
  const splitMode = parseSplitMode(row.splitMode);
  const status = parseStatus(row.status);
  if (!splitMode || !status) return null;
  if (!isUsableSettlementId(row.createdByUid)) return null;
  const shares = parseSettlementShares(row.shares, participantUids);
  if (!shares || sharesSum(shares) !== amountSnapshot) return null;
  const transfers = parseTransfers(row.transfers, row.paidByUidSnapshot);
  if (!transfers) return null;
  return {
    id,
    sharedExpenseId: row.sharedExpenseId,
    titleSnapshot: row.titleSnapshot.trim(),
    dateKeySnapshot: row.dateKeySnapshot,
    amountSnapshot,
    paidByUidSnapshot: row.paidByUidSnapshot,
    participantUidsSnapshot: participantUids,
    splitMode,
    shares,
    transfers,
    status,
    pendingAmount: settlementPendingAmount(transfers),
    completedTransferCount: settlementCompletedTransferCount(transfers),
    createdByUid: row.createdByUid,
    createdAt: timestampToDateOrNull(row.createdAt),
    updatedAt: timestampToDateOrNull(row.updatedAt),
  };
}

export function parseSpaceSettlementLock(data: unknown): SpaceSettlementLock | null {
  const row = asRecord(data);
  if (!row) return null;
  if (!isUsableSettlementId(row.settlementId) || !isUsableSettlementId(row.sharedExpenseId)) return null;
  if (row.status !== 'open' && row.status !== 'completed') return null;
  return {
    settlementId: row.settlementId,
    sharedExpenseId: row.sharedExpenseId,
    status: row.status,
  };
}

export function settlementOverallLabel(status: SettlementStatus, transfers: SettlementTransfer[]): string {
  if (status === 'cancelled') return '취소됨';
  if (status === 'completed' || (transfers.length > 0 && transfers.every((row) => row.status === 'completed'))) {
    return '정산 완료';
  }
  if (transfers.some((row) => row.status === 'completed')) return '일부 완료';
  if (transfers.length === 0) return '정산 완료';
  return '미정산';
}

export function summarizeSettlements(rows: SpaceSettlement[], viewerUid: string | null): SettlementSummary {
  let openCount = 0;
  let completedCount = 0;
  let unpaidTotal = 0;
  let myToSend = 0;
  let myToReceive = 0;
  for (const row of rows) {
    if (row.status === 'cancelled') continue;
    if (row.status === 'completed') completedCount += 1;
    else openCount += 1;
    for (const transfer of row.transfers) {
      if (transfer.status !== 'pending') continue;
      unpaidTotal += transfer.amount;
      if (viewerUid && transfer.fromUid === viewerUid) myToSend += transfer.amount;
      if (viewerUid && transfer.toUid === viewerUid) myToReceive += transfer.amount;
    }
  }
  return { openCount, completedCount, unpaidTotal, myToSend, myToReceive };
}

export function expenseDiffersFromSettlement(
  expense: {
    title: string;
    amount: number;
    paidByUid: string;
    participantUids: string[];
  } | null,
  settlement: SpaceSettlement,
): boolean {
  if (!expense) return false;
  if (expense.amount !== settlement.amountSnapshot) return true;
  if (expense.paidByUid !== settlement.paidByUidSnapshot) return true;
  if (expense.participantUids.length !== settlement.participantUidsSnapshot.length) return true;
  return expense.participantUids.some((uid, index) => uid !== settlement.participantUidsSnapshot[index]);
}

export function sameUidList(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((uid, index) => uid === b[index]);
}

export function canCreateSpaceSettlement(expenseCreatedByUid: string, viewerUid: string | null): boolean {
  return Boolean(expenseCreatedByUid && viewerUid && expenseCreatedByUid === viewerUid);
}

export function canEditOrCancelSpaceSettlement(createdByUid: string, viewerUid: string | null): boolean {
  return Boolean(createdByUid && viewerUid && createdByUid === viewerUid);
}

export function settlementHasCompletedTransfer(transfers: SettlementTransfer[]): boolean {
  return transfers.some((row) => row.status === 'completed');
}

export function canCompleteSettlementTransfer(
  transfer: SettlementTransfer,
  viewerUid: string | null,
): boolean {
  return Boolean(viewerUid && (transfer.fromUid === viewerUid || transfer.toUid === viewerUid));
}

export function compareSpaceSettlements(a: SpaceSettlement, b: SpaceSettlement): number {
  const aCreated = a.createdAt?.getTime() ?? 0;
  const bCreated = b.createdAt?.getTime() ?? 0;
  if (aCreated !== bCreated) return bCreated - aCreated;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function sortSpaceSettlements(rows: SpaceSettlement[]): SpaceSettlement[] {
  return [...rows].sort(compareSpaceSettlements);
}

export function resolveSettlementMember(
  uid: string,
  members: MemberSource[],
): { uid: string; displayName: string; photoURL?: string } {
  const member = members.find((row) => row.uid === uid);
  if (!member) {
    return { uid, displayName: SPACE_SETTLEMENT_AUTHOR_FALLBACK_NAME };
  }
  return {
    uid: member.uid,
    displayName: member.displayName || SPACE_SETTLEMENT_AUTHOR_FALLBACK_NAME,
    photoURL: member.photoURL,
  };
}

export function formatSettlementAmount(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}
