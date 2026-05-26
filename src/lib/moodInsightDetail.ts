import type { Expense, Review } from '@/lib/types';
import { expenseCategoryLabel } from '@/lib/expenseCategoryLabel';
import {
  expenseMoodInBucket,
  MOOD_INSIGHT_BUCKETS,
  moodInsightBucketIncludesLabel,
  moodInsightBucketLabel,
  normalizeExpenseMood,
  type MoodInsightBucketKey,
} from '@/lib/expenseMood';
import { getTimeOfDay } from '@/utils/time';

const WD_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
const TIME_LABELS: Record<'morning' | 'afternoon' | 'evening' | 'night', string> = {
  morning: '아침 (6~12시)',
  afternoon: '낮 (12~18시)',
  evening: '저녁 (18~22시)',
  night: '밤 (22~6시)',
};

export type MoodInsightExpenseRow = {
  expense: Expense;
  isRegret: boolean;
};

export type MoodInsightDetail = {
  mood: string;
  moodLabel: string;
  moodIncludesLabel: string;
  totalCount: number;
  regretCount: number;
  regretRate: number;
  headline: string;
  expenses: MoodInsightExpenseRow[];
  regretExpenses: MoodInsightExpenseRow[];
  weekdayTop: { label: string; count: number } | null;
  timeOfDayTop: { label: string; count: number } | null;
  categoryTop: { label: string; count: number } | null;
  menuTop: { label: string; count: number } | null;
  weekdayCounts: { label: string; count: number }[];
  timeOfDayCounts: { label: string; count: number }[];
  categoryCounts: { label: string; count: number }[];
  menuCounts: { label: string; count: number }[];
};

export type MoodInsightBucketRow = {
  bucket: MoodInsightBucketKey;
  label: string;
  totalCount: number;
  regretCount: number;
  regretRate: number;
};

export function aggregateMoodInsightsByBucket(
  moodInsights: Array<{ mood: string; totalCount: number; regretCount: number; regretRate: number }>,
): MoodInsightBucketRow[] {
  const byMood = new Map(moodInsights.map((m) => [normalizeExpenseMood(m.mood), m] as const));

  return MOOD_INSIGHT_BUCKETS.map((bucket) => {
    let totalCount = 0;
    let regretCount = 0;
    for (const moodKey of bucket.moods) {
      const row = byMood.get(moodKey);
      if (!row) continue;
      totalCount += row.totalCount;
      regretCount += row.regretCount;
    }
    const regretRate = totalCount > 0 ? (regretCount / totalCount) * 100 : 0;
    return {
      bucket: bucket.key,
      label: bucket.label,
      totalCount,
      regretCount,
      regretRate,
    };
  });
}

export function isRegretReview(review: Review): boolean {
  return review.decisionAgain === 'no' || review.satisfaction <= 2;
}

function topEntry(counts: Map<string, number>): { label: string; count: number } | null {
  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  if (!sorted.length || sorted[0][1] <= 0) return null;
  return { label: sorted[0][0], count: sorted[0][1] };
}

function sortedCounts(counts: Map<string, number>, limit = 4): { label: string; count: number }[] {
  return [...counts.entries()]
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([label, count]) => ({ label, count }));
}

export function buildMoodInsightDetail(
  bucketKey: MoodInsightBucketKey,
  expenses: Expense[],
  reviews: Review[],
): MoodInsightDetail {
  const moodLabel = moodInsightBucketLabel(bucketKey);
  const moodIncludesLabel = moodInsightBucketIncludesLabel(bucketKey);
  const moodExpenses = expenses.filter((e) => expenseMoodInBucket(e.mood, bucketKey));

  const regretByExpenseId = new Set<string>();
  for (const review of reviews) {
    if (isRegretReview(review)) regretByExpenseId.add(review.expenseId);
  }

  const rows: MoodInsightExpenseRow[] = moodExpenses
    .map((expense) => ({
      expense,
      isRegret: regretByExpenseId.has(expense.id),
    }))
    .sort((a, b) => b.expense.spentAt.getTime() - a.expense.spentAt.getTime());

  const regretExpenses = rows.filter((r) => r.isRegret);
  const regretCount = regretExpenses.length;
  const totalCount = rows.length;
  const regretRate = totalCount > 0 ? (regretCount / totalCount) * 100 : 0;

  if (totalCount === 0) {
    return {
      mood: bucketKey,
      moodLabel,
      moodIncludesLabel,
      totalCount: 0,
      regretCount: 0,
      regretRate: 0,
      headline: `${moodLabel} 기분 기록이 아직 없어요.`,
      expenses: [],
      regretExpenses: [],
      weekdayTop: null,
      timeOfDayTop: null,
      categoryTop: null,
      menuTop: null,
      weekdayCounts: [],
      timeOfDayCounts: [],
      categoryCounts: [],
      menuCounts: [],
    };
  }

  const weekdayMap = new Map<string, number>();
  const timeMap = new Map<string, number>();
  const categoryMap = new Map<string, number>();
  const menuMap = new Map<string, number>();

  for (const { expense } of rows) {
    const wd = WD_LABELS[expense.spentAt.getDay()];
    weekdayMap.set(wd, (weekdayMap.get(wd) ?? 0) + 1);

    const tod = TIME_LABELS[getTimeOfDay(expense.spentAt)];
    timeMap.set(tod, (timeMap.get(tod) ?? 0) + 1);

    const cat = expenseCategoryLabel(expense.category);
    categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + 1);

    const menu = (expense.item ?? expense.content ?? expense.reason ?? '메뉴 미입력').trim();
    menuMap.set(menu, (menuMap.get(menu) ?? 0) + 1);
  }

  const weekdayTop = topEntry(weekdayMap);
  const timeOfDayTop = topEntry(timeMap);
  const categoryTop = topEntry(categoryMap);
  const menuTop = topEntry(menuMap);

  let headline = `${moodLabel} 기분 기록 ${totalCount}건`;
  if (regretCount > 0) {
    headline += ` · 후회 ${regretCount}건(${regretRate.toFixed(0)}%)`;
    const parts: string[] = [];
    if (weekdayTop) parts.push(`${weekdayTop.label}요일`);
    if (timeOfDayTop) parts.push(timeOfDayTop.label.split(' ')[0] ?? timeOfDayTop.label);
    if (categoryTop) parts.push(categoryTop.label);
    if (parts.length > 0) headline += ` — ${parts.join(' · ')}에 많았어요`;
  } else {
    headline += ' · 후회 없음';
  }

  return {
    mood: bucketKey,
    moodLabel,
    moodIncludesLabel,
    totalCount,
    regretCount,
    regretRate,
    headline,
    expenses: rows,
    regretExpenses,
    weekdayTop,
    timeOfDayTop,
    categoryTop,
    menuTop,
    weekdayCounts: sortedCounts(weekdayMap),
    timeOfDayCounts: sortedCounts(timeMap),
    categoryCounts: sortedCounts(categoryMap),
    menuCounts: sortedCounts(menuMap, 5),
  };
}

export function buildMoodInsightHeadline(
  moodInsights: Array<{ mood: string; totalCount: number; regretCount: number; regretRate: number }>,
): string | null {
  const withData = aggregateMoodInsightsByBucket(moodInsights).filter((m) => m.totalCount > 0);
  if (withData.length === 0) return null;

  const topRegret = [...withData]
    .filter((m) => m.regretCount > 0)
    .sort((a, b) => b.regretRate - a.regretRate || b.regretCount - a.regretCount)[0];

  if (topRegret) {
    return `${topRegret.label} 기분일 때 후회율이 ${topRegret.regretRate.toFixed(0)}%로 가장 높아요 (${topRegret.regretCount}/${topRegret.totalCount}건).`;
  }

  const topCount = [...withData].sort((a, b) => b.totalCount - a.totalCount)[0];
  if (!topCount) return null;
  return `${topCount.label} 기분 기록이 ${topCount.totalCount}건으로 가장 많아요. 아직 후회 리뷰는 없어요.`;
}
