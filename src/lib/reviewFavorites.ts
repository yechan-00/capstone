import AsyncStorage from '@react-native-async-storage/async-storage';

function storageKey(accountId: string): string {
  return `review_favorites:${accountId}`;
}

export async function loadReviewFavorites(accountId: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(storageKey(accountId));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id): id is string => typeof id === 'string' && id.length > 0));
  } catch {
    return new Set();
  }
}

export async function saveReviewFavorites(accountId: string, ids: Set<string>): Promise<void> {
  await AsyncStorage.setItem(storageKey(accountId), JSON.stringify([...ids]));
}

export async function toggleReviewFavorite(
  accountId: string,
  scheduleId: string,
  current: Set<string>,
): Promise<Set<string>> {
  const next = new Set(current);
  if (next.has(scheduleId)) next.delete(scheduleId);
  else next.add(scheduleId);
  await saveReviewFavorites(accountId, next);
  return next;
}
