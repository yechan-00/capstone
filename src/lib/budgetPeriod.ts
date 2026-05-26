import type { Account } from '@/lib/types';
import { DEFAULT_EXCHANGE_USD_KRW } from '@/lib/accountSettings';

export type BudgetPeriodMode = 'calendar' | 'payday';

export const DEFAULT_PAYDAY_DAY = 25;

export function resolveBudgetPeriodMode(account: Account | null | undefined): BudgetPeriodMode {
  return account?.budgetPeriodMode === 'payday' ? 'payday' : 'calendar';
}

export function resolvePaydayDay(account: Account | null | undefined): number {
  const d = account?.paydayDayOfMonth;
  if (typeof d === 'number' && d >= 1 && d <= 31) return Math.floor(d);
  return DEFAULT_PAYDAY_DAY;
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/** 해당 연·월에 실제 적용되는 월급날 (31일 → 2월은 28/29일) */
export function clampPaydayDay(year: number, monthIndex: number, paydayDay: number): number {
  return Math.min(Math.max(1, paydayDay), daysInMonth(year, monthIndex));
}

export function toFoodBudgetKrw(account: {
  foodBudgetAmount?: number;
  foodBudgetCurrency?: 'KRW' | 'USD';
  exchangeRateUsdToKrw?: number;
}): number {
  const amount = typeof account.foodBudgetAmount === 'number' ? account.foodBudgetAmount : 0;
  if (amount <= 0) return 0;
  if (account.foodBudgetCurrency === 'USD') {
    const rate = account.exchangeRateUsdToKrw ?? DEFAULT_EXCHANGE_USD_KRW;
    return Math.round(amount * rate);
  }
  return amount;
}

export type BudgetPeriodBounds = {
  start: Date;
  end: Date;
  label: string;
  mode: BudgetPeriodMode;
};

function calendarMonthBounds(year: number, monthIndex: number): BudgetPeriodBounds {
  const start = new Date(year, monthIndex, 1, 0, 0, 0, 0);
  const end = new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
  return {
    start,
    end,
    label: `${year}년 ${monthIndex + 1}월`,
    mode: 'calendar',
  };
}

/** 월급날 기준: 해당 달 월급날 ~ 다음 달 월급날 전날 (예: 5/10~6/9) */
function paydayMonthBounds(year: number, monthIndex: number, paydayDay: number): BudgetPeriodBounds {
  const startDay = clampPaydayDay(year, monthIndex, paydayDay);
  const start = new Date(year, monthIndex, startDay, 0, 0, 0, 0);

  const nextMonthIndex = monthIndex === 11 ? 0 : monthIndex + 1;
  const nextYear = monthIndex === 11 ? year + 1 : year;
  const nextPayday = clampPaydayDay(nextYear, nextMonthIndex, paydayDay);
  const end = new Date(nextYear, nextMonthIndex, nextPayday, 0, 0, 0, 0);
  end.setDate(end.getDate() - 1);
  end.setHours(23, 59, 59, 999);

  return {
    start,
    end,
    label: `${year}년 ${monthIndex + 1}월`,
    mode: 'payday',
  };
}

export function budgetPeriodForMonth(
  year: number,
  monthIndex: number,
  account: Account | null | undefined,
): BudgetPeriodBounds {
  if (resolveBudgetPeriodMode(account) === 'payday') {
    return paydayMonthBounds(year, monthIndex, resolvePaydayDay(account));
  }
  return calendarMonthBounds(year, monthIndex);
}

/** 오늘이 포함된 예산 주기 */
export function currentBudgetPeriod(account: Account | null | undefined, now = new Date()): BudgetPeriodBounds {
  if (resolveBudgetPeriodMode(account) !== 'payday') {
    return calendarMonthBounds(now.getFullYear(), now.getMonth());
  }
  const payday = resolvePaydayDay(account);
  const y = now.getFullYear();
  const m = now.getMonth();
  const thisPayday = clampPaydayDay(y, m, payday);
  if (now.getDate() >= thisPayday) {
    return paydayMonthBounds(y, m, payday);
  }
  const prevM = m === 0 ? 11 : m - 1;
  const prevY = m === 0 ? y - 1 : y;
  return paydayMonthBounds(prevY, prevM, payday);
}

export function formatBudgetPeriodRange(start: Date, end: Date): string {
  const fmt = (d: Date) => `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
  return `${fmt(start)} ~ ${fmt(end)}`;
}

export function isPaydayCell(year: number, monthIndex: number, day: number, account: Account | null | undefined): boolean {
  if (resolveBudgetPeriodMode(account) !== 'payday') return false;
  return day === clampPaydayDay(year, monthIndex, resolvePaydayDay(account));
}

/** InsightsWindow → 조회 구간 (식비 예산·통계용) */
export function budgetPeriodForInsightsWindow(
  window: { mode: 'month'; year: number; monthIndex: number } | { mode: 'year'; year: number },
  account: Account | null | undefined,
): BudgetPeriodBounds {
  if (window.mode === 'year') {
    const start = new Date(window.year, 0, 1, 0, 0, 0, 0);
    const end = new Date(window.year, 11, 31, 23, 59, 59, 999);
    return {
      start,
      end,
      label: `${window.year}년`,
      mode: resolveBudgetPeriodMode(account),
    };
  }
  return budgetPeriodForMonth(window.year, window.monthIndex, account);
}
