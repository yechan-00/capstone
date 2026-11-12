import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  startAfter,
  updateDoc,
  where,
  type DocumentSnapshot,
  type QueryDocumentSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { SPACES_COLLECTION } from '@/lib/spaceList';
import {
  SPACE_MEMORIES_COLLECTION,
  SPACE_MEMORY_PAGE_SIZE,
  parseSpaceMemory,
  parseSpaceMemoryImageKey,
  sortSpaceMemories,
  toSpaceMemoryWritePayload,
  type SpaceMemory,
  type SpaceMemoryDraft,
} from '@/lib/spaceMemory';
import { SpaceMemoryError, toSpaceMemoryError } from '@/lib/spaceMemoryClient';
import {
  rollbackSpaceMemoryImages,
  uploadSpaceMemoryPhotoMap,
  uploadSpaceMemoryPhotos,
  deleteSpaceMemoryImageObject,
} from '@/services/spaceMemoryImageService';
import type { MemoryPhotoDraft } from '@/lib/spaceMemoryImage';
import { localMemoryPhotos } from '@/lib/spaceMemoryImage';

function requireUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new SpaceMemoryError('unauthenticated');
  return uid;
}

function isUsableId(value: string | undefined): value is string {
  return typeof value === 'string' && value.length > 0 && !value.includes('/');
}

function memoriesCol(spaceId: string) {
  return collection(db, SPACES_COLLECTION, spaceId, SPACE_MEMORIES_COLLECTION);
}

function memoryRef(spaceId: string, memoryId: string) {
  return doc(db, SPACES_COLLECTION, spaceId, SPACE_MEMORIES_COLLECTION, memoryId);
}

export function allocateSpaceMemoryId(spaceId: string): string {
  if (!isUsableId(spaceId)) throw new SpaceMemoryError('invalid-argument');
  return doc(memoriesCol(spaceId)).id;
}

export function subscribeSpaceMonthMemories(
  spaceId: string,
  rangeStart: string,
  rangeEnd: string,
  onNext: (memories: SpaceMemory[]) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  if (!isUsableId(spaceId) || rangeStart > rangeEnd) {
    onError(new SpaceMemoryError('invalid-argument'));
    return () => {};
  }
  const monthQuery = query(
    memoriesCol(spaceId),
    where('dateKey', '>=', rangeStart),
    where('dateKey', '<=', rangeEnd),
  );
  return onSnapshot(
    monthQuery,
    (snap) => {
      const memories: SpaceMemory[] = [];
      for (const row of snap.docs) {
        const parsed = parseSpaceMemory(row.id, row.data(), spaceId);
        if (parsed) memories.push(parsed);
      }
      onNext(sortSpaceMemories(memories));
    },
    onError,
  );
}

export async function getSpaceMemory(spaceId: string, memoryId: string): Promise<SpaceMemory> {
  requireUid();
  if (!isUsableId(spaceId) || !isUsableId(memoryId)) {
    throw new SpaceMemoryError('invalid-argument');
  }
  try {
    const snap = await getDoc(memoryRef(spaceId, memoryId));
    if (!snap.exists()) throw new SpaceMemoryError('not-found');
    const parsed = parseSpaceMemory(snap.id, snap.data(), spaceId);
    if (!parsed) throw new SpaceMemoryError('not-found');
    return parsed;
  } catch (error) {
    throw toSpaceMemoryError(error, 'read');
  }
}

export type SpaceMemoryPage = {
  memories: SpaceMemory[];
  cursor: QueryDocumentSnapshot | null;
  hasMore: boolean;
};

export async function listSpaceMemoriesPage(
  spaceId: string,
  cursor: DocumentSnapshot | null = null,
): Promise<SpaceMemoryPage> {
  requireUid();
  if (!isUsableId(spaceId)) throw new SpaceMemoryError('invalid-argument');
  try {
    const pageQuery = cursor
      ? query(
          memoriesCol(spaceId),
          orderBy('dateKey', 'desc'),
          orderBy('createdAt', 'desc'),
          startAfter(cursor),
          limit(SPACE_MEMORY_PAGE_SIZE),
        )
      : query(
          memoriesCol(spaceId),
          orderBy('dateKey', 'desc'),
          orderBy('createdAt', 'desc'),
          limit(SPACE_MEMORY_PAGE_SIZE),
        );
    const snap = await getDocs(pageQuery);
    const memories: SpaceMemory[] = [];
    for (const row of snap.docs) {
      const parsed = parseSpaceMemory(row.id, row.data(), spaceId);
      if (parsed) memories.push(parsed);
    }
    const last = snap.docs[snap.docs.length - 1] ?? null;
    return {
      memories,
      cursor: last,
      hasMore: snap.docs.length === SPACE_MEMORY_PAGE_SIZE,
    };
  } catch (error) {
    throw toSpaceMemoryError(error, 'read');
  }
}

export async function createSpaceMemory(
  spaceId: string,
  draft: SpaceMemoryDraft,
  localUris: string[],
): Promise<{ memoryId: string; failedPhotoCount: number }> {
  const uid = requireUid();
  if (!isUsableId(spaceId)) throw new SpaceMemoryError('invalid-argument');
  const memoryId = allocateSpaceMemoryId(spaceId);
  const uploaded = await uploadSpaceMemoryPhotos(spaceId, memoryId, localUris);
  const payload = toSpaceMemoryWritePayload(
    { ...draft, imageKeys: uploaded.keys },
    { spaceId, memoryId },
  );
  if (!payload) {
    await rollbackSpaceMemoryImages(spaceId, memoryId, uploaded.keys);
    throw new SpaceMemoryError('invalid-argument');
  }
  try {
    await setDoc(memoryRef(spaceId, memoryId), {
      ...payload,
      createdByUid: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    await rollbackSpaceMemoryImages(spaceId, memoryId, uploaded.keys);
    throw toSpaceMemoryError(error, 'write');
  }
  return { memoryId, failedPhotoCount: uploaded.failedCount };
}

export async function updateSpaceMemory(
  spaceId: string,
  memoryId: string,
  draft: Omit<SpaceMemoryDraft, 'imageKeys'>,
  photos: MemoryPhotoDraft[],
  originalKeys: string[],
): Promise<{ failedPhotoCount: number }> {
  requireUid();
  if (!isUsableId(spaceId) || !isUsableId(memoryId)) {
    throw new SpaceMemoryError('invalid-argument');
  }
  const locals = localMemoryPhotos(photos);
  const uploaded = await uploadSpaceMemoryPhotoMap(spaceId, memoryId, locals);
  const nextKeys: string[] = [];
  for (const photo of photos) {
    if (photo.kind === 'remote') {
      const key = parseSpaceMemoryImageKey(photo.key, { spaceId, memoryId });
      if (key) nextKeys.push(key);
    } else {
      const key = uploaded.keysById.get(photo.id);
      if (key) nextKeys.push(key);
    }
  }
  if (locals.length > 0 && uploaded.keysById.size === 0) {
    const payload = toSpaceMemoryWritePayload(
      { ...draft, imageKeys: originalKeys },
      { spaceId, memoryId },
    );
    if (!payload) throw new SpaceMemoryError('invalid-argument');
    try {
      await updateDoc(memoryRef(spaceId, memoryId), {
        title: payload.title,
        content: payload.content,
        dateKey: payload.dateKey,
        updatedAt: serverTimestamp(),
      });
    } catch (error) {
      throw toSpaceMemoryError(error, 'write');
    }
    return { failedPhotoCount: uploaded.failedCount };
  }

  const payload = toSpaceMemoryWritePayload(
    { ...draft, imageKeys: nextKeys },
    { spaceId, memoryId },
  );
  if (!payload) {
    await rollbackSpaceMemoryImages(spaceId, memoryId, [...uploaded.keysById.values()]);
    throw new SpaceMemoryError('invalid-argument');
  }
  try {
    await updateDoc(memoryRef(spaceId, memoryId), {
      ...payload,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    await rollbackSpaceMemoryImages(spaceId, memoryId, [...uploaded.keysById.values()]);
    throw toSpaceMemoryError(error, 'write');
  }
  const removed = originalKeys.filter((key) => !payload.imageKeys.includes(key));
  for (const key of removed) {
    await deleteSpaceMemoryImageObject(spaceId, memoryId, key);
  }
  return { failedPhotoCount: uploaded.failedCount };
}

export async function deleteSpaceMemory(spaceId: string, memory: SpaceMemory): Promise<void> {
  requireUid();
  if (!isUsableId(spaceId) || !isUsableId(memory.id)) {
    throw new SpaceMemoryError('invalid-argument');
  }
  try {
    await deleteDoc(memoryRef(spaceId, memory.id));
  } catch (error) {
    throw toSpaceMemoryError(error, 'write');
  }
  for (const key of memory.imageKeys) {
    await deleteSpaceMemoryImageObject(spaceId, memory.id, key);
  }
}
