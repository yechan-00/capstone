import {
  collection,
  doc,
  addDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp,
  runTransaction,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Review } from '@/lib/types';
import { timestampToDate } from '@/utils/firestore';
import { cancelReminder } from '@/services/notificationService';
import { scheduleService } from '@/services/scheduleService';

const COLLECTION_NAME = 'reviews';
const SCHEDULES_COLLECTION = 'review_schedules';

export const reviewService = {
  async create(review: Omit<Review, 'id' | 'createdAt'>): Promise<string> {
    try {
      let notificationId: string | undefined;

      // 트랜잭션으로 리뷰 생성과 스케줄 업데이트를 원자적으로 처리
      const reviewId = await runTransaction(db, async (transaction) => {
        // 스케줄 상태를 done으로 변경 + 알림 ID 확보 (읽기 먼저)
        const scheduleRef = doc(db, SCHEDULES_COLLECTION, review.scheduleId);
        const scheduleSnap = await transaction.get(scheduleRef);
        if (!scheduleSnap.exists()) {
          throw new Error('리뷰 스케줄을 찾을 수 없습니다.');
        }
        const scheduleData = scheduleSnap.data();
        notificationId =
          typeof scheduleData?.notificationId === 'string'
            ? scheduleData.notificationId
            : undefined;

        const reviewRef = doc(collection(db, COLLECTION_NAME));
        const reviewData: Record<string, unknown> = {
          ...review,
          id: reviewRef.id,
          reviewedAt: Timestamp.fromDate(review.reviewedAt),
          createdAt: serverTimestamp(),
        };
        // Firestore는 undefined 값 저장 불가 — 없는 필드는 제거
        Object.keys(reviewData).forEach((k) => {
          if (reviewData[k] === undefined) delete reviewData[k];
        });
        transaction.set(reviewRef, reviewData);
        transaction.update(scheduleRef, {
          status: 'done',
          completedAt: serverTimestamp(),
          notificationId: null,
        });

        return reviewRef.id;
      });

      // 저장 응답 지연을 줄이기 위해 후처리는 백그라운드로 진행
      void (async () => {
        if (notificationId) {
          try {
            await cancelReminder(notificationId);
          } catch (error) {
            console.warn('Failed to cancel notification:', error);
          }
        }
        try {
          await scheduleService.skipAllPendingSchedulesForExpense(review.expenseId, review.accountId);
        } catch (error) {
          console.warn('Failed to skip pending schedules after review:', error);
        }
      })();

      return reviewId;
    } catch (error) {
      console.error('Failed to create review:', error);
      throw new Error('리뷰를 생성하는데 실패했습니다.');
    }
  },

  async getByExpenseId(expenseId: string, accountId: string): Promise<Review[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('accountId', '==', accountId),
        where('expenseId', '==', expenseId),
        orderBy('reviewedAt', 'desc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          reviewedAt: timestampToDate(data.reviewedAt),
          createdAt: timestampToDate(data.createdAt),
        } as Review;
      });
    } catch (error) {
      console.error('Failed to get reviews:', error);
      throw new Error('리뷰를 조회하는데 실패했습니다.');
    }
  },

  async getByAccountId(accountId: string, limit?: number): Promise<Review[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('accountId', '==', accountId),
        orderBy('reviewedAt', 'desc')
      );

      const snapshot = await getDocs(q);
      const reviews = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          reviewedAt: timestampToDate(data.reviewedAt),
          createdAt: timestampToDate(data.createdAt),
        } as Review;
      });

      return limit ? reviews.slice(0, limit) : reviews;
    } catch (error) {
      console.error('Failed to get reviews:', error);
      throw new Error('리뷰 목록을 조회하는데 실패했습니다.');
    }
  },
};
