import type { ExpenseCategory } from '@/lib/types';
import { categoryEmoji, categoryLabel } from '@/lib/expenseOptions';

/** 소비 카테고리 표시명. 저장값(takeout/cafe/delivery/food)은 변경하지 않는다. */
export function expenseCategoryLabel(category: ExpenseCategory | string): string {
  return categoryLabel(category);
}

export function expenseCategoryEmoji(category: ExpenseCategory | string): string {
  return categoryEmoji(category);
}
