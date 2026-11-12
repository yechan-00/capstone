export const PROFILE_IMAGE_FILE_NAME_PATTERN = /^[A-Za-z0-9_-]{1,180}\.(?:jpg|png|webp|heic)$/;
export const PROFILE_IMAGE_UID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
export const PROFILE_IMAGE_KEY_PATTERN =
  /^users\/([A-Za-z0-9_-]{1,128})\/profile\/([A-Za-z0-9_-]{1,180}\.(?:jpg|png|webp|heic))$/;

export type ParsedProfileImageKey = {
  uid: string;
  fileName: string;
  key: string;
};

export function isValidProfileImageFileName(fileName: string): boolean {
  return PROFILE_IMAGE_FILE_NAME_PATTERN.test(fileName);
}

export function profileImageObjectKey(uid: string, fileName: string): string {
  return `users/${uid}/profile/${fileName}`;
}

export function profileImagePrefix(uid: string): string {
  return `users/${uid}/profile/`;
}

export function parseProfileImageKey(raw: unknown, expectedUid?: string): ParsedProfileImageKey | null {
  if (typeof raw !== 'string') return null;
  const key = raw.trim();
  if (key.includes('/expenses/') || key.includes('..')) return null;
  const match = PROFILE_IMAGE_KEY_PATTERN.exec(key);
  if (!match) return null;
  const uid = match[1];
  const fileName = match[2];
  if (expectedUid && uid !== expectedUid) return null;
  return { uid, fileName, key };
}

export function createProfileImageFileName(extension: string): string {
  const uniqueId = crypto.randomUUID().replaceAll('-', '');
  return `avatar_${uniqueId}.${extension}`;
}
