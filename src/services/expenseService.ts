import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Expense } from '@/lib/types';
import { normalizeExpenseCategory } from '@/lib/categoryAnalytics';
import { scheduleService } from './scheduleService';
import { timestampToDate } from '@/utils/firestore';
import { cancelReminder } from '@/services/notificationService';

const COLLECTION_NAME = 'expenses';
const SCHEDULES_COLLECTION = 'review_schedules';
const REVIEWS_COLLECTION = 'reviews';

function toExpense(id: string, data: Record<string, unknown>): Expense {
  const category = normalizeExpenseCategory(data.category as string | undefined);
  const itemRaw = data.item ?? data.content;
  const item =
    typeof itemRaw === 'string' && itemRaw.trim() ? itemRaw.trim() : undefined;

  return {
    id,
    accountId: data.accountId as string,
    amount: data.amount as number,
    category,
    item,
    content: item ?? (data.content as string | undefined),
    reason: (data.reason as string) ?? '',
    mood: data.mood as Expense['mood'],
    tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
    summaryLine: data.summaryLine as string | undefined,
    summaryEmoji: data.summaryEmoji as string | undefined,
    imageUrl: (data.imageUrl as string | null | undefined) ?? null,
    spentAt: timestampToDate(data.spentAt as any),
    sourceType: (data.sourceType as Expense['sourceType']) ?? 'manual',
    sourceRef: (data.sourceRef as string | null | undefined) ?? null,
    createdAt: timestampToDate(data.createdAt as any),
    updatedAt: timestampToDate(data.updatedAt as any),
  };
}

export const expenseService = {
  async create(expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>): Promise<string> {
    try {
      const category = normalizeExpenseCategory(expense.category);
      const item = expense.item?.trim() || expense.content?.trim() || undefined;
      const expenseRef = await addDoc(collection(db, COLLECTION_NAME), {
        ...expense,
        category,
        item,
        content: item ?? expense.content,
        spentAt: Timestamp.fromDate(expense.spentAt),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      const expenseId = expenseRef.id;

      // 리뷰 스케줄 자동 생성
      await scheduleService.createSchedulesForExpense(expenseId, expense.accountId, expense.spentAt);

      return expenseId;
    } catch (error) {
      console.error('Failed to create expense:', error);
      throw new Error('소비를 생성하는데 실패했습니다.');
    }
  },

  async getById(expenseId: string): Promise<Expense | null> {
    try {
      const expenseDoc = await getDoc(doc(db, COLLECTION_NAME, expenseId));
      
      if (!expenseDoc.exists()) {
        return null;
      }

      return toExpense(expenseDoc.id, expenseDoc.data());
    } catch (error) {
      console.error('Failed to get expense:', error);
      throw new Error('소비를 조회하는데 실패했습니다.');
    }
  },

  async getByAccountId(accountId: string): Promise<Expense[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('accountId', '==', accountId),
        orderBy('spentAt', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => toExpense(doc.id, doc.data()));
    } catch (error) {
      console.error('Failed to get expenses:', error);
      throw new Error('소비 목록을 조회하는데 실패했습니다.');
    }
  },

  async update(expenseId: string, updates: Partial<Expense>): Promise<void> {
    try {
      const updateData: any = {
        ...updates,
        updatedAt: serverTimestamp(),
      };

      if (updates.spentAt) {
        updateData.spentAt = Timestamp.fromDate(updates.spentAt);
      }

      // accountId는 변경 불가
      delete updateData.accountId;
      delete updateData.id;

      await updateDoc(doc(db, COLLECTION_NAME, expenseId), updateData);
    } catch (error) {
      console.error('Failed to update expense:', error);
      throw new Error('소비를 수정하는데 실패했습니다.');
    }
  },

  async delete(expenseId: string): Promise<void> {
    try {
      const expenseRef = doc(db, COLLECTION_NAME, expenseId);
      const expenseDoc = await getDoc(expenseRef);
      if (!expenseDoc.exists()) {
        throw new Error('소비를 찾을 수 없습니다.');
      }

      const accountId = expenseDoc.data().accountId as string;

      const schedulesSnap = await getDocs(
        query(
          collection(db, SCHEDULES_COLLECTION),
          where('expenseId', '==', expenseId),
          where('accountId', '==', accountId)
        )
      );

      const reviewsSnap = await getDocs(
        query(
          collection(db, REVIEWS_COLLECTION),
          where('expenseId', '==', expenseId),
          where('accountId', '==', accountId)
        )
      );

      await Promise.all(
        schedulesSnap.docs.map(async (d) => {
          const nid = d.data().notificationId;
          if (typeof nid === 'string' && nid.length > 0) {
            try {
              await cancelReminder(nid);
            } catch {
              // 알림 취소 실패해도 문서 삭제는 진행
            }
          }
        })
      );

      const batch = writeBatch(db);
      batch.delete(expenseRef);
      schedulesSnap.docs.forEach((d) => batch.delete(d.ref));
      reviewsSnap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    } catch (error) {
      console.error('Failed to delete expense:', error);
      throw new Error('소비를 삭제하는데 실패했습니다.');
    }
  },
};
