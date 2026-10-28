import {
  canonicalFoodCategory,
  INSIGHTS_CATEGORY_COLORS,
  INSIGHTS_CATEGORY_LABELS,
  INSIGHTS_CATEGORY_ORDER,
  type FoodCategoryKey,
} from '@/lib/categoryColors';
import type { CategoryInsight } from '@/lib/types';

export type CategorySpendRow = {
  key: FoodCategoryKey;
  label: string;
  color: string;
  amountKrw: number;
  count: number;
  regretRate: number;
  pct: number;
};

export type CategorySpendBreakdown = {
  rows: CategorySpendRow[];
  totalAmountKrw: number;
};

function mergeCategoryInsights(categoryInsights: CategoryInsight[]) {
  const acc = new Map<
    FoodCategoryKey,
    { count: number; amount: number; regretWeighted: number }
  >();

  for (const key of INSIGHTS_CATEGORY_ORDER) {
    acc.set(key, { count: 0, amount: 0, regretWeighted: 0 });
  }

  for (const c of categoryInsights) {
    const key = canonicalFoodCategory(c.category);
    const cur = acc.get(key)!;
    cur.count += c.totalCount;
    cur.amount += c.totalAmountKrw;
    cur.regretWeighted += c.regretRate * c.totalCount;
  }

  return acc;
}

export function buildCategorySpendBreakdown(
  categoryInsights: CategoryInsight[],
  totalSpendKrw: number,
): CategorySpendBreakdown {
  const merged = mergeCategoryInsights(categoryInsights);
  const totalAmountKrw = totalSpendKrw;

  const rows: CategorySpendRow[] = INSIGHTS_CATEGORY_ORDER.map((key) => {
    const data = merged.get(key)!;
    const pct = totalAmountKrw > 0 ? (data.amount / totalAmountKrw) * 100 : 0;
    return {
      key,
      label: INSIGHTS_CATEGORY_LABELS[key],
      color: INSIGHTS_CATEGORY_COLORS[key],
      amountKrw: data.amount,
      count: data.count,
      regretRate: data.count > 0 ? data.regretWeighted / data.count : 0,
      pct,
    };
  });

  return { rows, totalAmountKrw };
}

export function buildCategorySpendComparison(
  rows: CategorySpendRow[],
  previousCategoryAmounts: Record<FoodCategoryKey, number> | null,
): string | null {
  if (!previousCategoryAmounts) return null;

  let best: { label: string; delta: number } | null = null;

  for (const row of rows) {
    const prev = previousCategoryAmounts[row.key] ?? 0;
    if (prev <= 0 || row.amountKrw <= 0) continue;
    const delta = ((row.amountKrw - prev) / prev) * 100;
    if (!best || Math.abs(delta) > Math.abs(best.delta)) {
      best = { label: row.label, delta };
    }
  }

  if (!best || Math.abs(best.delta) < 8) return null;

  const pct = Math.abs(best.delta).toFixed(0);
  if (best.delta < 0) {
    return `지난 기간보다 ${best.label} 소비가 ${pct}% 줄었어요.`;
  }
  return `지난 기간보다 ${best.label} 소비가 ${pct}% 늘었어요.`;
}
