import { subDays } from 'date-fns';
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
} from '@/lib/types';
import { getTimeOfDay } from '@/utils/time';
import { isDeliveryOrTakeout } from '@/lib/categoryAnalytics';

export const insightsService = {
  async getInsights(accountId: string, days: number = 30): Promise<Insights> {
    try {
      const endDate = new Date();
      const startDate = subDays(endDate, days);

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

      // 기간 내 리뷰 조회
      const reviews = await withTimeout(
        reviewService.getByAccountId(accountId),
        4000,
        'reviews'
      );
      const periodReviews = reviews.filter(
        (r) => r.reviewedAt >= startDate && r.reviewedAt <= endDate
      );

    // 후회 판단: decisionAgain === 'no' 또는 satisfaction <= 2
    const regretReviews = periodReviews.filter(
      (r) => r.decisionAgain === 'no' || r.satisfaction <= 2
    );

    const expenseMap = new Map(periodExpenses.map((e) => [e.id, e]));

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

    // 패턴 분석
    const patterns = this.generatePatterns(
      categoryInsights,
      moodInsights,
      timeOfDayInsights,
      periodExpenses.length,
      regretReviews.length
    );

      const dtTotal = periodExpenses.filter((e) => isDeliveryOrTakeout(e.category)).length;
      const dtRegret = regretReviews.filter((r) => {
        const e = expenseMap.get(r.expenseId);
        return e && isDeliveryOrTakeout(e.category);
      }).length;
      if (dtTotal >= 3 && dtRegret / dtTotal > 0.35) {
        patterns.push(
          `배달·외식(포장)을 합쳐 보면, 후회 비율이 ${((dtRegret / dtTotal) * 100).toFixed(1)}%로 나타나요.`
        );
      }

      return {
        period: { start: startDate, end: endDate },
        categoryInsights,
        moodInsights,
        timeOfDayInsights,
        totalExpenses: periodExpenses.length,
        totalRegrets: regretReviews.length,
        overallRegretRate:
          periodExpenses.length > 0
            ? (regretReviews.length / periodExpenses.length) * 100
            : 0,
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
    const categoryMap = new Map<ExpenseCategory, { total: number; regrets: number }>();

    expenses.forEach((expense) => {
      const current = categoryMap.get(expense.category) || { total: 0, regrets: 0 };
      categoryMap.set(expense.category, { ...current, total: current.total + 1 });
    });

    regretReviews.forEach((review) => {
      const expense = expenseMap.get(review.expenseId);
      if (expense) {
        const current = categoryMap.get(expense.category) || { total: 0, regrets: 0 };
        categoryMap.set(expense.category, { ...current, regrets: current.regrets + 1 });
      }
    });

    return Array.from(categoryMap.entries()).map(([category, data]) => ({
      category,
      totalCount: data.total,
      regretCount: data.regrets,
      regretRate: data.total > 0 ? (data.regrets / data.total) * 100 : 0,
    }));
  },

  calculateMoodInsights(
    expenses: Expense[],
    regretReviews: Review[],
    expenseMap: Map<string, Expense>
  ) {
    const moodMap = new Map<ExpenseMood, { total: number; regrets: number }>();

    expenses.forEach((expense) => {
      const current = moodMap.get(expense.mood) || { total: 0, regrets: 0 };
      moodMap.set(expense.mood, { ...current, total: current.total + 1 });
    });

    regretReviews.forEach((review) => {
      const expense = expenseMap.get(review.expenseId);
      if (expense) {
        const current = moodMap.get(expense.mood) || { total: 0, regrets: 0 };
        moodMap.set(expense.mood, { ...current, regrets: current.regrets + 1 });
      }
    });

    return Array.from(moodMap.entries()).map(([mood, data]) => ({
      mood,
      totalCount: data.total,
      regretCount: data.regrets,
      regretRate: data.total > 0 ? (data.regrets / data.total) * 100 : 0,
    }));
  },

  calculateTimeOfDayInsights(
    expenses: Expense[],
    regretReviews: Review[],
    expenseMap: Map<string, Expense>
  ) {
    const timeMap = new Map<
      'morning' | 'afternoon' | 'evening' | 'night',
      { total: number; regrets: number }
    >();

    expenses.forEach((expense) => {
      const timeOfDay = getTimeOfDay(expense.spentAt);
      const current = timeMap.get(timeOfDay) || { total: 0, regrets: 0 };
      timeMap.set(timeOfDay, { ...current, total: current.total + 1 });
    });

    regretReviews.forEach((review) => {
      const expense = expenseMap.get(review.expenseId);
      if (expense) {
        const timeOfDay = getTimeOfDay(expense.spentAt);
        const current = timeMap.get(timeOfDay) || { total: 0, regrets: 0 };
        timeMap.set(timeOfDay, { ...current, regrets: current.regrets + 1 });
      }
    });

    return Array.from(timeMap.entries()).map(([timeOfDay, data]) => ({
      timeOfDay,
      totalCount: data.total,
      regretCount: data.regrets,
      regretRate: data.total > 0 ? (data.regrets / data.total) * 100 : 0,
    }));
  },

  generatePatterns(
    categoryInsights: CategoryInsight[],
    moodInsights: MoodInsight[],
    timeOfDayInsights: TimeOfDayInsight[],
    totalExpenses: number,
    totalRegrets: number
  ): string[] {
    const patterns: string[] = [];

    if (totalExpenses === 0) {
      return ['아직 기록된 소비가 없습니다.'];
    }

    const regretRate = (totalRegrets / totalExpenses) * 100;

    // 전체 후회율 패턴 (중립 톤)
    if (regretRate > 50) {
      patterns.push(
        `현재 데이터 기준, 전체 소비의 ${regretRate.toFixed(1)}%가 후회로 기록되어 있어요.`
      );
    } else if (regretRate > 30) {
      patterns.push(
        `현재 데이터 기준, 전체 소비의 ${regretRate.toFixed(1)}%가 후회로 기록되어 있어요.`
      );
    } else {
      patterns.push(
        `현재 데이터 기준, 후회율은 ${regretRate.toFixed(1)}%입니다.`
      );
    }

    // 카테고리별 패턴
    const topRegretCategory = categoryInsights
      .filter((c) => c.totalCount >= 3)
      .sort((a, b) => b.regretRate - a.regretRate)[0];

    if (topRegretCategory && topRegretCategory.regretRate > 40) {
      const catKo: Record<string, string> = {
        takeout: '외식(포장)',
        delivery: '배달',
        cafe: '카페',
      };
      const label = catKo[topRegretCategory.category] ?? topRegretCategory.category;
      patterns.push(
        `현재 데이터 기준, "${label}" 카테고리의 후회율이 ${topRegretCategory.regretRate.toFixed(1)}%로 높게 나타나요.`
      );
    }

    // 시간대별 패턴
    const topRegretTime = timeOfDayInsights
      .filter((t) => t.totalCount >= 3)
      .sort((a, b) => b.regretRate - a.regretRate)[0];

    if (topRegretTime && topRegretTime.regretRate > 40) {
      const timeLabel = {
        morning: '아침',
        afternoon: '점심',
        evening: '저녁',
        night: '밤',
      }[topRegretTime.timeOfDay];

      patterns.push(
        `현재 데이터 기준, "${timeLabel}" 시간대의 후회율이 ${topRegretTime.regretRate.toFixed(1)}%로 나타나요.`
      );
    }

    return patterns.length > 0 ? patterns : ['패턴을 분석하기에는 데이터가 부족합니다.'];
  },
};
