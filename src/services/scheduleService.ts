import {
  collection,
  doc,
  getDoc,
  addDoc,
  updateDoc,
  getDocs,
  query,
  where,
  orderBy,
  Timestamp,
  serverTimestamp,
  limit,
} from 'firebase/firestore';
import * as Notifications from 'expo-notifications';
import { db } from '@/lib/firebase';
import { ReviewSchedule, ScheduleStatus, ScheduleType } from '@/lib/types';
import { timestampToDate } from '@/utils/firestore';
import { cancelReminder, computeReviewReminderDueDates, scheduleReviewReminder } from '@/services/notificationService';

const COLLECTION_NAME = 'review_schedules';

// 알림 핸들러 설정
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/** 리뷰 예약 알림은 스케줄 타입과 관계없이 3일 리뷰 안내만 사용 (레거시 스케줄 동일 문구) */
function reviewNotificationCopy(_type: ScheduleType): { title: string; body: string } {
  return {
    title: '3일 리뷰',
    body: '3일 전쯤 기록한 소비가 어땠는지, 후회도를 남겨 보세요.',
  };
}

/** 소비당 대기 카드 1개: dueAt 오름차순에서 같은 expenseId는 첫 항목만 유지 */
function dedupePendingSchedulesByExpense(schedules: ReviewSchedule[]): ReviewSchedule[] {
  const seen = new Set<string>();
  const out: ReviewSchedule[] = [];
  for (const s of schedules) {
    if (seen.has(s.expenseId)) continue;
    seen.add(s.expenseId);
    out.push(s);
  }
  return out;
}

export const scheduleService = {
  async createSchedulesForExpense(
    expenseId: string,
    accountId: string,
    spentAt: Date
  ): Promise<void> {
    const notificationTime = await this.getAccountNotificationTime(accountId);
    const dueDates = computeReviewReminderDueDates(spentAt, notificationTime);
    const schedules: { type: ScheduleType; delayDays: number; dueAt: Date }[] = [
      { type: 'd3', delayDays: 3, dueAt: dueDates.d3 },
    ];

    // 각 스케줄마다 알림은 시도하되 실패해도 Firestore 저장은 계속
    const results = await Promise.all(
      schedules.map(async ({ type, delayDays, dueAt }) => {
        // 알림 스케줄링 (실패해도 무시)
        let notificationId = '';
        try {
          notificationId = await this.scheduleNotification(expenseId, type, dueAt);
        } catch {
          // 알림 실패 무시 - 리뷰는 앱에서 직접 작성 가능
        }
        return { type, delayDays, dueAt, notificationId };
      })
    );

    // Firestore 스케줄 저장 (알림 성공/실패 관계없이 항상 저장)
    await Promise.all(
      results.map(({ type, delayDays, dueAt, notificationId }) => {
        const schedule: Omit<ReviewSchedule, 'id' | 'createdAt'> = {
          expenseId,
          accountId,
          type,
          dueAt,
          delayDays,
          status: 'pending',
          notificationId,
        };
        return addDoc(collection(db, COLLECTION_NAME), {
          ...schedule,
          dueAt: Timestamp.fromDate(dueAt),
          createdAt: serverTimestamp(),
        });
      })
    );
  },

  async scheduleNotification(
    expenseId: string,
    scheduleType: ScheduleType,
    dueAt: Date
  ): Promise<string> {
    try {
      const { title, body } = reviewNotificationCopy(scheduleType);
      const notificationId = await scheduleReviewReminder({
        title,
        body,
        dueAt,
        data: { expenseId, scheduleType },
      });
      return notificationId;
    } catch (error) {
      console.warn('알림 스케줄링 실패 (저장은 계속됩니다):', error);
      return '';
    }
  },

  async getPendingSchedules(accountId: string): Promise<ReviewSchedule[]> {
    try {
      const now = Timestamp.now();
      const q = query(
        collection(db, COLLECTION_NAME),
        where('accountId', '==', accountId),
        where('status', '==', 'pending'),
        where('dueAt', '<=', now),
        orderBy('dueAt', 'asc')
      );

      const snapshot = await getDocs(q);
      const rows = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          dueAt: timestampToDate(data.dueAt),
          createdAt: timestampToDate(data.createdAt),
          completedAt: timestampToDate(data.completedAt),
        } as ReviewSchedule;
      });
      return dedupePendingSchedulesByExpense(rows);
    } catch (error) {
      console.error('Failed to get pending schedules:', error);
      throw new Error('대기 중인 스케줄을 조회하는데 실패했습니다.');
    }
  },

  async getNextUpcomingSchedule(accountId: string): Promise<ReviewSchedule | null> {
    try {
      const now = Timestamp.now();
      const q = query(
        collection(db, COLLECTION_NAME),
        where('accountId', '==', accountId),
        where('status', '==', 'pending'),
        where('dueAt', '>', now),
        orderBy('dueAt', 'asc'),
        limit(1)
      );

      const snapshot = await getDocs(q);
      const docSnap = snapshot.docs[0];
      if (!docSnap) {
        return null;
      }
      const data = docSnap.data();
      return {
        id: docSnap.id,
        ...data,
        dueAt: timestampToDate(data.dueAt),
        createdAt: timestampToDate(data.createdAt),
        completedAt: timestampToDate(data.completedAt),
      } as ReviewSchedule;
    } catch (error) {
      console.warn('Failed to get upcoming schedule:', error);
      return null;
    }
  },

  async getSchedulesByExpenseId(expenseId: string, accountId: string): Promise<ReviewSchedule[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('accountId', '==', accountId),
        where('expenseId', '==', expenseId),
        orderBy('delayDays', 'asc')
      );

      const snapshot = await getDocs(q);
      return snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          dueAt: timestampToDate(data.dueAt),
          createdAt: timestampToDate(data.createdAt),
          completedAt: timestampToDate(data.completedAt),
        } as ReviewSchedule;
      });
    } catch (error) {
      console.error('Failed to get schedules:', error);
      throw new Error('스케줄을 조회하는데 실패했습니다.');
    }
  },

  async markAsSkippedQuiet(scheduleId: string): Promise<void> {
    const scheduleRef = doc(db, COLLECTION_NAME, scheduleId);
    const snapshot = await getDoc(scheduleRef);
    const notificationId = snapshot.exists()
      ? (snapshot.data().notificationId as string | undefined)
      : undefined;

    await updateDoc(scheduleRef, {
      status: 'skipped' as ScheduleStatus,
      completedAt: serverTimestamp(),
      notificationId: null,
    });

    if (notificationId) {
      await cancelReminder(notificationId);
    }
  },

  /** 같은 소비에 남아 있는 다른 pending 스케줄을 모두 스킵 (리뷰 1건 = 소비 1건) */
  async skipAllPendingSchedulesForExpense(expenseId: string, accountId: string): Promise<void> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('accountId', '==', accountId),
        where('expenseId', '==', expenseId),
        where('status', '==', 'pending')
      );
      const snapshot = await getDocs(q);
      for (const d of snapshot.docs) {
        try {
          await this.markAsSkippedQuiet(d.id);
        } catch (err) {
          console.error('Failed to skip schedule', d.id, err);
        }
      }
    } catch (error) {
      console.error('Failed to skip pending schedules for expense:', error);
    }
  },

  async markAsDone(scheduleId: string): Promise<void> {
    try {
      const scheduleRef = doc(db, COLLECTION_NAME, scheduleId);
      const snapshot = await getDoc(scheduleRef);
      const notificationId = snapshot.exists()
        ? (snapshot.data().notificationId as string | undefined)
        : undefined;

      await updateDoc(scheduleRef, {
        status: 'done' as ScheduleStatus,
        completedAt: serverTimestamp(),
      });

      if (notificationId) {
        await cancelReminder(notificationId);
      }
    } catch (error) {
      console.error('Failed to mark schedule as done:', error);
      throw new Error('스케줄 상태를 업데이트하는데 실패했습니다.');
    }
  },

  async markAsSkipped(scheduleId: string): Promise<void> {
    try {
      const scheduleRef = doc(db, COLLECTION_NAME, scheduleId);
      const snapshot = await getDoc(scheduleRef);
      const expenseId = snapshot.exists() ? (snapshot.data().expenseId as string) : null;
      const accountId = snapshot.exists() ? (snapshot.data().accountId as string) : null;

      await this.markAsSkippedQuiet(scheduleId);

      if (expenseId && accountId) {
        await this.skipAllPendingSchedulesForExpense(expenseId, accountId);
      }
    } catch (error) {
      console.error('Failed to mark schedule as skipped:', error);
      throw new Error('스케줄 상태를 업데이트하는데 실패했습니다.');
    }
  },

  async cancelNotification(notificationId: string): Promise<void> {
    if (notificationId) {
      try {
        await cancelReminder(notificationId);
      } catch (error) {
        console.error('Failed to cancel notification:', error);
      }
    }
  },
  async getAccountNotificationTime(accountId: string): Promise<string | undefined> {
    try {
      const accountDoc = await getDoc(doc(db, 'accounts', accountId));
      if (!accountDoc.exists()) {
        return undefined;
      }

      const data = accountDoc.data();
      const t = data.reviewReminderTime ?? data.notificationTime;
      return typeof t === 'string' ? t : undefined;
    } catch (error) {
      console.error('Failed to get account notification time:', error);
      return undefined;
    }
  },
};
