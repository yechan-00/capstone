export type SatisfactionTone = 'positive' | 'neutral' | 'negative';

/** UI·저장 기준: 5(매우만족) ~ 1(매우불만족). 표시는 보통 위에서 아래로 5→1 */
export const SATISFACTION_LEVELS: readonly {
  stars: number;
  label: string;
  tone: SatisfactionTone;
}[] = [
  { stars: 5, label: '매우만족', tone: 'positive' },
  { stars: 4, label: '만족', tone: 'positive' },
  { stars: 3, label: '보통', tone: 'neutral' },
  { stars: 2, label: '불만족', tone: 'negative' },
  { stars: 1, label: '매우불만족', tone: 'negative' },
] as const;

export function satisfactionLabel(stars: number): string {
  const row = SATISFACTION_LEVELS.find((l) => l.stars === stars);
  return row?.label ?? '';
}
