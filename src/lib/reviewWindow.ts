import type { ReviewSchedule } from '@/lib/types';

/** 평가 가능 시간: 열림 시각 기준 47시간 59분 */
export const REVIEW_WINDOW_MS = (47 * 60 + 59) * 60 * 1000;

/** 소비 다음 날 00:00 (로컬) */
export function computeReviewOpensAt(spentAt: Date): Date {
  const d = new Date(spentAt);
  d.setDate(d.getDate() + 1);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function computeReviewExpiresAt(spentAt: Date): Date {
  return new Date(computeReviewOpensAt(spentAt).getTime() + REVIEW_WINDOW_MS);
}

/** 리뷰가 열리는 날, 설정한 시각에 알림 */
export function computeReviewNotificationAt(spentAt: Date, notificationTime?: string): Date {
  const opens = computeReviewOpensAt(spentAt);
  const [hourRaw, minuteRaw] = (notificationTime || '19:00').split(':');
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  const d = new Date(opens);
  d.setHours(Number.isNaN(hour) ? 19 : hour, Number.isNaN(minute) ? 0 : minute, 0, 0);
  return d;
}

export function resolveScheduleExpiresAt(schedule: ReviewSchedule): Date {
  if (schedule.expiresAt) return schedule.expiresAt;
  return new Date(schedule.dueAt.getTime() + REVIEW_WINDOW_MS);
}

export function isReviewWindowOpen(schedule: ReviewSchedule, nowMs: number = Date.now()): boolean {
  return nowMs >= schedule.dueAt.getTime() && nowMs <= resolveScheduleExpiresAt(schedule).getTime();
}

export function isReviewWindowExpired(schedule: ReviewSchedule, nowMs: number = Date.now()): boolean {
  return nowMs > resolveScheduleExpiresAt(schedule).getTime();
}

/** 리뷰 탭 기한과 무관하게 평가 화면 진입 가능 (열림 시각 이후, 미완료) */
export function isReviewEvaluable(schedule: ReviewSchedule, nowMs: number = Date.now()): boolean {
  if (schedule.status === 'done' || schedule.status === 'skipped') return false;
  return nowMs >= schedule.dueAt.getTime();
}

export function reviewWindowRemainingMs(schedule: ReviewSchedule, nowMs: number = Date.now()): number {
  return Math.max(0, resolveScheduleExpiresAt(schedule).getTime() - nowMs);
}

export function formatReviewWindowRemaining(schedule: ReviewSchedule, nowMs: number = Date.now()): string {
  const ms = reviewWindowRemainingMs(schedule, nowMs);
  if (ms <= 0) return '마감';
  const hours = Math.ceil(ms / (60 * 60 * 1000));
  return `${hours}시간 남음`;
}

export function monthGroupKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function formatMonthGroupLabel(key: string): string {
  const [y, m] = key.split('-').map(Number);
  if (!y || !m) return key;
  return `${y}년 ${m}월`;
}

export function formatCalendarMonth(date: Date): string {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

export function monthRange(year: number, month: number): { start: Date; end: Date } {
  return {
    start: new Date(year, month, 1, 0, 0, 0, 0),
    end: new Date(year, month + 1, 0, 23, 59, 59, 999),
  };
}

export function isSameCalendarMonth(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth();
}

export function isFutureCalendarMonth(date: Date, now: Date = new Date()): boolean {
  return (
    date.getFullYear() > now.getFullYear() ||
    (date.getFullYear() === now.getFullYear() && date.getMonth() > now.getMonth())
  );
}
