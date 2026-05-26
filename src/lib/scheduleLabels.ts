import type { ReviewSchedule, ScheduleType } from '@/lib/types';
import { formatReviewWindowRemaining } from '@/lib/reviewWindow';

export function scheduleDelayDays(type: ScheduleType): number {
  switch (type) {
    case 'immediate':
      return 0;
    case 'd1':
      return 1;
    case 'd7':
      return 7;
    case 'd3':
      return 3;
    case 'd30':
      return 30;
    default:
      return 0;
  }
}

/** 평가 대기 카드 — 남은 시간 */
export function scheduleRemainingLabel(schedule: ReviewSchedule): string {
  return formatReviewWindowRemaining(schedule);
}

/** 카드·목록용 짧은 설명 (레거시 D+N) */
export function scheduleDueLabel(type: ScheduleType): string {
  switch (type) {
    case 'immediate':
      return '직후 알림';
    case 'd1':
      return 'D+1';
    case 'd7':
      return 'D+7';
    case 'd3':
      return '3일 후';
    case 'd30':
      return 'D+30';
    default:
      return '';
  }
}
