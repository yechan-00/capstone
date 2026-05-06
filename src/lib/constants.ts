import { ExpenseCategory, RegretReason } from './types';

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

export const REGRET_REASONS: { value: RegretReason; label: string }[] = [
  { value: 'taste',              label: '맛' },
  { value: 'price',              label: '가격' },
  { value: 'portion',            label: '양' },
  { value: 'delivery_condition', label: '배달상태' },
  { value: 'delivery_speed',     label: '배달속도' },
  { value: 'my_condition',       label: '컨디션' },
  { value: 'impulse',            label: '충동구매' },
  { value: 'health',             label: '건강' },
  { value: 'value_for_money',    label: '가성비' },
  { value: 'reorder_intent',     label: '재주문 의사' },
  { value: 'vs_expectation',     label: '기대 대비' },
  { value: 'replaceable',        label: '대체 가능' },
  { value: 'other',              label: '기타' },
];

export const DECISION_AGAIN_OPTIONS: { value: string; label: string }[] = [
  { value: 'yes',   label: '만족' },
  { value: 'maybe', label: '보통' },
  { value: 'no',    label: '후회' },
];

/** 신규 스케줄 기준(D+3). 레거시 문서는 다른 delayDays 유지 */
export const REVIEW_DELAY_DAYS = [3] as const;

export const SATISFACTION_SCALE = [1, 2, 3, 4, 5] as const;

export const TIME_OF_DAY_RANGES = {
  morning: { start: 6, end: 12 },
  afternoon: { start: 12, end: 18 },
  evening: { start: 18, end: 22 },
  night: { start: 22, end: 6 },
} as const;
