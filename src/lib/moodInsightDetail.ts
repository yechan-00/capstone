import type { Expense, Review } from '@/lib/types';
import { expenseCategoryLabel } from '@/lib/expenseCategoryLabel';
import {
  expenseMoodInBucket,
  EXPENSE_MOOD_OPTIONS,
  MOOD_INSIGHT_BUCKETS,
  moodInsightBucketIncludesLabel,
  moodInsightBucketLabel,
  normalizeExpenseMood,
  type ExpenseMoodKey,
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
  return buildMoodInsightDetailCore(bucketKey, moodLabel, moodIncludesLabel, moodExpenses, reviews);
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

export type MoodSummaryTint = {
  bg: string;
  badgeBg: string;
  badgeText: string;
  chipBg: string;
  chipText: string;
  iconBg: string;
};

export function moodSummaryTint(moodKey: ExpenseMoodKey, isDark: boolean): MoodSummaryTint {
  const palettes: Record<ExpenseMoodKey, MoodSummaryTint> = isDark
    ? {
        'very good': {
          bg: '#14291f',
          badgeBg: '#065f46',
          badgeText: '#a7f3d0',
          chipBg: '#1a3328',
          chipText: '#86efac',
          iconBg: '#065f46',
        },
        good: {
          bg: '#152919',
          badgeBg: '#166534',
          badgeText: '#bbf7d0',
          chipBg: '#1a3320',
          chipText: '#86efac',
          iconBg: '#166534',
        },
        normal: {
          bg: '#1a2332',
          badgeBg: '#334155',
          badgeText: '#cbd5e1',
          chipBg: '#232f42',
          chipText: '#94a3b8',
          iconBg: '#334155',
        },
        bad: {
          bg: '#2a1f14',
          badgeBg: '#9a3412',
          badgeText: '#fed7aa',
          chipBg: '#332618',
          chipText: '#fdba74',
          iconBg: '#9a3412',
        },
        'too bad': {
          bg: '#2a1418',
          badgeBg: '#9f1239',
          badgeText: '#fecdd3',
          chipBg: '#331820',
          chipText: '#fda4af',
          iconBg: '#9f1239',
        },
      }
    : {
        'very good': {
          bg: '#ecfdf5',
          badgeBg: '#059669',
          badgeText: '#ffffff',
          chipBg: '#d1fae5',
          chipText: '#047857',
          iconBg: '#059669',
        },
        good: {
          bg: '#f0fdf4',
          badgeBg: '#16a34a',
          badgeText: '#ffffff',
          chipBg: '#dcfce7',
          chipText: '#15803d',
          iconBg: '#16a34a',
        },
        normal: {
          bg: '#f8fafc',
          badgeBg: '#64748b',
          badgeText: '#ffffff',
          chipBg: '#e2e8f0',
          chipText: '#475569',
          iconBg: '#64748b',
        },
        bad: {
          bg: '#fff7ed',
          badgeBg: '#ea580c',
          badgeText: '#ffffff',
          chipBg: '#ffedd5',
          chipText: '#c2410c',
          iconBg: '#ea580c',
        },
        'too bad': {
          bg: '#fff1f2',
          badgeBg: '#e11d48',
          badgeText: '#ffffff',
          chipBg: '#ffe4e6',
          chipText: '#be123c',
          iconBg: '#e11d48',
        },
      };
  return palettes[moodKey];
}

export type MoodInsightSummaryRow = {
  moodKey: ExpenseMoodKey;
  label: string;
  emoji: string;
  totalCount: number;
  regretCount: number;
  regretRate: number;
  totalSpendKrw: number;
  subChips: { label: string; count: number }[];
};

function expenseTags(expense: Expense): string[] {
  if (!Array.isArray(expense.tags)) return [];
  return expense.tags.map((t) => t.trim()).filter(Boolean);
}

function buildSubChipsForExpenses(expenses: Expense[], limit = 3): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const expense of expenses) {
    const cat = expenseCategoryLabel(expense.category);
    counts.set(cat, (counts.get(cat) ?? 0) + 1);
    for (const tag of expenseTags(expense)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return sortedCounts(counts, limit);
}

function buildMoodInsightDetailCore(
  moodKey: string,
  moodLabel: string,
  moodIncludesLabel: string,
  moodExpenses: Expense[],
  reviews: Review[],
): MoodInsightDetail {
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
      mood: moodKey,
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
    mood: moodKey,
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

export function buildMoodInsightSummaries(expenses: Expense[], reviews: Review[]): MoodInsightSummaryRow[] {
  const regretByExpenseId = new Set<string>();
  for (const review of reviews) {
    if (isRegretReview(review)) regretByExpenseId.add(review.expenseId);
  }

  const rows = EXPENSE_MOOD_OPTIONS.map((option) => {
    const moodExpenses = expenses.filter((e) => normalizeExpenseMood(e.mood) === option.key);
    const totalCount = moodExpenses.length;
    const regretCount = moodExpenses.filter((e) => regretByExpenseId.has(e.id)).length;
    const regretRate = totalCount > 0 ? (regretCount / totalCount) * 100 : 0;
    const totalSpendKrw = moodExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    return {
      moodKey: option.key,
      label: option.label,
      emoji: option.emoji,
      totalCount,
      regretCount,
      regretRate,
      totalSpendKrw,
      subChips: buildSubChipsForExpenses(moodExpenses),
    };
  });

  return rows;
}

export function buildMoodInsightDetailForMood(
  moodKey: ExpenseMoodKey,
  expenses: Expense[],
  reviews: Review[],
): MoodInsightDetail {
  const option = EXPENSE_MOOD_OPTIONS.find((m) => m.key === moodKey);
  const moodExpenses = expenses.filter((e) => normalizeExpenseMood(e.mood) === moodKey);
  return buildMoodInsightDetailCore(
    moodKey,
    option?.label ?? moodKey,
    option?.label ?? '',
    moodExpenses,
    reviews,
  );
}

export function regretBarColor(pct: number, colors: { success: string; logoutText: string }) {
  if (pct >= 50) return colors.logoutText;
  if (pct >= 25) return '#CA8A04';
  return colors.success;
}

export function moodRegretSummary(rate: number, totalCount: number, regretCount: number): string {
  if (totalCount === 0) return '기분과 함께 기록된 소비가 없어요.';
  if (regretCount === 0) return '기분 기록 중 아직 후회 리뷰는 없어요.';
  if (rate >= 50) return '후회 비율이 높은 편이에요. 아래 패턴을 살펴보세요.';
  if (rate >= 25) return '일부 후회가 있어요. 자주 나오는 패턴을 확인해 보세요.';
  return '후회 비율이 낮아요. 잘 관리하고 있어요.';
}

export type RegretKeywordChip = { label: string };

export function buildRegretKeywordChips(expenses: Expense[], reviews: Review[], limit = 5): RegretKeywordChip[] {
  const regretIds = new Set<string>();
  for (const review of reviews) {
    if (isRegretReview(review)) regretIds.add(review.expenseId);
  }

  const counts = new Map<string, number>();
  for (const expense of expenses) {
    if (!regretIds.has(expense.id)) continue;

    const cat = expenseCategoryLabel(expense.category);
    counts.set(cat, (counts.get(cat) ?? 0) + 1);

    if (Array.isArray(expense.tags)) {
      for (const tag of expense.tags) {
        const t = tag.trim();
        if (t) counts.set(t, (counts.get(t) ?? 0) + 1);
      }
    }

    const wd = WD_LABELS[expense.spentAt.getDay()];
    const tod = (TIME_LABELS[getTimeOfDay(expense.spentAt)] ?? '').split(' ')[0] ?? '';
    if (wd && tod) {
      const key = `${wd}요일 ${tod}`;
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  return sortedCounts(counts, limit).map(({ label }) => ({ label }));
}
