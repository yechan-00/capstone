import { DecisionAgain, RegretReason } from '@/lib/types';

export const REVIEW_DECISIONS: { key: DecisionAgain; label: string; emoji: string }[] = [
  { key: 'yes',   label: '만족', emoji: '✅' },
  { key: 'maybe', label: '보통', emoji: '🤔' },
  { key: 'no',    label: '후회', emoji: '❌' },
];

export const REGRET_REASONS: { key: RegretReason; label: string }[] = [
  { key: 'taste',              label: '맛' },
  { key: 'price',              label: '가격' },
  { key: 'portion',            label: '양' },
  { key: 'delivery_condition', label: '배달상태' },
  { key: 'delivery_speed',     label: '배달속도' },
  { key: 'my_condition',       label: '컨디션' },
  { key: 'impulse',            label: '충동구매' },
  { key: 'health',             label: '건강' },
  { key: 'value_for_money',    label: '가성비' },
  { key: 'reorder_intent',     label: '재주문 의사' },
  { key: 'vs_expectation',     label: '기대 대비' },
  { key: 'replaceable',        label: '대체 가능' },
  { key: 'other',              label: '기타' },
];
