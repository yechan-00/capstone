/** Firestore `reason` 필드 → 칩 목록 + 자유 서술 분리 */
export function parseExpenseReason(reason: string): {
  chips: string[];
  detail: string;
} {
  const trimmed = reason?.trim() ?? '';
  if (!trimmed || trimmed === '기록 없음') {
    return { chips: [], detail: '' };
  }

  const [chipPart, ...detailParts] = trimmed.split(' · ');
  const detail = detailParts.join(' · ').trim();
  const chips = chipPart
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  return { chips, detail };
}
