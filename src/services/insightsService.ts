import { expenseService } from './expenseService';
import { reviewService } from './reviewService';
import {
  Insights,
  Expense,
  Review,
  ExpenseCategory,
  ExpenseMood,
  CategoryInsight,
  MoodInsight,
  TimeOfDayInsight,
  WeekdayInsight,
  WeekdayTimeCell,
  type Account,
  type FoodBudgetInsight,
  type IncomeInsight,
  type InsightsWindow,
} from '@/lib/types';
import { budgetPeriodForInsightsWindow } from '@/lib/budgetPeriod';
import { normalizeExpenseMood, EXPENSE_MOOD_OPTIONS } from '@/lib/expenseMood';
import {
  buildRegretPeriodSnapshot,
  buildRegretTrendRates,
  computeRegretAmountKrw,
  filterRegretReviews,
  previousInsightsWindow,
  reviewsForExpenses,
} from '@/lib/regretSummaryInsight';
import { getTimeOfDay } from '@/utils/time';
import { canonicalFoodCategory, type FoodCategoryKey } from '@/lib/categoryColors';
import { expenseCategoryLabel } from '@/lib/expenseCategoryLabel';

function sumCategoryAmounts(expenses: Expense[]): Record<FoodCategoryKey, number> {
  const out: Record<FoodCategoryKey, number> = { takeout: 0, delivery: 0, cafe: 0 };
  for (const e of expenses) {
    const key = canonicalFoodCategory(e.category);
    out[key] += e.amount || 0;
  }
  return out;
}

function buildIncomeInsight(
  totalSpendKrw: number,
  monthlyIncomeKrw: number,
  window: InsightsWindow,
): IncomeInsight | null {
  if (monthlyIncomeKrw <= 0) return null;
  const budgetKrw = window.mode === 'year' ? monthlyIncomeKrw * 12 : monthlyIncomeKrw;
  const spendRatioPercent = budgetKrw > 0 ? (totalSpendKrw / budgetKrw) * 100 : 0;
  const remainingKrw = budgetKrw - totalSpendKrw;
  return {
    monthlyIncomeKrw,
    budgetKrw,
    totalSpendKrw,
    spendRatioPercent,
    remainingKrw,
    isOverBudget: remainingKrw < 0,
  };
}

function buildFoodBudgetInsight(
  totalSpendKrw: number,
  foodBudgetKrw: number,
  window: InsightsWindow,
  account: Account | null,
): FoodBudgetInsight | null {
  if (foodBudgetKrw <= 0) return null;
  const period = budgetPeriodForInsightsWindow(window, account);
  const budgetKrw = window.mode === 'year' ? foodBudgetKrw * 12 : foodBudgetKrw;
  const spendRatioPercent = budgetKrw > 0 ? (totalSpendKrw / budgetKrw) * 100 : 0;
  const remainingKrw = budgetKrw - totalSpendKrw;
  return {
    budgetKrw,
    totalSpendKrw,
    spendRatioPercent,
    remainingKrw,
    isOverBudget: remainingKrw < 0,
    periodLabel: period.label,
    periodMode: period.mode,
    savingsPercentile: null,
  };
}

export function boundsForInsightsWindow(w: InsightsWindow, account: Account | null): { start: Date; end: Date } {
  if (w.mode === 'month' && account?.budgetPeriodMode === 'payday') {
    const period = budgetPeriodForInsightsWindow(w, account);
    return { start: period.start, end: period.end };
  }
  if (w.mode === 'year') {
    return {
      start: new Date(w.year, 0, 1, 0, 0, 0, 0),
      end: new Date(w.year, 11, 31, 23, 59, 59, 999),
    };
  }
  const start = new Date(w.year, w.monthIndex, 1, 0, 0, 0, 0);
  const end = new Date(w.year, w.monthIndex + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

export const insightsService = {
  async getInsights(
    accountId: string,
    window: InsightsWindow,
    account: Account | null,
    monthlyIncomeKrw = 0,
    foodBudgetKrw = 0,
  ): Promise<Insights> {
    try {
      const { start: startDate, end: endDate } = boundsForInsightsWindow(window, account);

      const withTimeout = async <T>(promise: Promise<T>, ms: number, label: string) => {
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error(`${label}-timeout`)), ms)
        );
        return Promise.race([promise, timeoutPromise]);
      };

      // 기간 내 지출 조회
      const expenses = await withTimeout(
        expenseService.getByAccountId(accountId),
        4000,
        'expenses'
      );
      const periodExpenses = expenses.filter(
        (e) => e.spentAt >= startDate && e.spentAt <= endDate
      );

      // 계정 전체 리뷰. 소비 후회율은 spentAt 기간의 소비에 최신 리뷰를 붙인다.
      const reviews = await withTimeout(
        reviewService.getByAccountId(accountId),
        4000,
        'reviews'
      );
      const periodReviews = reviews.filter(
        (r) => r.reviewedAt >= startDate && r.reviewedAt <= endDate
      );

    // 카테고리·요일·히트맵 등 '기록 대비' 지표는 기존처럼 기간 내 작성된 후회 리뷰를 사용
    const regretReviews = filterRegretReviews(periodReviews);

    const expenseMap = new Map(periodExpenses.map((e) => [e.id, e]));

    const prevWindow = previousInsightsWindow(window);
    const { start: prevStart, end: prevEnd } = boundsForInsightsWindow(prevWindow, account);
    const prevExpenses = expenses.filter((e) => e.spentAt >= prevStart && e.spentAt <= prevEnd);
    const previousPeriod =
      prevExpenses.length > 0
        ? buildRegretPeriodSnapshot(prevExpenses, reviews)
        : null;
    const previousCategoryAmounts =
      prevExpenses.length > 0 ? sumCategoryAmounts(prevExpenses) : null;

    const periodExpenseReviews = reviewsForExpenses(periodExpenses, reviews);
    const currentSnapshot = buildRegretPeriodSnapshot(periodExpenses, reviews);
    const regretAmountKrw = computeRegretAmountKrw(
      filterRegretReviews(periodExpenseReviews),
      expenseMap,
    );
    const regretTrendRates = buildRegretTrendRates(
      window,
      startDate,
      endDate,
      periodExpenses,
      reviews,
    );

    const weekdayExpenseCounts = [0, 0, 0, 0, 0, 0, 0];
    const weekdayCategoryCounts: Array<Record<string, number>> = Array.from({ length: 7 }, () => ({}));
    for (const e of periodExpenses) {
      const d = e.spentAt.getDay();
      weekdayExpenseCounts[d] += 1;
      const canonical = e.category === 'food' ? 'takeout' : e.category;
      if (canonical === 'delivery' || canonical === 'cafe' || canonical === 'takeout') {
        weekdayCategoryCounts[d][canonical] = (weekdayCategoryCounts[d][canonical] ?? 0) + 1;
      }
    }

    // 카테고리별 인사이트
    const categoryInsights = this.calculateCategoryInsights(
      periodExpenses,
      regretReviews,
      expenseMap
    );

    // 기분별 인사이트
    const moodInsights = this.calculateMoodInsights(
      periodExpenses,
      regretReviews,
      expenseMap
    );

    // 시간대별 인사이트
    const timeOfDayInsights = this.calculateTimeOfDayInsights(
      periodExpenses,
      regretReviews,
      expenseMap
    );

    const weekdayInsights = this.calculateWeekdayInsights(
      periodExpenses,
      regretReviews,
      expenseMap
    );

    const weekdayTimeInsights = this.calculateWeekdayTimeInsights(
      periodExpenses,
      regretReviews,
      expenseMap,
    );

    const totalSpendKrw = periodExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
    const incomeInsight = buildIncomeInsight(totalSpendKrw, monthlyIncomeKrw, window);
    const foodBudgetInsight = buildFoodBudgetInsight(totalSpendKrw, foodBudgetKrw, window, account);

    // 패턴 분석
    const patterns = this.generatePatterns(
      categoryInsights,
      periodExpenses.length,
      currentSnapshot.totalRegrets,
      currentSnapshot.totalReviews,
      incomeInsight,
      foodBudgetInsight,
      window.mode,
    );

      return {
        period: { start: startDate, end: endDate },
        periodMode: window.mode,
        categoryInsights,
        moodInsights,
        timeOfDayInsights,
        weekdayInsights,
        weekdayTimeInsights,
        weekdayExpenseCounts,
        weekdayCategoryCounts,
        totalExpenses: currentSnapshot.totalExpenses,
        totalSpendKrw,
        totalRegrets: currentSnapshot.totalRegrets,
        overallRegretRate: currentSnapshot.overallRegretRate,
        totalReviews: currentSnapshot.totalReviews,
        regretAmountKrw,
        previousPeriod,
        previousCategoryAmounts,
        regretTrendRates,
        incomeInsight,
        foodBudgetInsight,
        patterns,
      };
    } catch (error: any) {
      const message = String(error?.message || '');
      const code = String(error?.code || '');
      const isOffline =
        message.toLowerCase().includes('offline') ||
        message.endsWith('-timeout') ||
        code === 'unavailable' ||
        code === 'deadline-exceeded';

      if (isOffline) {
        console.warn('Insights fetch skipped (offline):', error);
        throw new Error('네트워크 연결을 확인해주세요.');
      }

      console.error('Failed to get insights:', error);
      throw new Error('인사이트를 조회하는데 실패했습니다.');
    }
  },

  calculateCategoryInsights(
    expenses: Expense[],
    regretReviews: Review[],
    expenseMap: Map<string, Expense>
  ) {
    const categoryMap = new Map<ExpenseCategory, { total: number; regrets: number; amount: number }>();

    expenses.forEach((expense) => {
      const current = categoryMap.get(expense.category) || { total: 0, regrets: 0, amount: 0 };
      categoryMap.set(expense.category, {
        ...current,
        total: current.total + 1,
        amount: current.amount + (expense.amount || 0),
      });
    });

    regretReviews.forEach((review) => {
      const expense = expenseMap.get(review.expenseId);
      if (expense) {
        const current = categoryMap.get(expense.category) || { total: 0, regrets: 0, amount: 0 };
        categoryMap.set(expense.category, { ...current, regrets: current.regrets + 1 });
      }
    });

    return Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      totalCount: data.total,
      totalAmountKrw: data.amount,
      regretCount: data.regrets,
      regretRate: data.total > 0 ? (data.regrets / data.total) * 100 : 0,
    }));
  },

  calculateMoodInsights(
    expenses: Expense[],
    regretReviews: Review[],
    expenseMap: Map<string, Expense>
  ): MoodInsight[] {
    const moodMap = new Map<ExpenseMood, { total: number; regrets: number }>();
    for (const option of EXPENSE_MOOD_OPTIONS) {
      moodMap.set(option.key, { total: 0, regrets: 0 });
    }

    expenses.forEach((expense) => {
      if (!expense.mood) return;
      const mood = normalizeExpenseMood(expense.mood) as ExpenseMood;
      if (!moodMap.has(mood)) return;
      const current = moodMap.get(mood)!;
      moodMap.set(mood, { ...current, total: current.total + 1 });
    });

    regretReviews.forEach((review) => {
      const expense = expenseMap.get(review.expenseId);
      if (!expense?.mood) return;
      const mood = normalizeExpenseMood(expense.mood) as ExpenseMood;
      if (!moodMap.has(mood)) return;
      const current = moodMap.get(mood)!;
      moodMap.set(mood, { ...current, regrets: current.regrets + 1 });
    });

    return EXPENSE_MOOD_OPTIONS.map((option) => {
      const data = moodMap.get(option.key)!;
      return {
        mood: option.key,
        totalCount: data.total,
        regretCount: data.regrets,
        regretRate: data.total > 0 ? (data.regrets / data.total) * 100 : 0,
      };
    });
  },

  calculateTimeOfDayInsights(
    expenses: Expense[],
    regretReviews: Review[],
    expenseMap: Map<string, Expense>
  ): TimeOfDayInsight[] {
    const timeOrder = ['morning', 'afternoon', 'evening', 'night'] as const;
    const timeMap = new Map<
      (typeof timeOrder)[number],
      { total: number; regrets: number }
    >();
    for (const slot of timeOrder) {
      timeMap.set(slot, { total: 0, regrets: 0 });
    }

    expenses.forEach((expense) => {
      const timeOfDay = getTimeOfDay(expense.spentAt);
      if (!timeMap.has(timeOfDay)) return;
      const current = timeMap.get(timeOfDay)!;
      timeMap.set(timeOfDay, { ...current, total: current.total + 1 });
    });

    regretReviews.forEach((review) => {
      const expense = expenseMap.get(review.expenseId);
      if (!expense) return;
      const timeOfDay = getTimeOfDay(expense.spentAt);
      if (!timeMap.has(timeOfDay)) return;
      const current = timeMap.get(timeOfDay)!;
      timeMap.set(timeOfDay, { ...current, regrets: current.regrets + 1 });
    });

    return timeOrder.map((timeOfDay) => {
      const data = timeMap.get(timeOfDay)!;
      return {
        timeOfDay,
        totalCount: data.total,
        regretCount: data.regrets,
        regretRate: data.total > 0 ? (data.regrets / data.total) * 100 : 0,
      };
    });
  },

  calculateWeekdayInsights(
    expenses: Expense[],
    regretReviews: Review[],
    expenseMap: Map<string, Expense>
  ): WeekdayInsight[] {
    const dayMap = new Map<number, { total: number; regrets: number }>();
    for (let weekday = 0; weekday < 7; weekday += 1) {
      dayMap.set(weekday, { total: 0, regrets: 0 });
    }

    expenses.forEach((expense) => {
      const weekday = expense.spentAt.getDay();
      const current = dayMap.get(weekday)!;
      dayMap.set(weekday, { ...current, total: current.total + 1 });
    });

    regretReviews.forEach((review) => {
      const expense = expenseMap.get(review.expenseId);
      if (!expense) return;
      const weekday = expense.spentAt.getDay();
      const current = dayMap.get(weekday)!;
      dayMap.set(weekday, { ...current, regrets: current.regrets + 1 });
    });

    return Array.from({ length: 7 }, (_, weekday) => {
      const data = dayMap.get(weekday)!;
      return {
        weekday,
        totalCount: data.total,
        regretCount: data.regrets,
        regretRate: data.total > 0 ? (data.regrets / data.total) * 100 : 0,
      };
    });
  },

  calculateWeekdayTimeInsights(
    expenses: Expense[],
    regretReviews: Review[],
    expenseMap: Map<string, Expense>,
  ): WeekdayTimeCell[] {
    const timeOrder = ['morning', 'afternoon', 'evening', 'night'] as const;
    const cellMap = new Map<string, { total: number; regrets: number; amount: number }>();

    for (let weekday = 0; weekday < 7; weekday += 1) {
      for (const slot of timeOrder) {
        cellMap.set(`${weekday}:${slot}`, { total: 0, regrets: 0, amount: 0 });
      }
    }

    expenses.forEach((expense) => {
      const weekday = expense.spentAt.getDay();
      const timeOfDay = getTimeOfDay(expense.spentAt);
      const key = `${weekday}:${timeOfDay}`;
      const current = cellMap.get(key)!;
      cellMap.set(key, {
        ...current,
        total: current.total + 1,
        amount: current.amount + (expense.amount || 0),
      });
    });

    regretReviews.forEach((review) => {
      const expense = expenseMap.get(review.expenseId);
      if (!expense) return;
      const weekday = expense.spentAt.getDay();
      const timeOfDay = getTimeOfDay(expense.spentAt);
      const key = `${weekday}:${timeOfDay}`;
      const current = cellMap.get(key)!;
      cellMap.set(key, { ...current, regrets: current.regrets + 1 });
    });

    const cells: WeekdayTimeCell[] = [];
    for (let weekday = 0; weekday < 7; weekday += 1) {
      for (const timeOfDay of timeOrder) {
        const data = cellMap.get(`${weekday}:${timeOfDay}`)!;
        cells.push({
          weekday,
          timeOfDay,
          totalCount: data.total,
          regretCount: data.regrets,
          regretRate: data.total > 0 ? (data.regrets / data.total) * 100 : 0,
          totalAmountKrw: data.amount,
        });
      }
    }
    return cells;
  },

  generatePatterns(
    categoryInsights: CategoryInsight[],
    totalExpenses: number,
    totalRegrets: number,
    totalReviews: number,
    incomeInsight: IncomeInsight | null,
    foodBudgetInsight: FoodBudgetInsight | null,
    periodMode: 'month' | 'year',
  ): string[] {
    const patterns: string[] = [];

    if (foodBudgetInsight && foodBudgetInsight.totalSpendKrw > 0) {
      const pct = foodBudgetInsight.spendRatioPercent;
      if (foodBudgetInsight.isOverBudget) {
        patterns.push(
          `식비 예산 대비 ${pct.toFixed(0)}%를 썼어요. ${Math.abs(foodBudgetInsight.remainingKrw).toLocaleString()}원을 초과했습니다.`,
        );
      } else if (foodBudgetInsight.remainingKrw > 0) {
        patterns.push(
          `식비 예산에서 ${foodBudgetInsight.remainingKrw.toLocaleString()}원이 남았어요. (소비율 ${pct.toFixed(0)}%)`,
        );
      }
    }

    if (incomeInsight && incomeInsight.totalSpendKrw > 0) {
      const pct = incomeInsight.spendRatioPercent;
      const periodKo = periodMode === 'year' ? '올해' : '이번 달';
      if (incomeInsight.isOverBudget) {
        patterns.push(
          `${periodKo} 소비가 설정 수입의 ${pct.toFixed(0)}%로, 예산을 ${Math.abs(incomeInsight.remainingKrw).toLocaleString()}원 넘었어요.`,
        );
      } else if (pct >= 70) {
        patterns.push(`${periodKo} 소비가 월 수입 기준 예산의 ${pct.toFixed(0)}%에 달했어요.`);
      } else if (pct >= 40) {
        patterns.push(`${periodKo} 소비율은 약 ${pct.toFixed(0)}%예요. 수입 대비 여유가 ${incomeInsight.remainingKrw.toLocaleString()}원 남았어요.`);
      }
    }

    if (totalExpenses === 0 || totalReviews === 0) {
      return patterns.slice(0, 2);
    }

    const regretRate = (totalRegrets / totalReviews) * 100;

    const topRegretCategory = categoryInsights
      .filter((c) => c.totalCount >= 3)
      .sort((a, b) => b.regretRate - a.regretRate)[0];

    if (topRegretCategory && topRegretCategory.regretRate > 40) {
      const label = expenseCategoryLabel(topRegretCategory.category);
      patterns.push(`"${label}"에서 후회 비율이 ${topRegretCategory.regretRate.toFixed(0)}%예요.`);
    } else if (regretRate >= 35) {
      patterns.push(`기간 내 후회 비율이 ${regretRate.toFixed(0)}%입니다.`);
    }

    return patterns.slice(0, 2);
  },
};
