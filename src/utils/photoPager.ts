/** 컨테이너 너비 기준 페이지 인덱스. 범위를 벗어나지 않는다. */
export function pageIndexFromOffset(
  offsetX: number,
  pageWidth: number,
  count: number,
): number {
  if (pageWidth <= 0 || count <= 0) return 0;
  const next = Math.round(offsetX / pageWidth);
  return Math.max(0, Math.min(count - 1, next));
}
