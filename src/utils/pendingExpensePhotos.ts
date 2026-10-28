export const MAX_EXPENSE_PHOTOS = 5;

export type PendingExpensePhoto = {
  id: string;
  uri: string;
};

function isUsablePhoto(photo: PendingExpensePhoto): boolean {
  return typeof photo.id === 'string' && photo.id.length > 0
    && typeof photo.uri === 'string' && photo.uri.trim().length > 0;
}

/** 기존 순서를 유지한 채 추가한다. 최대 장 수를 넘기면 앞쪽부터만 남긴다. */
export function mergePendingExpensePhotos(
  existing: PendingExpensePhoto[],
  incoming: PendingExpensePhoto[],
  max = MAX_EXPENSE_PHOTOS,
): PendingExpensePhoto[] {
  const next: PendingExpensePhoto[] = [];
  const seenIds = new Set<string>();
  const seenUris = new Set<string>();

  for (const photo of [...existing, ...incoming]) {
    if (next.length >= max) break;
    if (!isUsablePhoto(photo)) continue;
    if (seenIds.has(photo.id) || seenUris.has(photo.uri)) continue;
    seenIds.add(photo.id);
    seenUris.add(photo.uri);
    next.push(photo);
  }

  return next;
}

export function remainingExpensePhotoSlots(
  photos: PendingExpensePhoto[],
  max = MAX_EXPENSE_PHOTOS,
): number {
  return Math.max(0, max - photos.length);
}

export function removePendingExpensePhoto(
  photos: PendingExpensePhoto[],
  id: string,
): PendingExpensePhoto[] {
  return photos.filter((photo) => photo.id !== id);
}

/** 선택한 사진을 맨 앞으로 옮겨 대표로 만든다. */
export function setCoverPendingExpensePhoto(
  photos: PendingExpensePhoto[],
  id: string,
): PendingExpensePhoto[] {
  const index = photos.findIndex((photo) => photo.id === id);
  if (index <= 0) return photos;
  const next = [...photos];
  const [cover] = next.splice(index, 1);
  next.unshift(cover);
  return next;
}
