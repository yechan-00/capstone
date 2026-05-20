import { ExpenseCategory } from './types';

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: 'takeout', label: '외식(포장)' },
  { value: 'cafe', label: '카페' },
  { value: 'delivery', label: '배달' },
];

export const EXPENSE_MOODS: { value: string; label: string }[] = [
  { value: 'good', label: '😊 좋음' },
  { value: 'normal', label: '🙂 보통' },
  { value: 'bad', label: '😕 안좋음' },
  { value: 'happy', label: '😊 기쁨' },
  { value: 'neutral', label: '😐 보통' },
  { value: 'stressed', label: '😰 스트레스' },
  { value: 'excited', label: '🤩 신남' },
  { value: 'tired', label: '😴 피곤' },
];

export { REGRET_REASONS } from './regretReasons';

/** 신규 스케줄 기준(D+3). 레거시 문서는 다른 delayDays 유지 */
export const REVIEW_DELAY_DAYS = [3] as const;

export const TIME_OF_DAY_RANGES = {
  morning: { start: 6, end: 12 },
  afternoon: { start: 12, end: 18 },
  evening: { start: 18, end: 22 },
  night: { start: 22, end: 6 },
} as const;
