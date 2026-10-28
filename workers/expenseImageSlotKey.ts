export const EXPENSE_IMAGE_SLOT_MIN = 1;
export const EXPENSE_IMAGE_SLOT_MAX = 5;

/** 기존 GET 파일명 패턴. 슬롯 고유 키도 이 문자 집합을 써야 한다. */
export const EXPENSE_IMAGE_FILE_NAME_PATTERN = /^[A-Za-z0-9_-]{1,180}\.(?:jpg|png|webp|heic)$/;

export function isValidExpenseImageSlot(slot: number): boolean {
  return Number.isInteger(slot) && slot >= EXPENSE_IMAGE_SLOT_MIN && slot <= EXPENSE_IMAGE_SLOT_MAX;
}

export function createExpenseImageSlotUniqueId(): string {
  return crypto.randomUUID().replaceAll('-', '');
}

export function createExpenseImageSlotFileName(
  expenseId: string,
  slot: number,
  uniqueId: string,
  extension: string,
): string {
  return `${expenseId}_${slot}_${uniqueId}.${extension}`;
}

export function expenseImageObjectKey(uid: string, fileName: string): string {
  return `users/${uid}/expenses/${fileName}`;
}

export function legacyExpenseImagePrefix(uid: string, expenseId: string): string {
  return `users/${uid}/expenses/${expenseId}.`;
}

export function slotExpenseImagePrefix(uid: string, expenseId: string, slot: number): string {
  return `users/${uid}/expenses/${expenseId}_${slot}.`;
}
