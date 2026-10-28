import type { Account, InsightsWindow } from '@/lib/types';
import { currentInsightsMonthWindow } from '@/lib/budgetPeriod';

export function shiftInsightsWindow(window: InsightsWindow, delta: number): InsightsWindow {
  if (window.mode === 'year') {
    return { mode: 'year', year: window.year + delta };
  }
  let monthIndex = window.monthIndex + delta;
  let year = window.year;
  while (monthIndex < 0) {
    monthIndex += 12;
    year -= 1;
  }
  while (monthIndex > 11) {
    monthIndex -= 12;
    year += 1;
  }
  return { mode: 'month', year, monthIndex };
}

export function currentInsightsYear(): number {
  return new Date().getFullYear();
}

/** 직전/다음 탐색 가능 여부 (미래 기간 제한) */
export function canShiftInsightsWindow(
  window: InsightsWindow,
  delta: number,
  account?: Account | null,
): boolean {
  const next = shiftInsightsWindow(window, delta);
  const now = new Date();
  const cy = now.getFullYear();

  if (next.mode === 'year') {
    if (delta > 0) return next.year <= cy;
    return next.year >= cy - 5;
  }

  const current = currentInsightsMonthWindow(account);
  if (current.mode !== 'month') {
    if (delta > 0) {
      return next.year < cy || (next.year === cy && next.monthIndex <= now.getMonth());
    }
    return next.year >= cy - 5;
  }

  if (delta > 0) {
    if (next.year > current.year) return false;
    if (next.year === current.year && next.monthIndex > current.monthIndex) return false;
    return true;
  }

  return next.year >= cy - 5;
}

export function formatPeriodNavLabel(window: InsightsWindow): string {
  if (window.mode === 'year') return `${window.year}년`;
  return `${window.year}년 ${window.monthIndex + 1}월`;
}

export function hasDisplayableRegretTrend(rates: Array<number | null> | null): boolean {
  if (!rates) return false;
  const defined = rates.filter((rate): rate is number => rate != null && Number.isFinite(rate));
  if (defined.length < 2) return false;
  const max = Math.max(...defined);
  const min = Math.min(...defined);
  if (max - min >= 0.5) return true;
  return max > 0;
}
