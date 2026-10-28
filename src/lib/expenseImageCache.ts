import { Image } from 'expo-image';

export const EXPENSE_IMAGE_CACHE_POLICY = 'memory-disk' as const;

/** 같은 R2 URL을 캘린더·시트·상세에서 공유하기 위한 캐시 키. 토큰 포함 URL 전체를 씁니다. */
export function expenseImageCacheKey(uri: string): string {
  return uri.trim();
}

export function seedExpenseImageCache(localUri: string, remoteUrl: string): void {
  void Image.writeToCacheAsync(localUri, expenseImageCacheKey(remoteUrl)).catch(() => undefined);
}

export function prefetchExpenseImage(uri: string): void {
  const key = uri.trim();
  if (!key) return;
  void Image.prefetch(key, EXPENSE_IMAGE_CACHE_POLICY).catch(() => undefined);
}
