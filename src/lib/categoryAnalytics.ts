import type { ExpenseCategory } from '@/lib/types';

/** 배달·외식(포장)을 묶어 분석할 때 사용하는 채널 키 */
export type FoodSpendChannel = 'delivery_takeout' | 'cafe' | 'other';

const DELIVERY_TAKEOUT_KEYS = new Set<ExpenseCategory>(['delivery', 'takeout']);

/** 레거시 DB의 `food`(구 식자재)는 외식(포장) 의미로 이관됨 */
export function normalizeExpenseCategory(raw: string | undefined | null): ExpenseCategory {
  if (raw === 'food') return 'takeout';
  if (raw === 'delivery' || raw === 'cafe' || raw === 'takeout') return raw;
  return 'takeout';
}

export function getFoodSpendChannel(category: ExpenseCategory): FoodSpendChannel {
  if (DELIVERY_TAKEOUT_KEYS.has(category)) return 'delivery_takeout';
  if (category === 'cafe') return 'cafe';
  return 'other';
}

export function isDeliveryOrTakeout(category: ExpenseCategory): boolean {
  return DELIVERY_TAKEOUT_KEYS.has(category);
}
