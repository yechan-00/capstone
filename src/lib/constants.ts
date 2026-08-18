import { ExpenseCategory } from './types';
import { EXPENSE_MOOD_OPTIONS } from './expenseMood';

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'takeout', label: '외식(포장)' },
  { value: 'cafe', label: '카페' },
  { value: 'delivery', label: '배달' },
];

export const EXPENSE_MOODS = EXPENSE_MOOD_OPTIONS.map((m) => ({
  value: m.key,
  label: `${m.emoji} ${m.label}`,
}));

export { REGRET_REASONS } from './regretReasons';

/** @deprecated 신규 스케줄은 D+1(다음날 0시). 레거시 문서 호환용 */
export const REVIEW_DELAY_DAYS = [1] as const;

export const TIME_OF_DAY_RANGES = {
  morning: { start: 6, end: 12 },
  afternoon: { start: 12, end: 18 },
  evening: { start: 18, end: 22 },
  night: { start: 22, end: 6 },
} as const;
