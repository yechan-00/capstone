export const NICKNAME_MAX = 24;
export const PROFILE_IMAGE_KEY_PATTERN =
  /^users\/([A-Za-z0-9_-]{1,128})\/profile\/([A-Za-z0-9_-]{1,180}\.(?:jpg|png|webp|heic))$/;

export type ParsedProfileImageKey = {
  uid: string;
  fileName: string;
  key: string;
};

export function normalizeNickname(raw: string): string {
  return raw.trim().slice(0, NICKNAME_MAX);
}

export function parseProfileImageKey(raw: unknown, expectedUid?: string): ParsedProfileImageKey | null {
  if (typeof raw !== 'string') return null;
  const key = raw.trim();
  if (key.includes('/expenses/') || key.includes('..')) return null;
  const match = PROFILE_IMAGE_KEY_PATTERN.exec(key);
  if (!match) return null;
  if (expectedUid && match[1] !== expectedUid) return null;
  return { uid: match[1], fileName: match[2], key };
}

export function ownProfileImageUri(
  apiBase: string | null | undefined,
  uid: string,
  key: string | null | undefined,
): string | null {
  if (!apiBase) return null;
  const parsed = parseProfileImageKey(key, uid);
  if (!parsed) return null;
  return `${apiBase.replace(/\/$/, '')}/v1/profiles/${encodeURIComponent(parsed.uid)}/${encodeURIComponent(parsed.fileName)}`;
}
