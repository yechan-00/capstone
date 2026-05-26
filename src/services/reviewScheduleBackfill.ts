import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { mapScheduleDoc } from '@/utils/firestore';
import { expenseService } from '@/services/expenseService';
import { reviewService } from '@/services/reviewService';
import { scheduleService } from '@/services/scheduleService';

const SCHEDULES_COLLECTION = 'review_schedules';

/**
 * 미평가 소비에 리뷰 스케줄을 맞춥니다.
 * - 없으면 생성
 * - 있으면 소비일 기준 다음날 0시 / 47h59m 규칙으로 dueAt·expiresAt 갱신
 */
export async function ensureReviewSchedulesForAccount(accountId: string): Promise<number> {
  const [expenses, reviews, schedulesSnap] = await Promise.all([
    expenseService.getByAccountId(accountId),
    reviewService.getByAccountId(accountId),
    getDocs(query(collection(db, SCHEDULES_COLLECTION), where('accountId', '==', accountId))),
  ]);

  if (expenses.length === 0) return 0;

  const reviewedExpenseIds = new Set(reviews.map((r) => r.expenseId));
  const schedulesByExpense = new Map<string, ReturnType<typeof mapScheduleDoc>[]>();

  for (const docSnap of schedulesSnap.docs) {
    const schedule = mapScheduleDoc(docSnap);
    const list = schedulesByExpense.get(schedule.expenseId) ?? [];
    list.push(schedule);
    schedulesByExpense.set(schedule.expenseId, list);
  }

  let touched = 0;
  for (const expense of expenses) {
    if (reviewedExpenseIds.has(expense.id)) continue;

    const schedules = schedulesByExpense.get(expense.id) ?? [];
    const pending = schedules.filter((s) => s.status === 'pending');

    if (pending.length === 0 && schedules.length === 0) {
      await scheduleService.createSchedulesForExpense(expense.id, accountId, expense.spentAt);
      touched += 1;
      continue;
    }

    if (pending.length > 0) {
      const sorted = pending.sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
      const [primary, ...duplicates] = sorted;
      await scheduleService.syncScheduleFromSpentAt(primary.id, accountId, expense.spentAt);
      await Promise.all(duplicates.map((s) => scheduleService.markAsSkippedQuiet(s.id)));
      touched += 1;
    }
  }

  if (touched > 0) {
    await scheduleService.expireStalePendingSchedules(accountId);
    console.info(`[review] reconciled ${touched} schedule(s) for ${accountId}`);
  }
  return touched;
}
