import type { ExpenseCategory } from '@/lib/types';
import { categoryLabel } from '@/lib/expenseOptions';

/** 만족도(초록·노랑·빨강)와 구분되는 카테고리 심볼 색 */
export const CATEGORY_DOT_COLORS = {
  delivery: '#6366F1',
  cafe: '#A855F7',
  takeout: '#0891B2',
} as const;

export type FoodCategoryKey = keyof typeof CATEGORY_DOT_COLORS;

/** 인사이트 소비 분석 — muted tone */
export const INSIGHTS_CATEGORY_COLORS = {
  takeout: '#58A98A',
  delivery: '#728FAE',
  cafe: '#9A82B7',
} as const;

export const INSIGHTS_CATEGORY_LABELS = {
  takeout: categoryLabel('takeout'),
  delivery: categoryLabel('delivery'),
  cafe: categoryLabel('cafe'),
} as const;

export const INSIGHTS_CATEGORY_ORDER: FoodCategoryKey[] = ['takeout', 'cafe', 'delivery'];

export function categoryDotColor(category: ExpenseCategory): string {
  switch (category) {
    case 'delivery':
      return CATEGORY_DOT_COLORS.delivery;
    case 'cafe':
      return CATEGORY_DOT_COLORS.cafe;
    case 'takeout':
    case 'food':
    default:
      return CATEGORY_DOT_COLORS.takeout;
  }
}

export function canonicalFoodCategory(category: ExpenseCategory): FoodCategoryKey {
  if (category === 'delivery' || category === 'cafe' || category === 'takeout') return category;
  return 'takeout';
}
