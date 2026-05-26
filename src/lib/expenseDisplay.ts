/** 카드·리스트에서 굵은 제목(메뉴명) / 보조 텍스트(이유) 분리 */
export function expenseCardTitle(expense: {
  item?: string | null;
  content?: string | null;
  summaryLine?: string | null;
  reason?: string | null;
} | null | undefined): string {
  const itemName =
    [expense?.item, expense?.content, expense?.summaryLine]
      .map((s) => (typeof s === 'string' ? s.trim() : ''))
      .find((s) => s.length > 0) ?? '';
  const reason = (expense?.reason ?? '').trim();
  return itemName || reason || '소비 평가';
}

export function expenseCardSubtitle(expense: {
  item?: string | null;
  content?: string | null;
  summaryLine?: string | null;
  reason?: string | null;
} | null | undefined): string {
  const itemName =
    [expense?.item, expense?.content, expense?.summaryLine]
      .map((s) => (typeof s === 'string' ? s.trim() : ''))
      .find((s) => s.length > 0) ?? '';
  const reason = (expense?.reason ?? '').trim();
  if (itemName && reason && reason !== itemName) return reason;
  return '';
}
