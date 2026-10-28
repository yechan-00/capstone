import type { Review, ReviewSchedule } from '@/lib/types';
import { isReviewEvaluable, isReviewWindowOpen } from '@/lib/reviewWindow';

export type ExpenseReviewKind = 'completed' | 'open' | 'evaluable' | 'waiting' | 'none';

export type ExpenseReviewState = {
  kind: ExpenseReviewKind;
  /** 평가 이동·대기 안내에 사용할 스케줄 (완료만 있으면 null) */
  schedule: ReviewSchedule | null;
};

function byDueAt(a: ReviewSchedule, b: ReviewSchedule): number {
  return a.dueAt.getTime() - b.dueAt.getTime();
}

function isActiveStatus(schedule: ReviewSchedule): boolean {
  return schedule.status === 'pending' || schedule.status === 'expired';
}

/**
 * 홈 바텀시트와 소비 상세가 공유하는 리뷰 UI 상태.
 * 기존 정책: dueAt 이후·미완료(pending/expired)면 평가 가능.
 * 47h59m 창은 리뷰 탭 노출 기한이며, 만료 후에도 평가는 가능하다.
 */
export function resolveExpenseReviewState(
  reviews: Review[],
  schedules: ReviewSchedule[],
  nowMs: number = Date.now(),
): ExpenseReviewState {
  if (reviews.length > 0) {
    return { kind: 'completed', schedule: null };
  }

  const active = schedules.filter(isActiveStatus).sort(byDueAt);

  const waiting = active.find((s) => s.dueAt.getTime() > nowMs) ?? null;
  const windowOpen =
    active.find((s) => isReviewEvaluable(s, nowMs) && isReviewWindowOpen(s, nowMs)) ?? null;
  const evaluable = active.find((s) => isReviewEvaluable(s, nowMs)) ?? null;

  if (windowOpen) return { kind: 'open', schedule: windowOpen };
  if (evaluable) return { kind: 'evaluable', schedule: evaluable };
  if (waiting) return { kind: 'waiting', schedule: waiting };
  return { kind: 'none', schedule: null };
}

export function formatReviewWaitHint(schedule: ReviewSchedule, nowMs: number = Date.now()): string {
  const due = schedule.dueAt;
  const ms = due.getTime() - nowMs;
  if (ms <= 0) return '';

  const hours = Math.ceil(ms / (60 * 60 * 1000));
  if (hours >= 24) {
    const days = Math.ceil(hours / 24);
    if (days === 1) return '내일부터 평가할 수 있어요.';
    return `${days}일 뒤에 평가할 수 있어요.`;
  }
  return `약 ${hours}시간 뒤에 평가할 수 있어요.`;
}
