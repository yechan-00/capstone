export const EDITED_IMAGE_MAX = 5;

export type EditableExpensePhoto =
  | { id: string; kind: 'remote'; uri: string }
  | { id: string; kind: 'local'; uri: string };

export function cloneEditablePhotos(
  photos: EditableExpensePhoto[],
): EditableExpensePhoto[] {
  return photos.map((photo) => ({ ...photo }));
}

export function editablePhotosUnchanged(
  original: EditableExpensePhoto[],
  current: EditableExpensePhoto[],
): boolean {
  if (original.length !== current.length) return false;
  if (current.some((photo) => photo.kind === 'local')) return false;
  return original.every((photo, index) => {
    const next = current[index];
    return photo.kind === 'remote' && next.kind === 'remote' && photo.uri === next.uri;
  });
}

export function localEditablePhotos(
  photos: EditableExpensePhoto[],
): Array<Extract<EditableExpensePhoto, { kind: 'local' }>> {
  return photos.filter((photo): photo is Extract<EditableExpensePhoto, { kind: 'local' }> => photo.kind === 'local');
}

export function assembleEditedImageUrls(
  photos: EditableExpensePhoto[],
  uploadedByLocalId: Record<string, string>,
): { urls: string[]; failedLocalCount: number; totalLocal: number } {
  const urls: string[] = [];
  let failedLocalCount = 0;
  let totalLocal = 0;

  for (const photo of photos) {
    if (photo.kind === 'remote') {
      if (!urls.includes(photo.uri)) urls.push(photo.uri);
      if (urls.length >= EDITED_IMAGE_MAX) break;
      continue;
    }
    totalLocal += 1;
    const uploaded = uploadedByLocalId[photo.id];
    if (typeof uploaded === 'string' && uploaded.startsWith('https://') && !urls.includes(uploaded)) {
      urls.push(uploaded);
    } else {
      failedLocalCount += 1;
    }
    if (urls.length >= EDITED_IMAGE_MAX) break;
  }

  return {
    urls: urls.slice(0, EDITED_IMAGE_MAX),
    failedLocalCount,
    totalLocal,
  };
}

export function buildEditedImagePersistFields(
  urls: string[],
  originallyHadImageUrlsField: boolean,
): { imageUrl: string | null; imageUrls?: string[] } {
  if (urls.length === 0) {
    return originallyHadImageUrlsField
      ? { imageUrl: null, imageUrls: [] }
      : { imageUrl: null };
  }
  if (!originallyHadImageUrlsField && urls.length === 1) {
    return { imageUrl: urls[0] };
  }
  return { imageUrl: urls[0] ?? null, imageUrls: urls };
}
