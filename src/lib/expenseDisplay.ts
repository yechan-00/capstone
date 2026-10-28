import { expenseCategoryLabel } from '@/lib/expenseCategoryLabel';
import type { ExpenseCategory } from '@/lib/types';

const EMPTY_TITLE_MARKERS = new Set(['기록 없음', '메모 없음', '소비 평가']);

function usableText(value: string | null | undefined): string {
  const trimmed = typeof value === 'string' ? value.trim() : '';
  if (!trimmed || EMPTY_TITLE_MARKERS.has(trimmed)) return '';
  return trimmed;
}

/** 카드·리스트에서 굵은 제목(메뉴명) / 보조 텍스트(이유) 분리 */
export function expenseCardTitle(expense: {
  item?: string | null;
  content?: string | null;
  summaryLine?: string | null;
  reason?: string | null;
  category?: ExpenseCategory | null;
} | null | undefined): string {
  const itemName = [expense?.item, expense?.content]
    .map((s) => usableText(s))
    .find((s) => s.length > 0) ?? '';
  if (itemName) return itemName;

  const summary = usableText(expense?.summaryLine);
  if (summary) return summary;

  if (expense?.category) return `${expenseCategoryLabel(expense.category)} 소비`;
  return '소비 기록';
}

export function expenseCardSubtitle(expense: {
  item?: string | null;
  content?: string | null;
  summaryLine?: string | null;
  reason?: string | null;
} | null | undefined): string {
  const title = expenseCardTitle(expense);
  const reason = usableText(expense?.reason);
  if (reason && reason !== title) return reason;
  return '';
}
