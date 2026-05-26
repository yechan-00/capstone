import { EXPENSE_MOOD_OPTIONS } from './expenseMood';

export type CategoryKey = 'takeout' | 'cafe' | 'delivery';

export const CATEGORIES: { key: CategoryKey; label: string; emoji: string }[] = [
  { key: 'takeout', label: '외식(포장)', emoji: '🥡' },
  { key: 'cafe', label: '카페', emoji: '☕️' },
  { key: 'delivery', label: '배달', emoji: '🛵' },
];

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
