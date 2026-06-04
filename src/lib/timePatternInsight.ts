import type { TimeOfDayInsight, WeekdayInsight } from '@/lib/types';

/** 막대 그래프 표시 순: 월→일 (getDay 1…6, 0) */
export const WEEKDAY_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;

const WEEKDAY_LABEL_BY_INDEX = ['일', '월', '화', '수', '목', '금', '토'] as const;

export function weekdayLabel(weekday: number): string {
  return WEEKDAY_LABEL_BY_INDEX[weekday] ?? '?';
}

export const TIME_OF_DAY_ORDER = ['morning', 'afternoon', 'evening', 'night'] as const;

export const TIME_OF_DAY_LABELS: Record<(typeof TIME_OF_DAY_ORDER)[number], string> = {
  morning: '아침',
  afternoon: '낮',
  evening: '저녁',
  night: '밤',
};

export const TIME_OF_DAY_RANGES: Record<(typeof TIME_OF_DAY_ORDER)[number], string> = {
  morning: '6~12시',
  afternoon: '12~18시',
  evening: '18~22시',
  night: '22~6시',
};

export function buildTimePatternHeadline(
  weekdayInsights: WeekdayInsight[],
  timeOfDayInsights: TimeOfDayInsight[],
): string | null {
  const topWeekday = [...weekdayInsights]
    .filter((w) => w.totalCount > 0 && w.regretCount > 0)
    .sort((a, b) => b.regretRate - a.regretRate || b.regretCount - a.regretCount)[0];
  const topTime = [...timeOfDayInsights]
    .filter((t) => t.totalCount > 0 && t.regretCount > 0)
    .sort((a, b) => b.regretRate - a.regretRate || b.regretCount - a.regretCount)[0];

  if (!topWeekday && !topTime) {
    const anyRecords = weekdayInsights.some((w) => w.totalCount > 0);
    if (!anyRecords) return null;
    return '아직 후회 패턴이 뚜렷하지 않아요. 기록이 쌓이면 알림에 활용할 수 있어요.';
  }

  const parts: string[] = [];
  if (topWeekday) parts.push(`${weekdayLabel(topWeekday.weekday)}요일`);
  if (topTime) parts.push(`${TIME_OF_DAY_LABELS[topTime.timeOfDay]}(${TIME_OF_DAY_RANGES[topTime.timeOfDay]})`);
  return `${parts.join(' · ')}에 후회가 많았어요`;
}
