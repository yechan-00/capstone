import { isRegretReview } from '@/lib/moodInsightDetail';
import type { Expense, InsightsWindow, RegretPeriodSnapshot, Review } from '@/lib/types';

export type { RegretPeriodSnapshot };

export function previousInsightsWindow(window: InsightsWindow): InsightsWindow {
  if (window.mode === 'year') {
    return { mode: 'year', year: window.year - 1 };
  }
  if (window.monthIndex === 0) {
    return { mode: 'month', year: window.year - 1, monthIndex: 11 };
  }
  return { mode: 'month', year: window.year, monthIndex: window.monthIndex - 1 };
}

export function filterRegretReviews(reviews: Review[]): Review[] {
  return reviews.filter(isRegretReview);
}

/** 소비당 최신 리뷰 1건만 남긴다. */
export function uniqueLatestReviews(reviews: Review[]): Review[] {
  const latest = new Map<string, Review>();
  for (const review of reviews) {
    const previous = latest.get(review.expenseId);
    if (!previous) {
      latest.set(review.expenseId, review);
      continue;
    }
    const reviewedDiff = review.reviewedAt.getTime() - previous.reviewedAt.getTime();
    if (reviewedDiff > 0) {
      latest.set(review.expenseId, review);
      continue;
    }
    if (reviewedDiff === 0 && review.createdAt.getTime() > previous.createdAt.getTime()) {
      latest.set(review.expenseId, review);
    }
  }
  return [...latest.values()];
}

/**
 * 주어진 소비에 연결된 최신 리뷰만 반환한다.
 * 리뷰 작성일과 무관하게 소비일 기준 집계에 사용한다.
 */
export function reviewsForExpenses(
  expenses: Expense[],
  reviews: Review[] | Map<string, Review>,
): Review[] {
  const source = reviews instanceof Map ? [...reviews.values()] : reviews;
  const byExpenseId = new Map(
    uniqueLatestReviews(source).map((review) => [review.expenseId, review] as const),
  );
  const attached: Review[] = [];
  for (const expense of expenses) {
    const review = byExpenseId.get(expense.id);
    if (review) attached.push(review);
  }
  return attached;
}

/** 후회율 = 후회 리뷰 수 / 리뷰 완료 건수. 리뷰 0건이면 ratePercent는 null. */
export function computeRegretRateFromReviews(reviews: Review[]): {
  reviewCount: number;
  regretCount: number;
  ratePercent: number | null;
} {
  const unique = uniqueLatestReviews(reviews);
  const reviewCount = unique.length;
  const regretCount = unique.filter(isRegretReview).length;
  return {
    reviewCount,
    regretCount,
    ratePercent: reviewCount > 0 ? (regretCount / reviewCount) * 100 : null,
  };
}

/** 리뷰 시각 순 누적 후회율. 리뷰가 없으면 null. */
export function buildCumulativeRegretRates(reviews: Review[]): number[] | null {
  const unique = uniqueLatestReviews(reviews);
  if (unique.length === 0) return null;
  const sorted = [...unique].sort((a, b) => {
    const byReviewed = a.reviewedAt.getTime() - b.reviewedAt.getTime();
    if (byReviewed !== 0) return byReviewed;
    return a.createdAt.getTime() - b.createdAt.getTime();
  });
  let regrets = 0;
  return sorted.map((review, index) => {
    if (isRegretReview(review)) regrets += 1;
    return (regrets / (index + 1)) * 100;
  });
}

export function computeRegretAmountKrw(
  regretReviews: Review[],
  expenseMap: Map<string, Expense>,
): number {
  const ids = new Set<string>();
  for (const review of regretReviews) {
    ids.add(review.expenseId);
  }
  let sum = 0;
  for (const id of ids) {
    const expense = expenseMap.get(id);
    if (expense) sum += expense.amount || 0;
  }
  return sum;
}

export function buildRegretPeriodSnapshot(
  expenses: Expense[],
  reviews: Review[] | Map<string, Review>,
): RegretPeriodSnapshot {
  const attached = reviewsForExpenses(expenses, reviews);
  const { reviewCount: totalReviews, regretCount: totalRegrets, ratePercent } =
    computeRegretRateFromReviews(attached);
  return {
    overallRegretRate: ratePercent ?? 0,
    totalExpenses: expenses.length,
    totalRegrets,
    totalReviews,
  };
}

function bucketIndex(date: Date, start: Date, end: Date, bucketCount: number): number {
  const startMs = start.getTime();
  const endMs = end.getTime();
  const t = date.getTime();
  if (t < startMs || t > endMs) return -1;
  if (endMs <= startMs) return 0;
  const ratio = (t - startMs) / (endMs - startMs);
  return Math.min(bucketCount - 1, Math.floor(ratio * bucketCount));
}

/**
 * 기간 내 후회율 추이 (%). 버킷별 리뷰가 있는 구간이 2개 미만이면 null.
 * 소비일(spentAt) 기준으로 버킷에 넣고, 해당 소비의 최신 리뷰로 후회율을 계산한다.
 */
export function buildRegretTrendRates(
  window: InsightsWindow,
  periodStart: Date,
  periodEnd: Date,
  expenses: Expense[],
  reviews: Review[] | Map<string, Review>,
): Array<number | null> | null {
  const bucketCount = window.mode === 'year' ? 12 : 4;
  const buckets = Array.from({ length: bucketCount }, () => ({ reviews: 0, regrets: 0 }));
  const expenseById = new Map(expenses.map((expense) => [expense.id, expense] as const));

  for (const review of reviewsForExpenses(expenses, reviews)) {
    const expense = expenseById.get(review.expenseId);
    if (!expense) continue;
    const idx =
      window.mode === 'year'
        ? expense.spentAt.getFullYear() === window.year
          ? expense.spentAt.getMonth()
          : -1
        : bucketIndex(expense.spentAt, periodStart, periodEnd, bucketCount);
    if (idx < 0 || idx >= bucketCount) continue;
    buckets[idx]!.reviews += 1;
    if (isRegretReview(review)) buckets[idx]!.regrets += 1;
  }

  const activeBuckets = buckets.filter((b) => b.reviews > 0);
  if (activeBuckets.length < 2) return null;

  return buckets.map((b) => (b.reviews > 0 ? (b.regrets / b.reviews) * 100 : null));
}

export function regretCardTitle(
  window: InsightsWindow,
  isCurrent: boolean,
): string {
  if (window.mode === 'year') {
    return isCurrent ? '올해 후회' : `${window.year}년 후회`;
  }
  if (isCurrent) return '이번 달 후회';
  return `${window.monthIndex + 1}월 후회`;
}

export function regretComparisonLabel(window: InsightsWindow): string {
  return window.mode === 'year' ? '지난해보다' : '지난달보다';
}

export function formatRegretDeltaPp(deltaPp: number): string {
  const abs = Math.abs(deltaPp);
  const formatted = abs % 1 === 0 ? abs.toFixed(0) : abs.toFixed(1);
  if (deltaPp < 0) return `↓ ${formatted}%p`;
  if (deltaPp > 0) return `↑ ${formatted}%p`;
  return '변화 없음';
}

export function regretComparisonSentence(
  window: InsightsWindow,
  deltaPp: number,
): string {
  const abs = Math.abs(deltaPp);
  const formatted = abs % 1 === 0 ? abs.toFixed(0) : abs.toFixed(1);
  const prefix = regretComparisonLabel(window);
  if (deltaPp < 0) return `${prefix} ${formatted}%p 낮아요`;
  if (deltaPp > 0) return `${prefix} ${formatted}%p 높아요`;
  return `${prefix} 변화 없어요`;
}
