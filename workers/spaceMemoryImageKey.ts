export const SPACE_MEMORY_ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
export const SPACE_MEMORY_FILE_NAME_PATTERN = /^[A-Za-z0-9_-]{1,180}\.(?:jpg|png|webp|heic)$/;
export const SPACE_MEMORY_IMAGE_KEY_PATTERN =
  /^spaces\/([A-Za-z0-9_-]{1,128})\/memories\/([A-Za-z0-9_-]{1,128})\/([A-Za-z0-9_-]{1,180}\.(?:jpg|png|webp|heic))$/;

export const SPACE_MEMORY_IMAGE_MAX = 5;
/** R2 prefix cap. Firestore still stores at most 5 keys; extra slots are for failed-rollback leftovers. */
export const SPACE_MEMORY_R2_OBJECT_MAX = 8;

const ALLOWED_MEMORY_CONTENT_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'image/heif': 'heic',
};

export type ParsedSpaceMemoryImageKey = {
  spaceId: string;
  memoryId: string;
  fileName: string;
  key: string;
};

export function isUsableSpaceMemoryId(value: string): boolean {
  return SPACE_MEMORY_ID_PATTERN.test(value);
}

export function spaceMemoryImageObjectKey(spaceId: string, memoryId: string, fileName: string): string {
  return `spaces/${spaceId}/memories/${memoryId}/${fileName}`;
}

export function spaceMemoryImagePrefix(spaceId: string, memoryId: string): string {
  return `spaces/${spaceId}/memories/${memoryId}/`;
}

export function parseSpaceMemoryImageKey(
  raw: unknown,
  expected?: { spaceId?: string; memoryId?: string },
): ParsedSpaceMemoryImageKey | null {
  if (typeof raw !== 'string') return null;
  const key = raw.trim();
  if (key.includes('..') || key.includes('/expenses/') || key.includes('/profile/')) return null;
  const match = SPACE_MEMORY_IMAGE_KEY_PATTERN.exec(key);
  if (!match) return null;
  const spaceId = match[1];
  const memoryId = match[2];
  const fileName = match[3];
  if (expected?.spaceId && expected.spaceId !== spaceId) return null;
  if (expected?.memoryId && expected.memoryId !== memoryId) return null;
  return { spaceId, memoryId, fileName, key };
}

export function createSpaceMemoryImageFileName(extension: string): string {
  const uniqueId = crypto.randomUUID().replaceAll('-', '');
  return `img_${uniqueId}.${extension}`;
}

export function spaceMemoryImageExtension(contentType: string): string | null {
  return ALLOWED_MEMORY_CONTENT_TYPES[contentType] ?? null;
}

export function isSpaceMemoryR2CountAtCap(count: number): boolean {
  return count >= SPACE_MEMORY_R2_OBJECT_MAX;
}

export function isSpaceMemoryR2CountOverCap(count: number): boolean {
  return count > SPACE_MEMORY_R2_OBJECT_MAX;
}

export function spaceMemoryImageCustomMetadata(uid: string, spaceId: string, memoryId: string) {
  return {
    ownerUid: uid,
    kind: 'space-memory',
    spaceId,
    memoryId,
  };
}

export function canUploadSpaceMemoryImage(args: {
  memoryExists: boolean;
  createdByUid: string | null;
  sessionUid: string;
}): boolean {
  if (!args.memoryExists) return true;
  return Boolean(args.createdByUid && args.createdByUid === args.sessionUid);
}

export function canDeleteOwnedMemoryImage(ownerUid: string | undefined, sessionUid: string): boolean {
  return Boolean(ownerUid && ownerUid === sessionUid);
}
