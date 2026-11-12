export const SPACE_MEMORIES_COLLECTION = 'memories';
export const SPACE_MEMORY_TITLE_MAX = 60;
export const SPACE_MEMORY_CONTENT_MAX = 2000;
export const SPACE_MEMORY_IMAGE_MAX = 5;
export const SPACE_MEMORY_PAGE_SIZE = 20;
export const SPACE_MEMORY_AUTHOR_FALLBACK_NAME = '이름 없음';

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const IMAGE_KEY_RE =
  /^spaces\/([A-Za-z0-9_-]{1,128})\/memories\/([A-Za-z0-9_-]{1,128})\/([A-Za-z0-9_-]{1,180}\.(?:jpg|png|webp|heic))$/;

export type SpaceMemory = {
  id: string;
  title: string;
  content: string;
  dateKey: string;
  createdByUid: string;
  imageKeys: string[];
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type SpaceMemoryDraft = {
  title: string;
  content: string;
  dateKey: string;
  imageKeys: string[];
};

export type SpaceMemoryAuthorView = {
  uid: string;
  displayName: string;
  photoURL?: string;
};

type AuthorSource = {
  uid: string;
  displayName: string;
  photoURL?: string;
};

function timestampToDateOrNull(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    try {
      const date = (value as { toDate: () => Date }).toDate();
      return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
    } catch {
      return null;
    }
  }
  return null;
}

export function isValidMemoryDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_KEY_RE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function parseClientMemoryTitle(raw: string): string {
  return raw.trim();
}

export function parseClientMemoryContent(raw: string): string {
  return raw.trim();
}

export function isValidSpaceMemoryTitle(raw: string): boolean {
  const title = parseClientMemoryTitle(raw);
  return title.length > 0 && title.length <= SPACE_MEMORY_TITLE_MAX;
}

export function isValidSpaceMemoryContent(raw: string): boolean {
  return parseClientMemoryContent(raw).length <= SPACE_MEMORY_CONTENT_MAX;
}

export function parseSpaceMemoryImageKey(
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

export function parseSpaceMemoryImageKeys(
  raw: unknown,
  expected?: { spaceId?: string; memoryId?: string },
): string[] | null {
  if (!Array.isArray(raw)) return null;
  if (raw.length > SPACE_MEMORY_IMAGE_MAX) return null;
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const key = parseSpaceMemoryImageKey(item, expected);
    if (!key || seen.has(key)) return null;
    seen.add(key);
    keys.push(key);
  }
  return keys;
}

export function isValidSpaceMemoryDraft(draft: SpaceMemoryDraft, expected?: { spaceId?: string; memoryId?: string }): boolean {
  if (!isValidSpaceMemoryTitle(draft.title)) return false;
  if (!isValidMemoryDateKey(draft.dateKey)) return false;
  if (!isValidSpaceMemoryContent(draft.content)) return false;
  return parseSpaceMemoryImageKeys(draft.imageKeys, expected) != null;
}

export function memoryPreview(content: string, max = 80): string {
  const text = parseClientMemoryContent(content);
  if (text.length <= max) return text;
  return `${text.slice(0, max).trimEnd()}…`;
}

export function compareSpaceMemories(a: SpaceMemory, b: SpaceMemory): number {
  if (a.dateKey !== b.dateKey) return a.dateKey > b.dateKey ? -1 : 1;
  const aCreated = a.createdAt?.getTime() ?? 0;
  const bCreated = b.createdAt?.getTime() ?? 0;
  if (aCreated !== bCreated) return bCreated - aCreated;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function sortSpaceMemories(memories: SpaceMemory[]): SpaceMemory[] {
  return [...memories].sort(compareSpaceMemories);
}

export function memoriesOnDate(memories: SpaceMemory[], dateKey: string): SpaceMemory[] {
  return sortSpaceMemories(memories.filter((row) => row.dateKey === dateKey));
}

export function dateKeysWithMemories(memories: SpaceMemory[]): Set<string> {
  const keys = new Set<string>();
  for (const row of memories) keys.add(row.dateKey);
  return keys;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

export function parseSpaceMemory(
  id: string,
  data: unknown,
  expectedSpaceId?: string,
): SpaceMemory | null {
  if (!id || id.includes('/')) return null;
  const row = asRecord(data);
  if (!row) return null;
  if (!isValidSpaceMemoryTitle(typeof row.title === 'string' ? row.title : '')) return null;
  if (!isValidMemoryDateKey(row.dateKey)) return null;
  if (typeof row.createdByUid !== 'string' || row.createdByUid.length === 0 || row.createdByUid.includes('/')) {
    return null;
  }
  const content = typeof row.content === 'string' ? row.content : '';
  if (!isValidSpaceMemoryContent(content)) return null;
  const imageKeys = parseSpaceMemoryImageKeys(row.imageKeys ?? [], {
    spaceId: expectedSpaceId,
    memoryId: id,
  });
  if (!imageKeys) return null;
  return {
    id,
    title: parseClientMemoryTitle(row.title as string),
    content: parseClientMemoryContent(content),
    dateKey: row.dateKey,
    createdByUid: row.createdByUid,
    imageKeys,
    createdAt: timestampToDateOrNull(row.createdAt),
    updatedAt: timestampToDateOrNull(row.updatedAt),
  };
}

export function resolveSpaceMemoryAuthor(
  createdByUid: string,
  members: AuthorSource[],
): SpaceMemoryAuthorView {
  const member = members.find((row) => row.uid === createdByUid);
  if (!member) {
    return { uid: createdByUid, displayName: SPACE_MEMORY_AUTHOR_FALLBACK_NAME };
  }
  return {
    uid: member.uid,
    displayName: member.displayName || SPACE_MEMORY_AUTHOR_FALLBACK_NAME,
    photoURL: member.photoURL,
  };
}

export function toSpaceMemoryWritePayload(
  draft: SpaceMemoryDraft,
  expected?: { spaceId?: string; memoryId?: string },
): {
  title: string;
  content: string;
  dateKey: string;
  imageKeys: string[];
} | null {
  const imageKeys = parseSpaceMemoryImageKeys(draft.imageKeys, expected);
  if (!imageKeys || !isValidSpaceMemoryTitle(draft.title) || !isValidMemoryDateKey(draft.dateKey)) return null;
  if (!isValidSpaceMemoryContent(draft.content)) return null;
  return {
    title: parseClientMemoryTitle(draft.title),
    content: parseClientMemoryContent(draft.content),
    dateKey: draft.dateKey,
    imageKeys,
  };
}
