export const SPACE_MEMORY_IMAGE_MAX = 5;

const IMAGE_KEY_RE =
  /^spaces\/([A-Za-z0-9_-]{1,128})\/memories\/([A-Za-z0-9_-]{1,128})\/([A-Za-z0-9_-]{1,180}\.(?:jpg|png|webp|heic))$/;

function parseSpaceMemoryImageKey(
  raw: unknown,
  expected?: { spaceId?: string; memoryId?: string },
): string | null {
  if (typeof raw !== 'string') return null;
  const key = raw.trim();
  if (key.includes('..') || key.includes('/expenses/') || key.includes('/profile/')) return null;
  const match = IMAGE_KEY_RE.exec(key);
  if (!match) return null;
  if (expected?.spaceId && expected.spaceId !== match[1]) return null;
  if (expected?.memoryId && expected.memoryId !== match[2]) return null;
  return key;
}

export function memoryImageFileName(imageKey: string): string | null {
  const parsed = parseSpaceMemoryImageKey(imageKey);
  if (!parsed) return null;
  const parts = parsed.split('/');
  return parts[parts.length - 1] ?? null;
}

export function spaceMemoryImageUri(
  apiBase: string | null,
  spaceId: string,
  memoryId: string,
  imageKey: string,
): string | null {
  if (!apiBase) return null;
  const key = parseSpaceMemoryImageKey(imageKey, { spaceId, memoryId });
  if (!key) return null;
  const fileName = memoryImageFileName(key);
  if (!fileName) return null;
  return `${apiBase.replace(/\/$/, '')}/v1/spaces/${encodeURIComponent(spaceId)}/memories/${encodeURIComponent(memoryId)}/images/${encodeURIComponent(fileName)}`;
}

export type MemoryPhotoDraft =
  | { kind: 'remote'; id: string; key: string }
  | { kind: 'local'; id: string; uri: string };

export function remoteMemoryPhotos(keys: string[], spaceId: string, memoryId: string): MemoryPhotoDraft[] {
  return keys
    .map((key) => parseSpaceMemoryImageKey(key, { spaceId, memoryId }))
    .filter((key): key is string => Boolean(key))
    .map((key) => ({ kind: 'remote' as const, id: key, key }));
}

export function remainingMemoryPhotoSlots(photos: MemoryPhotoDraft[]): number {
  return Math.max(0, SPACE_MEMORY_IMAGE_MAX - photos.length);
}

export function localMemoryPhotos(photos: MemoryPhotoDraft[]): Extract<MemoryPhotoDraft, { kind: 'local' }>[] {
  return photos.filter((photo): photo is Extract<MemoryPhotoDraft, { kind: 'local' }> => photo.kind === 'local');
}

export function moveMemoryPhoto(photos: MemoryPhotoDraft[], from: number, to: number): MemoryPhotoDraft[] {
  if (from === to || from < 0 || to < 0 || from >= photos.length || to >= photos.length) return photos;
  const next = [...photos];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}
