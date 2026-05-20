import type { ReviewSchedule } from '@/lib/types';

const DAY_MS = 86_400_000;

function delayDaysOrDefault(schedule: ReviewSchedule): 1 | 3 | 7 | 30 {
  const raw = Number(schedule.delayDays);
  if (raw === 1 || raw === 3 || raw === 7 || raw === 30) return raw;
  return 3;
}

/**
 * 리뷰 예정 시각(dueAt) 이후 delayDays만큼 지나기 전까지만 앱 내 리뷰 알림으로 노출.
 * (로컬 예약 알림 정리 `clearExpiredReviewReminderNotifications`와 동일 기준)
 */
export function isInAppReviewReminderVisible(schedule: ReviewSchedule, nowMs: number = Date.now()): boolean {
  const due = schedule.dueAt.getTime();
  const graceEnd = due + delayDaysOrDefault(schedule) * DAY_MS;
  return nowMs <= graceEnd;
}

export function filterVisibleInAppReviewSchedules<T extends ReviewSchedule>(schedules: T[]): T[] {
  return schedules.filter((s) => isInAppReviewReminderVisible(s));
}
