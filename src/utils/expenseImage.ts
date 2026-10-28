export type ExpenseImageSource = {
  imageUrl?: string | null;
  imageUrls?: string[] | null;
};

function sanitizeImageUrlList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const urls: string[] = [];
  for (const item of value) {
    if (typeof item !== 'string') continue;
    const url = item.trim();
    if (!isDisplayableImageUrl(url)) continue;
    if (urls.includes(url)) continue;
    urls.push(url);
    if (urls.length >= 5) break;
  }
  return urls;
}

/**
 * Firestore에서 읽은 imageUrls만 정규화한다. 필드가 없으면 undefined.
 * 빈 배열은 '사진 없음'으로 명시된 신규 문서로 유지한다.
 */
export function parseExpenseImageUrlsField(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  return sanitizeImageUrlList(value);
}

/**
 * 표시용 사진 목록. 저장 데이터를 바꾸지 않는다.
 *
 * - imageUrls가 배열이면(빈 배열 포함) 그 배열만 사용한다.
 *   오래된 imageUrl이 남아 있어도 다시 끌어오지 않는다.
 * - imageUrls 필드가 없으면 기존 imageUrl 한 장으로 호환한다.
 */
export function getExpenseImageUrls(expense: ExpenseImageSource | null | undefined): string[] {
  if (!expense) return [];
  if (Array.isArray(expense.imageUrls)) return sanitizeImageUrlList(expense.imageUrls);
  if (isDisplayableImageUrl(expense.imageUrl)) return [expense.imageUrl!.trim()];
  return [];
}

/** 대표 사진. 신규는 imageUrls[0], 기존은 imageUrl, 없으면 null. */
export function getExpenseCoverUrl(expense: ExpenseImageSource | null | undefined): string | null {
  return getExpenseImageUrls(expense)[0] ?? null;
}

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
