import type { Expense } from '@/lib/types';
import { expenseCategoryLabel } from '@/lib/expenseCategoryLabel';
import { parseExpenseReason } from '@/lib/expenseReasonParse';

export type SimilarExpensePattern = {
  label: string;
  count: number;
  averageAmount: number;
  currentAmount: number;
  /** 평균·건수와 동일한 집합. 최신 spentAt 순 */
  items: Expense[];
};

const MIN_MATCH_COUNT = 3;

function reasonOverlap(a: Expense, b: Expense): boolean {
  const chipsA = new Set(parseExpenseReason(a.reason).chips);
  const chipsB = parseExpenseReason(b.reason).chips;
  return chipsB.some((c) => chipsA.has(c));
}

function tagOverlap(a: Expense, b: Expense): boolean {
  const tagsA = new Set(a.tags.map((t) => t.trim()).filter(Boolean));
  return b.tags.some((t) => tagsA.has(t.trim()));
}

function isSimilarExpense(base: Expense, candidate: Expense): boolean {
  if (candidate.id === base.id) return false;
  if (candidate.category !== base.category) return false;
  return tagOverlap(base, candidate) || reasonOverlap(base, candidate);
}

function buildPatternLabel(base: Expense, matches: Expense[]): string {
  const sharedTag = base.tags.find((tag) =>
    matches.some((m) => m.tags.includes(tag)),
  );
  if (sharedTag) {
    const categoryName = expenseCategoryLabel(base.category);
    return `${sharedTag} 상황에서 ${categoryName} 소비`;
  }

  const baseChips = parseExpenseReason(base.reason).chips;
  const sharedChip = baseChips.find((chip) =>
    matches.some((m) => parseExpenseReason(m.reason).chips.includes(chip)),
  );
  if (sharedChip) return `${sharedChip} 상황에서의 소비`;

  return '비슷한 조건의 소비';
}

export function computeSimilarExpensePattern(
  expense: Expense,
  recentExpenses: Expense[],
): SimilarExpensePattern | null {
  const matches = recentExpenses.filter((e) => isSimilarExpense(expense, e));
  const all = [expense, ...matches];
  if (all.length < MIN_MATCH_COUNT) return null;

  const amounts = all.map((e) => e.amount);
  const averageAmount = Math.round(amounts.reduce((s, v) => s + v, 0) / amounts.length);
  const items = [...all].sort((a, b) => {
    const timeDiff = b.spentAt.getTime() - a.spentAt.getTime();
    if (timeDiff !== 0) return timeDiff;
    return a.id.localeCompare(b.id);
  });

  return {
    label: buildPatternLabel(expense, matches),
    count: all.length,
    averageAmount,
    currentAmount: expense.amount,
    items,
  };
}
