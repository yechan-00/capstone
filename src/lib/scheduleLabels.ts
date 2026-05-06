import type { ScheduleType } from '@/lib/types';

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

/** 카드·목록용 짧은 설명 */
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
