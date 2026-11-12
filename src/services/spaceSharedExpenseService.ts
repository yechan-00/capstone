import { httpsCallable } from 'firebase/functions';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAfter,
  where,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, db, functions } from '@/lib/firebase';
import { SPACES_COLLECTION } from '@/lib/spaceList';
import {
  SHARED_EXPENSES_COLLECTION,
  SHARED_EXPENSE_PAGE_SIZE,
  SPACE_EXPENSE_LINKS_COLLECTION,
  parseSpaceExpenseLink,
  parseSpaceSharedExpense,
  sortSpaceSharedExpenses,
  spaceExpenseLinkId,
  toSpaceSharedExpenseWritePayload,
  type SpaceExpenseLink,
  type SpaceSharedExpense,
  type SpaceSharedExpenseDraft,
} from '@/lib/spaceSharedExpense';
import {
  CREATE_SPACE_SHARED_EXPENSE_FN,
  OPEN_SETTLEMENT_DELETE_MESSAGE,
  SpaceSharedExpenseError,
  UPDATE_SPACE_SHARED_EXPENSE_FN,
  parseCreateSharedExpenseResult,
  parseUpdateSharedExpenseResult,
  toSpaceSharedExpenseError,
} from '@/lib/spaceSharedExpenseClient';
import { getSpaceSettlementLock } from '@/services/spaceSettlementService';

type CreatePayload = SpaceSharedExpenseDraft & {
  spaceId: string;
  sourceExpenseId?: string;
};

type UpdatePayload = SpaceSharedExpenseDraft & {
  spaceId: string;
  sharedExpenseId: string;
};

function requireUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new SpaceSharedExpenseError('unauthenticated');
  return uid;
}

function isUsableId(value: string | undefined): value is string {
  return typeof value === 'string' && value.length > 0 && !value.includes('/');
}

function accountIdForUid(uid: string): string {
  return `account_${uid}`;
}

function expensesCol(spaceId: string) {
  return collection(db, SPACES_COLLECTION, spaceId, SHARED_EXPENSES_COLLECTION);
}

function expenseRef(spaceId: string, sharedExpenseId: string) {
  return doc(db, SPACES_COLLECTION, spaceId, SHARED_EXPENSES_COLLECTION, sharedExpenseId);
}

function linkRef(uid: string, spaceId: string, sharedExpenseId: string) {
  return doc(
    db,
    'accounts',
    accountIdForUid(uid),
    SPACE_EXPENSE_LINKS_COLLECTION,
    spaceExpenseLinkId(spaceId, sharedExpenseId),
  );
}

export function subscribeSpaceMonthSharedExpenses(
  spaceId: string,
  rangeStart: string,
  rangeEnd: string,
  onNext: (rows: SpaceSharedExpense[]) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  if (!isUsableId(spaceId) || rangeStart > rangeEnd) {
    onError(new SpaceSharedExpenseError('invalid-argument'));
    return () => {};
  }
  const monthQuery = query(
    expensesCol(spaceId),
    where('dateKey', '>=', rangeStart),
    where('dateKey', '<=', rangeEnd),
  );
  return onSnapshot(
    monthQuery,
    (snap) => {
      const rows: SpaceSharedExpense[] = [];
      for (const row of snap.docs) {
        const parsed = parseSpaceSharedExpense(row.id, row.data());
        if (parsed) rows.push(parsed);
      }
      onNext(sortSpaceSharedExpenses(rows));
    },
    onError,
  );
}

export async function getSpaceSharedExpense(
  spaceId: string,
  sharedExpenseId: string,
): Promise<SpaceSharedExpense> {
  requireUid();
  if (!isUsableId(spaceId) || !isUsableId(sharedExpenseId)) {
    throw new SpaceSharedExpenseError('invalid-argument');
  }
  try {
    const snap = await getDoc(expenseRef(spaceId, sharedExpenseId));
    if (!snap.exists()) throw new SpaceSharedExpenseError('not-found');
    const parsed = parseSpaceSharedExpense(snap.id, snap.data());
    if (!parsed) throw new SpaceSharedExpenseError('not-found');
    return parsed;
  } catch (error) {
    throw toSpaceSharedExpenseError(error, 'read');
  }
}

export type SpaceSharedExpensePage = {
  expenses: SpaceSharedExpense[];
  cursor: QueryDocumentSnapshot | null;
  hasMore: boolean;
};

export async function listSpaceSharedExpensesPage(
  spaceId: string,
  cursor: DocumentSnapshot | null = null,
): Promise<SpaceSharedExpensePage> {
  requireUid();
  if (!isUsableId(spaceId)) throw new SpaceSharedExpenseError('invalid-argument');
  try {
    const pageQuery = cursor
      ? query(
          expensesCol(spaceId),
          orderBy('dateKey', 'desc'),
          orderBy('createdAt', 'desc'),
          startAfter(cursor),
          limit(SHARED_EXPENSE_PAGE_SIZE),
        )
      : query(
          expensesCol(spaceId),
          orderBy('dateKey', 'desc'),
          orderBy('createdAt', 'desc'),
          limit(SHARED_EXPENSE_PAGE_SIZE),
        );
    const snap = await getDocs(pageQuery);
    const expenses: SpaceSharedExpense[] = [];
    for (const row of snap.docs) {
      const parsed = parseSpaceSharedExpense(row.id, row.data());
      if (parsed) expenses.push(parsed);
    }
    const last = snap.docs[snap.docs.length - 1] ?? null;
    return {
      expenses,
      cursor: last,
      hasMore: snap.docs.length === SHARED_EXPENSE_PAGE_SIZE,
    };
  } catch (error) {
    throw toSpaceSharedExpenseError(error, 'read');
  }
}

export async function createSpaceSharedExpense(
  spaceId: string,
  draft: SpaceSharedExpenseDraft,
  sourceExpenseId?: string,
): Promise<string> {
  requireUid();
  if (!isUsableId(spaceId)) throw new SpaceSharedExpenseError('invalid-argument');
  const payload = toSpaceSharedExpenseWritePayload(draft);
  if (!payload) throw new SpaceSharedExpenseError('invalid-argument');
  try {
    const call = httpsCallable<CreatePayload, unknown>(functions, CREATE_SPACE_SHARED_EXPENSE_FN);
    const result = await call({
      spaceId,
      ...payload,
      ...(sourceExpenseId && isUsableId(sourceExpenseId) ? { sourceExpenseId } : {}),
    });
    const parsed = parseCreateSharedExpenseResult(result.data);
    if (!parsed) throw new SpaceSharedExpenseError('unavailable');
    return parsed.sharedExpenseId;
  } catch (error) {
    throw toSpaceSharedExpenseError(error, sourceExpenseId ? 'share' : 'write');
  }
}

export async function updateSpaceSharedExpense(
  spaceId: string,
  sharedExpenseId: string,
  draft: SpaceSharedExpenseDraft,
): Promise<void> {
  requireUid();
  if (!isUsableId(spaceId) || !isUsableId(sharedExpenseId)) {
    throw new SpaceSharedExpenseError('invalid-argument');
  }
  const payload = toSpaceSharedExpenseWritePayload(draft);
  if (!payload) throw new SpaceSharedExpenseError('invalid-argument');
  try {
    const call = httpsCallable<UpdatePayload, unknown>(functions, UPDATE_SPACE_SHARED_EXPENSE_FN);
    const result = await call({
      spaceId,
      sharedExpenseId,
      ...payload,
    });
    if (!parseUpdateSharedExpenseResult(result.data)) {
      throw new SpaceSharedExpenseError('unavailable');
    }
  } catch (error) {
    throw toSpaceSharedExpenseError(error, 'write');
  }
}

export async function deleteSpaceSharedExpense(
  spaceId: string,
  sharedExpense: SpaceSharedExpense,
): Promise<void> {
  const uid = requireUid();
  if (!isUsableId(spaceId) || !isUsableId(sharedExpense.id)) {
    throw new SpaceSharedExpenseError('invalid-argument');
  }
  try {
    const lock = await getSpaceSettlementLock(spaceId, sharedExpense.id);
    if (lock?.status === 'open') {
      throw new SpaceSharedExpenseError('failed-precondition', OPEN_SETTLEMENT_DELETE_MESSAGE);
    }
    await deleteDoc(expenseRef(spaceId, sharedExpense.id));
  } catch (error) {
    throw toSpaceSharedExpenseError(error, 'write');
  }
  try {
    await deleteDoc(linkRef(uid, spaceId, sharedExpense.id));
  } catch {
    // 개인 연결만 정리. 공유 기록 삭제는 이미 끝났고 원본 소비는 건드리지 않는다.
  }
}

export async function listSpaceExpenseLinksForExpense(expenseId: string): Promise<SpaceExpenseLink[]> {
  const uid = requireUid();
  if (!isUsableId(expenseId)) throw new SpaceSharedExpenseError('invalid-argument');
  try {
    const linksQuery = query(
      collection(db, 'accounts', accountIdForUid(uid), SPACE_EXPENSE_LINKS_COLLECTION),
      where('expenseId', '==', expenseId),
    );
    const snap = await getDocs(linksQuery);
    const links: SpaceExpenseLink[] = [];
    for (const row of snap.docs) {
      const parsed = parseSpaceExpenseLink(row.id, row.data());
      if (parsed) links.push(parsed);
    }
    return links;
  } catch (error) {
    throw toSpaceSharedExpenseError(error, 'read');
  }
}
