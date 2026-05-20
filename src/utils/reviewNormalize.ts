/**
 * Firestore에서 satisfaction이 number·string·Long·누락으로 올 수 있음.
 * 캘린더 감성 색 등에서 1~5 판별이 틀어지지 않게 1~5 또는 NaN으로 통일.
 * NaN이면 UI는 `decisionAgain`으로 톤을 잡음(`sentimentFromDecision`).
 */
export function normalizeReviewSatisfaction(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return raw;
  }
  if (typeof raw === 'string') {
    const n = Number(String(raw).trim());
    if (Number.isFinite(n)) return n;
  }
  if (raw != null && typeof raw === 'object') {
    const any = raw as { toNumber?: () => number };
    if (typeof any.toNumber === 'function') {
      try {
        const n = any.toNumber();
        if (Number.isFinite(n)) return n;
      } catch {
        /* ignore */
      }
    }
  }
  return NaN;
}
