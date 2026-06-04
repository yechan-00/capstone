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
  DocumentReference,
} from 'firebase/firestore';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { db } from '@/lib/firebase';
import { ReviewSchedule, ScheduleStatus, ScheduleType } from '@/lib/types';
import { requireUserIdFromAccountId } from '@/lib/accountId';
import { mapScheduleDoc } from '@/utils/firestore';
import { isReviewWindowOpen, isReviewWindowExpired, isReviewEvaluable } from '@/lib/reviewWindow';
import {
  computeReviewExpiresAt,
  computeReviewNotificationAt,
  computeReviewOpensAt,
} from '@/lib/reviewWindow';
import { cancelReminder, scheduleReviewReminder } from '@/services/notificationService';

const COLLECTION_NAME = 'review_schedules';

/** Firestore `in` 쿼리 최대 10개 */
const EXPENSE_ID_IN_CHUNK = 10;

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

function reviewNotificationCopy(): { title: string; body: string } {
  return {
    title: '소비 평가',
    body: '어제 기록한 소비, 후회했는지 짧게 남겨 보세요.',
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
    const userId = requireUserIdFromAccountId(accountId);
    const notificationTime = await this.getAccountNotificationTime(accountId);
    const opensAt = computeReviewOpensAt(spentAt);
    const expiresAt = computeReviewExpiresAt(spentAt);
    const notifyAt = computeReviewNotificationAt(spentAt, notificationTime);

    const schedule: Omit<ReviewSchedule, 'id' | 'createdAt'> = {
      expenseId,
      accountId,
      userId,
      type: 'd1',
      dueAt: opensAt,
      expiresAt,
      delayDays: 1,
      status: 'pending',
      notificationId: '',
    };

    const scheduleRef = await addDoc(collection(db, COLLECTION_NAME), {
      ...schedule,
      dueAt: Timestamp.fromDate(opensAt),
      expiresAt: Timestamp.fromDate(expiresAt),
      createdAt: serverTimestamp(),
    });

    let notificationId = '';
    try {
      notificationId = await this.scheduleNotification(expenseId, notifyAt, scheduleRef.id);
      if (notificationId) {
        await updateDoc(scheduleRef, { notificationId });
      }
    } catch {
      // 알림 실패 무시
    }
  },

  async scheduleNotification(expenseId: string, notifyAt: Date, scheduleId: string): Promise<string> {
    try {
      const { title, body } = reviewNotificationCopy();
      const notificationId = await scheduleReviewReminder({
        title,
        body,
        dueAt: notifyAt,
        data: { kind: 'review_reminder', expenseId, scheduleId, scheduleType: 'd1' },
      });
      return notificationId;
    } catch (error) {
      console.warn('알림 스케줄링 실패 (저장은 계속됩니다):', error);
      return '';
    }
  },

  /** 평가 기한(47h59m) 지난 pending → expired */
  async expireStalePendingSchedules(accountId: string): Promise<number> {
    try {
      const snapshot = await getDocs(
        query(
          collection(db, COLLECTION_NAME),
          where('accountId', '==', accountId),
          where('status', '==', 'pending'),
        ),
      );
      let count = 0;
      const now = Date.now();
      await Promise.all(
        snapshot.docs.map(async (snap) => {
          const schedule = mapScheduleDoc(snap);
          if (!isReviewWindowExpired(schedule, now)) return;
          const notificationId = snap.data().notificationId as string | undefined;
          await updateDoc(doc(db, COLLECTION_NAME, snap.id), {
            status: 'expired' as ScheduleStatus,
            completedAt: serverTimestamp(),
            notificationId: null,
          });
          if (notificationId) await cancelReminder(notificationId);
          count += 1;
        }),
      );
      return count;
    } catch (error) {
      console.warn('[schedule] expireStalePendingSchedules', error);
      return 0;
    }
  },

  async getPendingSchedules(accountId: string): Promise<ReviewSchedule[]> {
    try {
      await this.expireStalePendingSchedules(accountId);
      const now = Timestamp.now();
      const q = query(
        collection(db, COLLECTION_NAME),
        where('accountId', '==', accountId),
        where('status', '==', 'pending'),
        where('dueAt', '<=', now),
        orderBy('dueAt', 'asc')
      );

      const snapshot = await getDocs(q);
      const rows = snapshot.docs.map(mapScheduleDoc).filter((s) => isReviewWindowOpen(s));
      return dedupePendingSchedulesByExpense(rows);
    } catch (error) {
      console.error('Failed to get pending schedules:', error);
      throw new Error('대기 중인 스케줄을 조회하는데 실패했습니다.');
    }
  },

  async getExpiredReviewSchedules(accountId: string): Promise<ReviewSchedule[]> {
    try {
      await this.expireStalePendingSchedules(accountId);
      const q = query(
        collection(db, COLLECTION_NAME),
        where('accountId', '==', accountId),
        where('status', '==', 'expired'),
      );
      const snapshot = await getDocs(q);
      return snapshot.docs
        .map(mapScheduleDoc)
        .sort((a, b) => {
          const aTime = (a.completedAt ?? a.dueAt).getTime();
          const bTime = (b.completedAt ?? b.dueAt).getTime();
          return bTime - aTime;
        });
    } catch (error) {
      console.error('Failed to get expired schedules:', error);
      throw new Error('지나간 리뷰를 조회하는데 실패했습니다.');
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
      return mapScheduleDoc(docSnap);
    } catch (error) {
      console.warn('Failed to get upcoming schedule:', error);
      return null;
    }
  },

  /**
   * 지출 ID 목록에 대해, 각 지출당 평가 가능한 스케줄 중 dueAt이 가장 이른 것 1건씩.
   * (홈 캘린더 모달에서 미평가 시 평가 화면으로 보낼 scheduleId 확보용)
   */
  async getEarliestPendingScheduleByExpenseIds(
    accountId: string,
    expenseIds: string[],
    opts?: { includePastGraceWindow?: boolean },
  ): Promise<Map<string, ReviewSchedule>> {
    const unique = [...new Set(expenseIds.filter((id) => typeof id === 'string' && id.length > 0))];
    const result = new Map<string, ReviewSchedule>();
    if (unique.length === 0) {
      return result;
    }

    try {
      for (let i = 0; i < unique.length; i += EXPENSE_ID_IN_CHUNK) {
        const chunk = unique.slice(i, i + EXPENSE_ID_IN_CHUNK);
        const q = query(
          collection(db, COLLECTION_NAME),
          where('accountId', '==', accountId),
          where('expenseId', 'in', chunk),
          where('status', 'in', ['pending', 'expired']),
        );
        const snapshot = await getDocs(q);
        for (const docSnap of snapshot.docs) {
          const schedule = mapScheduleDoc(docSnap);
          if (opts?.includePastGraceWindow) {
            if (!isReviewEvaluable(schedule)) continue;
          } else if (!isReviewWindowOpen(schedule)) {
            continue;
          }
          const eid = schedule.expenseId;
          const prev = result.get(eid);
          if (!prev || schedule.dueAt.getTime() < prev.dueAt.getTime()) {
            result.set(eid, schedule);
          }
        }
      }
      return result;
    } catch (error) {
      console.error('Failed to get pending schedules by expense ids:', error);
      throw new Error('지출별 대기 스케줄을 조회하는데 실패했습니다.');
    }
  },

  async getSchedulesByExpenseId(expenseId: string, accountId: string): Promise<ReviewSchedule[]> {
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where('accountId', '==', accountId),
        where('expenseId', '==', expenseId),
      );

      const snapshot = await getDocs(q);
      return snapshot.docs
        .map(mapScheduleDoc)
        .sort((a, b) => a.delayDays - b.delayDays);
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
    await this.updateScheduleToSkipped(scheduleRef, notificationId);
  },

  async updateScheduleToSkipped(
    scheduleRef: DocumentReference,
    notificationId?: string
  ): Promise<void> {
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
      await Promise.all(
        snapshot.docs.map(async (d) => {
          try {
            const notificationId = d.data().notificationId as string | undefined;
            await this.updateScheduleToSkipped(doc(db, COLLECTION_NAME, d.id), notificationId);
          } catch (err) {
            console.error('Failed to skip schedule', d.id, err);
          }
        })
      );
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
      const notificationId = snapshot.exists()
        ? (snapshot.data().notificationId as string | undefined)
        : undefined;

      await this.updateScheduleToSkipped(scheduleRef, notificationId);

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
  async syncScheduleFromSpentAt(
    scheduleId: string,
    accountId: string,
    spentAt: Date,
  ): Promise<void> {
    const opensAt = computeReviewOpensAt(spentAt);
    const expiresAt = computeReviewExpiresAt(spentAt);
    await updateDoc(doc(db, COLLECTION_NAME, scheduleId), {
      dueAt: Timestamp.fromDate(opensAt),
      expiresAt: Timestamp.fromDate(expiresAt),
      delayDays: 1,
      type: 'd1',
    });
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

  async getAccountReviewDelayDays(accountId: string): Promise<(1 | 3 | 7 | 30)[]> {
    try {
      const accountDoc = await getDoc(doc(db, 'accounts', accountId));
      if (!accountDoc.exists()) {
        return [3];
      }
      const raw = accountDoc.data().reviewDelayDays as unknown;
      if (Array.isArray(raw)) {
        const filtered = raw.filter((d) => d === 1 || d === 3 || d === 7 || d === 30) as (1 | 3 | 7 | 30)[];
        const uniq = Array.from(new Set(filtered));
        return uniq.length > 0 ? uniq.sort((a, b) => a - b) : [3];
      }
      if (raw === 7 || raw === 30 || raw === 3) return [raw];
      return [3];
    } catch (error) {
      console.error('Failed to get account review delay days:', error);
      return [3];
    }
  },

  /**
   * 리뷰 예정일(dueAt) 이후에도 해당 스케줄의 주기(예: 3일)만큼 지나면 로컬 알림을 취소하고
   * Firestore의 notificationId만 비웁니다. (스케줄은 pending 유지 — 앱에서 리뷰는 계속 가능)
   */
  async clearExpiredReviewReminderNotifications(accountId: string): Promise<void> {
    if (Platform.OS === 'web') {
      return;
    }
    try {
      await this.expireStalePendingSchedules(accountId);
      const snapshot = await getDocs(
        query(
          collection(db, COLLECTION_NAME),
          where('accountId', '==', accountId),
          where('status', '==', 'pending'),
        ),
      );
      for (const snap of snapshot.docs) {
        const schedule = mapScheduleDoc(snap);
        if (isReviewWindowOpen(schedule)) continue;
        const notificationId = snap.data().notificationId as string | undefined;
        if (notificationId) {
          await cancelReminder(notificationId);
        }
        await updateDoc(doc(db, COLLECTION_NAME, snap.id), { notificationId: null });
      }
    } catch (e) {
      console.warn('[schedule] clearExpiredReviewReminderNotifications', e);
    }
  },
};
