import type { RegretReason } from '@/lib/types';

/** 리뷰 후회 이유 칩·상세 표시 공통 목록 */
export const REGRET_REASONS: { key: RegretReason; label: string }[] = [
  { key: 'taste', label: '맛' },
  { key: 'price', label: '가격' },
  { key: 'portion', label: '양' },
  { key: 'delivery_condition', label: '배달상태' },
  { key: 'delivery_speed', label: '배달속도' },
  { key: 'my_condition', label: '컨디션' },
  { key: 'impulse', label: '충동구매' },
  { key: 'health', label: '건강' },
  { key: 'value_for_money', label: '가성비' },
  { key: 'reorder_intent', label: '재주문 의사' },
  { key: 'vs_expectation', label: '기대 대비' },
  { key: 'replaceable', label: '대체 가능' },
  { key: 'other', label: '기타' },
];

const labelByKey = new Map(REGRET_REASONS.map((r) => [r.key, r.label]));

export function regretReasonLabel(key: RegretReason): string | undefined {
  return labelByKey.get(key);
}

/** 리뷰 화면: 먼저 보여 줄 이유 (나머지는 '더 보기') */
export const REGRET_REASONS_REVIEW_PRIMARY: readonly RegretReason[] = [
  'taste',
  'price',
  'portion',
  'impulse',
  'vs_expectation',
  'other',
] as const;

export function regretReasonsForReviewUi(): {
  primary: { key: RegretReason; label: string }[];
  rest: { key: RegretReason; label: string }[];
} {
  const primarySet = new Set<RegretReason>(REGRET_REASONS_REVIEW_PRIMARY);
  const primary = REGRET_REASONS_REVIEW_PRIMARY.map((k) => REGRET_REASONS.find((r) => r.key === k)).filter(
    (r): r is { key: RegretReason; label: string } => r != null,
  );
  const rest = REGRET_REASONS.filter((r) => !primarySet.has(r.key));
  return { primary, rest };
}
