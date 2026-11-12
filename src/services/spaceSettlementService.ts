import { httpsCallable } from 'firebase/functions';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  startAfter,
  where,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { auth, db, functions } from '@/lib/firebase';
import { SPACES_COLLECTION } from '@/lib/spaceList';
import {
  SPACE_SETTLEMENTS_COLLECTION,
  SPACE_SETTLEMENT_LOCKS_COLLECTION,
  SPACE_SETTLEMENT_PAGE_SIZE,
  parseSpaceSettlement,
  parseSpaceSettlementLock,
  sortSpaceSettlements,
  summarizeSettlements,
  type SettlementShare,
  type SettlementSplitMode,
  type SpaceSettlement,
  type SpaceSettlementLock,
} from '@/lib/spaceSettlement';
import {
  CANCEL_SPACE_SETTLEMENT_FN,
  CREATE_SPACE_SETTLEMENT_FN,
  SET_SPACE_SETTLEMENT_TRANSFER_STATUS_FN,
  SpaceSettlementError,
  UPDATE_SPACE_SETTLEMENT_FN,
  parseCreateSettlementResult,
  parseMutationSettlementResult,
  toSpaceSettlementError,
} from '@/lib/spaceSettlementClient';

function requireUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new SpaceSettlementError('unauthenticated');
  return uid;
}

function isUsableId(value: string | undefined): value is string {
  return typeof value === 'string' && value.length > 0 && !value.includes('/');
}

function settlementsCol(spaceId: string) {
  return collection(db, SPACES_COLLECTION, spaceId, SPACE_SETTLEMENTS_COLLECTION);
}

function settlementRef(spaceId: string, settlementId: string) {
  return doc(db, SPACES_COLLECTION, spaceId, SPACE_SETTLEMENTS_COLLECTION, settlementId);
}

function lockRef(spaceId: string, sharedExpenseId: string) {
  return doc(db, SPACES_COLLECTION, spaceId, SPACE_SETTLEMENT_LOCKS_COLLECTION, sharedExpenseId);
}

export async function getSpaceSettlementLock(
  spaceId: string,
  sharedExpenseId: string,
): Promise<SpaceSettlementLock | null> {
  requireUid();
  if (!isUsableId(spaceId) || !isUsableId(sharedExpenseId)) {
    throw new SpaceSettlementError('invalid-argument');
  }
  try {
    const snap = await getDoc(lockRef(spaceId, sharedExpenseId));
    if (!snap.exists()) return null;
    return parseSpaceSettlementLock(snap.data());
  } catch (error) {
    throw toSpaceSettlementError(error, 'read');
  }
}

export async function getSpaceSettlement(spaceId: string, settlementId: string): Promise<SpaceSettlement> {
  requireUid();
  if (!isUsableId(spaceId) || !isUsableId(settlementId)) {
    throw new SpaceSettlementError('invalid-argument');
  }
  try {
    const snap = await getDoc(settlementRef(spaceId, settlementId));
    if (!snap.exists()) throw new SpaceSettlementError('not-found');
    const parsed = parseSpaceSettlement(snap.id, snap.data());
    if (!parsed) throw new SpaceSettlementError('not-found');
    return parsed;
  } catch (error) {
    throw toSpaceSettlementError(error, 'read');
  }
}

export type SpaceSettlementPage = {
  settlements: SpaceSettlement[];
  cursor: QueryDocumentSnapshot | null;
  hasMore: boolean;
};

export async function listSpaceSettlementsPage(
  spaceId: string,
  cursor: DocumentSnapshot | null = null,
): Promise<SpaceSettlementPage> {
  requireUid();
  if (!isUsableId(spaceId)) throw new SpaceSettlementError('invalid-argument');
  try {
    const pageQuery = cursor
      ? query(
          settlementsCol(spaceId),
          orderBy('createdAt', 'desc'),
          startAfter(cursor),
          limit(SPACE_SETTLEMENT_PAGE_SIZE),
        )
      : query(
          settlementsCol(spaceId),
          orderBy('createdAt', 'desc'),
          limit(SPACE_SETTLEMENT_PAGE_SIZE),
        );
    const snap = await getDocs(pageQuery);
    const settlements: SpaceSettlement[] = [];
    for (const row of snap.docs) {
      const parsed = parseSpaceSettlement(row.id, row.data());
      if (parsed) settlements.push(parsed);
    }
    const last = snap.docs[snap.docs.length - 1] ?? null;
    return {
      settlements,
      cursor: last,
      hasMore: snap.docs.length === SPACE_SETTLEMENT_PAGE_SIZE,
    };
  } catch (error) {
    throw toSpaceSettlementError(error, 'read');
  }
}

export async function listSpaceSettlementsForSummary(spaceId: string): Promise<SpaceSettlement[]> {
  requireUid();
  if (!isUsableId(spaceId)) throw new SpaceSettlementError('invalid-argument');
  try {
    const [openSnap, completedSnap] = await Promise.all([
      getDocs(query(settlementsCol(spaceId), where('status', '==', 'open'))),
      getDocs(query(settlementsCol(spaceId), where('status', '==', 'completed'))),
    ]);
    const rows: SpaceSettlement[] = [];
    for (const row of [...openSnap.docs, ...completedSnap.docs]) {
      const parsed = parseSpaceSettlement(row.id, row.data());
      if (parsed) rows.push(parsed);
    }
    return sortSpaceSettlements(rows);
  } catch (error) {
    throw toSpaceSettlementError(error, 'read');
  }
}

export function settlementSummaryForViewer(rows: SpaceSettlement[], viewerUid: string | null) {
  return summarizeSettlements(rows, viewerUid);
}

export async function createSpaceSettlement(
  spaceId: string,
  sharedExpenseId: string,
  splitMode: SettlementSplitMode,
  shares?: SettlementShare[],
): Promise<string> {
  requireUid();
  if (!isUsableId(spaceId) || !isUsableId(sharedExpenseId)) {
    throw new SpaceSettlementError('invalid-argument');
  }
  try {
    const call = httpsCallable<
      { spaceId: string; sharedExpenseId: string; splitMode: SettlementSplitMode; shares?: SettlementShare[] },
      unknown
    >(functions, CREATE_SPACE_SETTLEMENT_FN);
    const result = await call({
      spaceId,
      sharedExpenseId,
      splitMode,
      ...(splitMode === 'custom' && shares ? { shares } : {}),
    });
    const parsed = parseCreateSettlementResult(result.data);
    if (!parsed) throw new SpaceSettlementError('unavailable');
    return parsed.settlementId;
  } catch (error) {
    throw toSpaceSettlementError(error, 'create');
  }
}

export async function updateSpaceSettlement(
  spaceId: string,
  settlementId: string,
  splitMode: SettlementSplitMode,
  shares?: SettlementShare[],
): Promise<void> {
  requireUid();
  if (!isUsableId(spaceId) || !isUsableId(settlementId)) {
    throw new SpaceSettlementError('invalid-argument');
  }
  try {
    const call = httpsCallable<
      { spaceId: string; settlementId: string; splitMode: SettlementSplitMode; shares?: SettlementShare[] },
      unknown
    >(functions, UPDATE_SPACE_SETTLEMENT_FN);
    const result = await call({
      spaceId,
      settlementId,
      splitMode,
      ...(splitMode === 'custom' && shares ? { shares } : {}),
    });
    if (!parseMutationSettlementResult(result.data)) {
      throw new SpaceSettlementError('unavailable');
    }
  } catch (error) {
    throw toSpaceSettlementError(error, 'write');
  }
}

export async function cancelSpaceSettlement(spaceId: string, settlementId: string): Promise<void> {
  requireUid();
  if (!isUsableId(spaceId) || !isUsableId(settlementId)) {
    throw new SpaceSettlementError('invalid-argument');
  }
  try {
    const call = httpsCallable<{ spaceId: string; settlementId: string }, unknown>(
      functions,
      CANCEL_SPACE_SETTLEMENT_FN,
    );
    const result = await call({ spaceId, settlementId });
    if (!parseMutationSettlementResult(result.data)) {
      throw new SpaceSettlementError('unavailable');
    }
  } catch (error) {
    throw toSpaceSettlementError(error, 'write');
  }
}

export async function setSpaceSettlementTransferStatus(
  spaceId: string,
  settlementId: string,
  fromUid: string,
  completed: boolean,
): Promise<void> {
  requireUid();
  if (!isUsableId(spaceId) || !isUsableId(settlementId) || !isUsableId(fromUid)) {
    throw new SpaceSettlementError('invalid-argument');
  }
  try {
    const call = httpsCallable<
      { spaceId: string; settlementId: string; fromUid: string; completed: boolean },
      unknown
    >(functions, SET_SPACE_SETTLEMENT_TRANSFER_STATUS_FN);
    const result = await call({ spaceId, settlementId, fromUid, completed });
    if (!parseMutationSettlementResult(result.data)) {
      throw new SpaceSettlementError('unavailable');
    }
  } catch (error) {
    throw toSpaceSettlementError(error, 'complete');
  }
}
