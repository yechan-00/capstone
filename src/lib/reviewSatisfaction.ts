import type { DecisionAgain } from '@/lib/types';

/**
 * 만족도 1~5(매우불만족~매우만족)만 저장할 때 Firestore·인사이트용 decisionAgain.
 * 만족·매우만족(4~5) → yes, 보통(3) → maybe, 불만족·매우불만족(1~2) → no
 */
export function decisionAgainFromSatisfaction(rating: number): DecisionAgain {
  if (rating >= 4) return 'yes';
  if (rating === 3) return 'maybe';
  return 'no';
}

/** 보통·불만족·매우불만족(1~3)일 때만 후회 이유 칩 표시 */
export function needsRegretReasonsFlow(rating: number): boolean {
  return rating >= 1 && rating <= 3;
}
