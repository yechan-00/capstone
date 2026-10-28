import { EXPENSE_MOOD_OPTIONS } from './expenseMood';

export type CategoryKey = 'takeout' | 'cafe' | 'delivery';

export type CategoryDisplay = { key: CategoryKey; label: string; emoji: string };

export const CATEGORIES: CategoryDisplay[] = [
  { key: 'takeout', label: '외식(포장)', emoji: '🥡' },
  { key: 'cafe', label: '카페', emoji: '☕️' },
  { key: 'delivery', label: '배달', emoji: '🛵' },
];

const CATEGORY_BY_KEY = new Map<string, CategoryDisplay>(
  CATEGORIES.map((category) => [category.key, category]),
);

/**
 * 화면 표시용. Firestore 값은 바꾸지 않는다.
 * food는 레거시 takeout. 알 수 없는 값은 takeout으로 바꾸지 않는다.
 */
export function categoryDisplay(category: string | null | undefined): CategoryDisplay | null {
  if (!category) return null;
  const key = category === 'food' ? 'takeout' : category;
  return CATEGORY_BY_KEY.get(key) ?? null;
}

export function categoryLabel(category: string | null | undefined): string {
  const display = categoryDisplay(category);
  if (display) return display.label;
  const raw = category?.trim();
  return raw || '기타';
}

export function categoryEmoji(category: string | null | undefined): string {
  return categoryDisplay(category)?.emoji ?? '';
}

/** 지출 추가 등 선택 UI에만 노출. 키만 추가하면 확장 가능. */
export const CATEGORY_KEYS_SHOWN_IN_PICKER: readonly CategoryKey[] = [
  'takeout',
  'cafe',
  'delivery',
] as const;

const pickerKeySet = new Set<CategoryKey>(CATEGORY_KEYS_SHOWN_IN_PICKER);

export const CATEGORIES_FOR_PICKER = CATEGORIES.filter((c) => pickerKeySet.has(c.key));

/** 소비 추가용: 빠른 선택만 (자세한 말은 아래 자유 입력). */
export const ADD_EXPENSE_QUICK_REASONS = [
  '배고파서',
  '스트레스·피로',
  '기분 전환·보상',
  '시간 없음·귀찮음',
  '사람들과',
  '충동·습관',
  '할인·혜택',
  '기타',
] as const;

export const REASON_GROUPS = [{ title: '빠른 선택', items: ADD_EXPENSE_QUICK_REASONS }] as const;

export type Reason = (typeof ADD_EXPENSE_QUICK_REASONS)[number];
export const REASONS: readonly Reason[] = ADD_EXPENSE_QUICK_REASONS;

export const MOODS = EXPENSE_MOOD_OPTIONS.map((m) => ({
  key: m.key,
  label: m.label,
  emoji: m.emoji,
}));

export const QUICK_AMOUNTS = [1000, 5000, 10000, 20000, 50000];
