import { isRegretReview } from '@/lib/moodInsightDetail';
import {
  accumulateDailyRegretRates,
  chartEndDay,
  type DailyRegretPoint,
} from '@/lib/regretDailyCumulative';
import { computeRegretRateFromReviews, reviewsForExpenses } from '@/lib/regretSummaryInsight';
import type { Expense, Review } from '@/lib/types';

export type { DailyRegretPoint };

export function toDayKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 사진이 있는 최신 기록을 우선하고, 시간이 같으면 금액이 큰 기록을 대표 사진으로 사용 */
export function sortExpensesForCalendarCells(day: Expense[]): Expense[] {
  return [...day].sort((a, b) => {
    const imageDiff = Number(Boolean(b.imageUrl)) - Number(Boolean(a.imageUrl));
    if (imageDiff !== 0) return imageDiff;
    const timeDiff = b.spentAt.getTime() - a.spentAt.getTime();
    if (timeDiff !== 0) return timeDiff;
    return (Number(b.amount) || 0) - (Number(a.amount) || 0);
  });
}

export function buildDailyCumulativeRegretSeries(
  expenses: Expense[],
  reviews: Review[] | Map<string, Review>,
  viewingMonth: Date,
  now: Date,
): DailyRegretPoint[] {
  const endDay = chartEndDay(viewingMonth, now);
  const year = viewingMonth.getFullYear();
  const monthIndex = viewingMonth.getMonth();
  const expenseById = new Map(expenses.map((expense) => [expense.id, expense] as const));
  const deltas = [];
  for (const review of reviewsForExpenses(expenses, reviews)) {
    const expense = expenseById.get(review.expenseId);
    if (!expense) continue;
    if (expense.spentAt.getFullYear() !== year || expense.spentAt.getMonth() !== monthIndex) {
      continue;
    }
    deltas.push({
      day: expense.spentAt.getDate(),
      reviewCount: 1,
      regretCount: isRegretReview(review) ? 1 : 0,
    });
  }
  return accumulateDailyRegretRates(year, monthIndex, endDay, deltas);
}

export function buildHomeRegretSummary(
  currentExpenses: Expense[],
  previousExpenses: Expense[],
  reviewsByExpenseId: Map<string, Review>,
  currentMonth: Date,
  now: Date = new Date(),
): {
  rate: number | null;
  deltaPp: number | null;
  dailyPoints: DailyRegretPoint[];
  regretCount: number;
  reviewCount: number;
} {
  const reviewsFor = (items: Expense[]) => reviewsForExpenses(items, reviewsByExpenseId);

  const snapshot = (items: Expense[]) => {
    const { regretCount, reviewCount, ratePercent } = computeRegretRateFromReviews(
      reviewsFor(items),
    );
    return { rate: ratePercent, regretCount, reviewCount };
  };

  const dailyPoints = buildDailyCumulativeRegretSeries(
    currentExpenses,
    reviewsByExpenseId,
    currentMonth,
    now,
  );
  const lastPoint = dailyPoints[dailyPoints.length - 1];
  const current =
    lastPoint != null
      ? {
          rate: lastPoint.ratePercent,
          regretCount: lastPoint.regretCount,
          reviewCount: lastPoint.reviewCount,
        }
      : snapshot(currentExpenses);
  const previous = snapshot(previousExpenses);
  const deltaPp =
    current.rate !== null && previous.rate !== null ? current.rate - previous.rate : null;

  return { ...current, deltaPp, dailyPoints };
}

/** 이번 달 지출을 외식(포장)·배달·카페로 합산 (레거시 food는 포장 외식에 포함) */
export function summarizeMonthByCategory(expenses: Expense[]): {
  takeout: number;
  delivery: number;
  cafe: number;
  total: number;
} {
  let takeout = 0;
  let delivery = 0;
  let cafe = 0;
  for (const e of expenses) {
    const amt = Number(e.amount) || 0;
    if (e.category === 'delivery') delivery += amt;
    else if (e.category === 'cafe') cafe += amt;
    else takeout += amt;
  }
  return { takeout, delivery, cafe, total: takeout + delivery + cafe };
}

export function formatMonth(date: Date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

export function formatDetailDayHeading(dayKey: string): string {
  const [ys, ms, ds] = dayKey.split('-');
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  if (!y || !m || !d) return dayKey;
  const dt = new Date(y, m - 1, d);
  const w = ['일', '월', '화', '수', '목', '금', '토'][dt.getDay()];
  return `${y}년 ${m}월 ${d}일 (${w})`;
}

export function formatKoreanSpentAt(date: Date): string {
  const hour = date.getHours();
  const minute = date.getMinutes();
  const period = hour >= 12 ? '오후' : '오전';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const mm = String(minute).padStart(2, '0');
  return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}. ${period} ${h12}:${mm}`;
}

export function buildCalendarCells(currentMonth: Date): Array<number | null> {
  const first = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const cells: Array<number | null> = [];
  for (let i = 0; i < first.getDay(); i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}
