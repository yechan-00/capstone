/** Firestore·로컬 URI에서 소비 사진 URL 추출 */
export function resolveExpenseImageUrl(data: Record<string, unknown> | null | undefined): string | null {
  if (!data) return null;
  const candidates = [data.imageUrl, data.image, data.photoUrl];
  for (const raw of candidates) {
    if (typeof raw !== 'string') continue;
    const url = raw.trim();
    if (isDisplayableImageUrl(url)) return url;
  }
  return null;
}

export function isDisplayableImageUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const u = url.trim();
  if (!u) return false;
  return (
    u.startsWith('http://') ||
    u.startsWith('https://') ||
    u.startsWith('file://') ||
    u.startsWith('content://') ||
    u.startsWith('ph://')
  );
}
