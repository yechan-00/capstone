import type { ReviewSchedule } from '@/lib/types';
import { isReviewWindowOpen } from '@/lib/reviewWindow';

/** @deprecated reviewWindow.isReviewWindowOpen 사용 */
export function isInAppReviewReminderVisible(schedule: ReviewSchedule, nowMs: number = Date.now()): boolean {
  return isReviewWindowOpen(schedule, nowMs);
}

export function filterVisibleInAppReviewSchedules<T extends ReviewSchedule>(schedules: T[]): T[] {
  return schedules.filter((s) => isReviewWindowOpen(s));
}
