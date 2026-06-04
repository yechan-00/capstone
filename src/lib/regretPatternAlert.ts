import type { Expense, Review, TimeOfDayInsight, WeekdayInsight, RegretPatternAlertSlot } from '@/lib/types';
import { getTimeOfDay } from '@/utils/time';
import {
  TIME_OF_DAY_LABELS,
  TIME_OF_DAY_RANGES,
  weekdayLabel,
} from '@/lib/timePatternInsight';

/** 알림 발송 최소 기록 건수 */
export const REGRET_PATTERN_MIN_TOTAL = 3;
/** 알림 발송 최소 후회율(%) */
export const REGRET_PATTERN_MIN_RATE = 25;
/** 평균 구매 시각보다 몇 분 일찍 알림을 보낼지 */
export const REGRET_PATTERN_ALERT_LEAD_MINUTES = 10;

export type { RegretPatternAlertSlot };

const FALLBACK_ALERT_HOUR: Record<
  'morning' | 'afternoon' | 'evening' | 'night',
  { hour: number; minute: number }
> = {
  morning: { hour: 8, minute: 50 },
  afternoon: { hour: 13, minute: 50 },
  evening: { hour: 18, minute: 50 },
  night: { hour: 21, minute: 50 },
};

function qualifies(totalCount: number, regretCount: number, regretRate: number): boolean {
  if (totalCount < REGRET_PATTERN_MIN_TOTAL) return false;
  if (regretCount <= 0) return false;
  return regretRate >= REGRET_PATTERN_MIN_RATE;
}

function averagePurchaseTime(expenses: Expense[]): { hour: number; minute: number } | null {
  if (expenses.length === 0) return null;
  const totalMinutes = expenses.reduce(
    (sum, expense) => sum + expense.spentAt.getHours() * 60 + expense.spentAt.getMinutes(),
    0,
  );
  const avg = Math.round(totalMinutes / expenses.length);
  return { hour: Math.floor(avg / 60) % 24, minute: avg % 60 };
}

export function subtractMinutes(
  hour: number,
  minute: number,
  delta: number,
): { hour: number; minute: number } {
  let total = hour * 60 + minute - delta;
  while (total < 0) total += 24 * 60;
  total %= 24 * 60;
  return { hour: Math.floor(total / 60), minute: total % 60 };
}

function formatClock(hour: number, minute: number): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

function resolveAlertTime(params: {
  expenses: Expense[];
  slotMatch: (expense: Expense) => boolean;
  regretMatch: (expense: Expense) => boolean;
  fallback: { hour: number; minute: number };
}): { hour: number; minute: number; avgPurchaseHour?: number; avgPurchaseMinute?: number } {
  const regretMatched = params.expenses.filter(params.regretMatch);
  const slotMatched = params.expenses.filter(params.slotMatch);
  const source = averagePurchaseTime(regretMatched.length > 0 ? regretMatched : slotMatched) ?? params.fallback;
  const alert = subtractMinutes(source.hour, source.minute, REGRET_PATTERN_ALERT_LEAD_MINUTES);
  return {
    ...alert,
    avgPurchaseHour: source.hour,
    avgPurchaseMinute: source.minute,
  };
}

/** Expo weekly trigger: 1=일요일 … 7=토요일 (Date.getDay() 0=일) */
export function toExpoWeekday(getDayIndex: number): number {
  return getDayIndex + 1;
}

export function buildRegretPatternAlertTitle(): string {
  return '한번 참아볼까요?';
}

export function buildRegretPatternAlertBody(slot: RegretPatternAlertSlot): string {
  const lead = REGRET_PATTERN_ALERT_LEAD_MINUTES;
  if (slot.kind === 'weekday' && slot.weekday != null) {
    return `${weekdayLabel(slot.weekday)}요일에는 후회 소비가 ${slot.regretRate.toFixed(0)}%였어요. 평소 구매 시각보다 ${lead}분 일찍, 지금 한번 멈춰볼까요?`;
  }
  if (slot.kind === 'time' && slot.timeOfDay) {
    const label = TIME_OF_DAY_LABELS[slot.timeOfDay];
    const range = TIME_OF_DAY_RANGES[slot.timeOfDay];
    return `${label}(${range}) 시간대에 후회가 잦았어요. 평소 구매 시각보다 ${lead}분 일찍, 충동구매 전에 잠깐 멈춰볼까요?`;
  }
  return `이 시간대는 후회가 많았던 소비가 잦아요. 평소보다 ${lead}분 일찍, 한번 참아볼까요?`;
}

export function pickRegretPatternAlertSlots(
  weekdayInsights: WeekdayInsight[],
  timeOfDayInsights: TimeOfDayInsight[],
  expenses: Expense[],
  regretExpenseIds: Set<string>,
): RegretPatternAlertSlot[] {
  const slots: RegretPatternAlertSlot[] = [];

  const topWeekday = [...weekdayInsights]
    .filter((w) => qualifies(w.totalCount, w.regretCount, w.regretRate))
    .sort((a, b) => b.regretRate - a.regretRate || b.regretCount - a.regretCount)[0];

  if (topWeekday) {
    const alertTime = resolveAlertTime({
      expenses,
      slotMatch: (expense) => expense.spentAt.getDay() === topWeekday.weekday,
      regretMatch: (expense) =>
        expense.spentAt.getDay() === topWeekday.weekday && regretExpenseIds.has(expense.id),
      fallback: { hour: 19, minute: 50 },
    });
    slots.push({
      id: `weekday-${topWeekday.weekday}`,
      kind: 'weekday',
      weekday: topWeekday.weekday,
      hour: alertTime.hour,
      minute: alertTime.minute,
      label: `${weekdayLabel(topWeekday.weekday)}요일`,
      regretRate: topWeekday.regretRate,
      totalCount: topWeekday.totalCount,
      regretCount: topWeekday.regretCount,
      avgPurchaseHour: alertTime.avgPurchaseHour,
      avgPurchaseMinute: alertTime.avgPurchaseMinute,
      leadMinutes: REGRET_PATTERN_ALERT_LEAD_MINUTES,
    });
  }

  const topTime = [...timeOfDayInsights]
    .filter((t) => qualifies(t.totalCount, t.regretCount, t.regretRate))
    .sort((a, b) => b.regretRate - a.regretRate || b.regretCount - a.regretCount)[0];

  if (topTime) {
    const fallback = FALLBACK_ALERT_HOUR[topTime.timeOfDay];
    const alertTime = resolveAlertTime({
      expenses,
      slotMatch: (expense) => getTimeOfDay(expense.spentAt) === topTime.timeOfDay,
      regretMatch: (expense) =>
        getTimeOfDay(expense.spentAt) === topTime.timeOfDay && regretExpenseIds.has(expense.id),
      fallback,
    });
    slots.push({
      id: `time-${topTime.timeOfDay}`,
      kind: 'time',
      timeOfDay: topTime.timeOfDay,
      hour: alertTime.hour,
      minute: alertTime.minute,
      label: TIME_OF_DAY_LABELS[topTime.timeOfDay],
      regretRate: topTime.regretRate,
      totalCount: topTime.totalCount,
      regretCount: topTime.regretCount,
      avgPurchaseHour: alertTime.avgPurchaseHour,
      avgPurchaseMinute: alertTime.avgPurchaseMinute,
      leadMinutes: REGRET_PATTERN_ALERT_LEAD_MINUTES,
    });
  }

  return slots;
}

export function formatRegretPatternAlertSummary(slots: RegretPatternAlertSlot[]): string {
  if (slots.length === 0) {
    return `기록 ${REGRET_PATTERN_MIN_TOTAL}건 이상·후회율 ${REGRET_PATTERN_MIN_RATE}% 이상이면, 평소 구매 시각 ${REGRET_PATTERN_ALERT_LEAD_MINUTES}분 전에 알림을 보내요.`;
  }
  return slots
    .map((slot) => {
      const when = formatClock(slot.hour, slot.minute);
      if (slot.kind === 'weekday' && slot.weekday != null) {
        return `매주 ${weekdayLabel(slot.weekday)} ${when}`;
      }
      return `매일 ${when}`;
    })
    .join(' · ');
}

export function buildRegretPatternHomeHeadline(
  weekdayInsights: WeekdayInsight[],
  timeOfDayInsights: TimeOfDayInsight[],
): string | null {
  const topWeekday = [...weekdayInsights]
    .filter((w) => qualifies(w.totalCount, w.regretCount, w.regretRate))
    .sort((a, b) => b.regretRate - a.regretRate || b.regretCount - a.regretCount)[0];
  const topTime = [...timeOfDayInsights]
    .filter((t) => qualifies(t.totalCount, t.regretCount, t.regretRate))
    .sort((a, b) => b.regretRate - a.regretRate || b.regretCount - a.regretCount)[0];

  if (!topWeekday && !topTime) {
    const anyRecords = weekdayInsights.some((w) => w.totalCount > 0);
    if (!anyRecords) return null;
    return '아직 뚜렷한 후회 패턴은 없어요. 기록이 쌓이면 구매 전에 알려드릴게요.';
  }

  const parts: string[] = [];
  if (topWeekday) parts.push(`${weekdayLabel(topWeekday.weekday)}요일`);
  if (topTime) {
    parts.push(`${TIME_OF_DAY_LABELS[topTime.timeOfDay]}(${TIME_OF_DAY_RANGES[topTime.timeOfDay]})`);
  }
  return `${parts.join(' · ')}에 후회가 많았어요 · 평소 구매 ${REGRET_PATTERN_ALERT_LEAD_MINUTES}분 전에 알림`;
}
