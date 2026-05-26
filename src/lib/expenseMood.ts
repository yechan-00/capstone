/** 지출 기록·인사이트 공통 기분 옵션 (단일 소스) */
export const EXPENSE_MOOD_OPTIONS = [
  { key: 'very good', label: '아주 좋음', emoji: '😊' },
  { key: 'good', label: '좋음', emoji: '🙂' },
  { key: 'normal', label: '보통', emoji: '😑' },
  { key: 'bad', label: '안좋음', emoji: '😕' },
  { key: 'too bad', label: '매우 안좋음', emoji: '😠' },
] as const;

export type ExpenseMoodKey = (typeof EXPENSE_MOOD_OPTIONS)[number]['key'];

/** @deprecated Firestore 레거시 값 → 현재 키 */
const LEGACY_MOOD_MAP: Record<string, ExpenseMoodKey> = {
  happy: 'good',
  excited: 'very good',
  neutral: 'normal',
  stressed: 'bad',
  tired: 'bad',
  good: 'good',
  normal: 'normal',
  bad: 'bad',
};

export function isExpenseMoodKey(value: string): value is ExpenseMoodKey {
  return EXPENSE_MOOD_OPTIONS.some((m) => m.key === value);
}

export function normalizeExpenseMood(mood: string): ExpenseMoodKey | string {
  if (isExpenseMoodKey(mood)) return mood;
  return LEGACY_MOOD_MAP[mood] ?? mood;
}

export function expenseMoodLabel(mood: string, options?: { withEmoji?: boolean }): string {
  const key = normalizeExpenseMood(mood);
  const row = EXPENSE_MOOD_OPTIONS.find((m) => m.key === key);
  if (!row) return mood;
  return options?.withEmoji ? `${row.emoji} ${row.label}` : row.label;
}

export function expenseMoodOrder(mood: string): number {
  const key = normalizeExpenseMood(mood);
  const idx = EXPENSE_MOOD_OPTIONS.findIndex((m) => m.key === key);
  return idx >= 0 ? idx : 99;
}

/** 인사이트 카드·상세: 5단계 기분 → 좋음 / 보통 / 나쁨 */
export const MOOD_INSIGHT_BUCKETS = [
  {
    key: 'positive',
    label: '좋음',
    moods: ['very good', 'good'] as const satisfies readonly ExpenseMoodKey[],
    includesLabel: '아주 좋음 · 좋음',
  },
  {
    key: 'normal',
    label: '보통',
    moods: ['normal'] as const satisfies readonly ExpenseMoodKey[],
    includesLabel: '보통',
  },
  {
    key: 'negative',
    label: '나쁨',
    moods: ['bad', 'too bad'] as const satisfies readonly ExpenseMoodKey[],
    includesLabel: '안좋음 · 매우 안좋음',
  },
] as const;

export type MoodInsightBucketKey = (typeof MOOD_INSIGHT_BUCKETS)[number]['key'];

export function moodInsightBucketLabel(bucketKey: MoodInsightBucketKey): string {
  return MOOD_INSIGHT_BUCKETS.find((b) => b.key === bucketKey)?.label ?? bucketKey;
}

export function moodInsightBucketIncludesLabel(bucketKey: MoodInsightBucketKey): string {
  return MOOD_INSIGHT_BUCKETS.find((b) => b.key === bucketKey)?.includesLabel ?? '';
}

export function expenseMoodInBucket(mood: string, bucketKey: MoodInsightBucketKey): boolean {
  const bucket = MOOD_INSIGHT_BUCKETS.find((b) => b.key === bucketKey);
  if (!bucket) return false;
  const normalized = normalizeExpenseMood(mood);
  return (bucket.moods as readonly string[]).includes(normalized);
}
