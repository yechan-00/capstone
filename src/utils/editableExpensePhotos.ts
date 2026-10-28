import { getExpenseImageUrls, type ExpenseImageSource } from './expenseImage';
import {
  MAX_EXPENSE_PHOTOS,
  mergePendingExpensePhotos,
  remainingExpensePhotoSlots,
  removePendingExpensePhoto,
  setCoverPendingExpensePhoto,
} from './pendingExpensePhotos';
import type { EditableExpensePhoto } from './editedImagePersist';

export type { EditableExpensePhoto } from './editedImagePersist';
export {
  assembleEditedImageUrls,
  buildEditedImagePersistFields,
  cloneEditablePhotos,
  editablePhotosUnchanged,
  localEditablePhotos,
} from './editedImagePersist';

export function editablePhotosFromExpense(
  expense: ExpenseImageSource | null | undefined,
): EditableExpensePhoto[] {
  return getExpenseImageUrls(expense).map((url) => ({
    id: `remote:${url}`,
    kind: 'remote' as const,
    uri: url,
  }));
}

export function expenseHasImageUrlsField(
  expense: { imageUrls?: string[] } | null | undefined,
): boolean {
  return Array.isArray(expense?.imageUrls);
}

export function remainingEditablePhotoSlots(
  photos: EditableExpensePhoto[],
  max = MAX_EXPENSE_PHOTOS,
): number {
  return remainingExpensePhotoSlots(photos, max);
}

export function mergeEditableExpensePhotos(
  existing: EditableExpensePhoto[],
  incoming: EditableExpensePhoto[],
  max = MAX_EXPENSE_PHOTOS,
): EditableExpensePhoto[] {
  const lookup = new Map<string, EditableExpensePhoto>();
  for (const photo of [...existing, ...incoming]) lookup.set(photo.id, photo);
  const merged = mergePendingExpensePhotos(existing, incoming, max);
  return merged.map((photo) => lookup.get(photo.id)).filter((photo): photo is EditableExpensePhoto => Boolean(photo));
}

export function removeEditableExpensePhoto(
  photos: EditableExpensePhoto[],
  id: string,
): EditableExpensePhoto[] {
  return removePendingExpensePhoto(photos, id) as EditableExpensePhoto[];
}

export function setCoverEditableExpensePhoto(
  photos: EditableExpensePhoto[],
  id: string,
): EditableExpensePhoto[] {
  return setCoverPendingExpensePhoto(photos, id) as EditableExpensePhoto[];
}
