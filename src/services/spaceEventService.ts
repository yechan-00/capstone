import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  updateDoc,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import {
  SPACE_EVENTS_COLLECTION,
  parseSpaceEvent,
  sortSpaceEvents,
  toSpaceEventWritePayload,
  type SpaceEvent,
  type SpaceEventDraft,
} from '@/lib/spaceEvent';
import { SpaceEventError, toSpaceEventError } from '@/lib/spaceEventClient';
import { SPACES_COLLECTION } from '@/lib/spaceList';

function requireUid(): string {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new SpaceEventError('unauthenticated');
  return uid;
}

function eventsCol(spaceId: string) {
  return collection(db, SPACES_COLLECTION, spaceId, SPACE_EVENTS_COLLECTION);
}

function eventRef(spaceId: string, eventId: string) {
  return doc(db, SPACES_COLLECTION, spaceId, SPACE_EVENTS_COLLECTION, eventId);
}

function isUsableId(value: string | undefined): value is string {
  return typeof value === 'string' && value.length > 0 && !value.includes('/');
}

export function subscribeSpaceMonthEvents(
  spaceId: string,
  rangeStart: string,
  rangeEnd: string,
  onNext: (events: SpaceEvent[]) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  if (!isUsableId(spaceId) || rangeStart > rangeEnd) {
    onError(new SpaceEventError('invalid-argument'));
    return () => {};
  }

  const monthQuery = query(
    eventsCol(spaceId),
    where('dateKey', '>=', rangeStart),
    where('dateKey', '<=', rangeEnd),
  );

  return onSnapshot(
    monthQuery,
    (snap) => {
      const events: SpaceEvent[] = [];
      for (const row of snap.docs) {
        const parsed = parseSpaceEvent(row.id, row.data());
        if (parsed) events.push(parsed);
      }
      onNext(sortSpaceEvents(events));
    },
    onError,
  );
}

export async function getSpaceEvent(spaceId: string, eventId: string): Promise<SpaceEvent> {
  requireUid();
  if (!isUsableId(spaceId) || !isUsableId(eventId)) {
    throw new SpaceEventError('invalid-argument');
  }
  try {
    const snap = await getDoc(eventRef(spaceId, eventId));
    if (!snap.exists()) throw new SpaceEventError('not-found');
    const parsed = parseSpaceEvent(snap.id, snap.data());
    if (!parsed) throw new SpaceEventError('not-found');
    return parsed;
  } catch (error) {
    throw toSpaceEventError(error, 'read');
  }
}

export async function createSpaceEvent(spaceId: string, draft: SpaceEventDraft): Promise<string> {
  const uid = requireUid();
  if (!isUsableId(spaceId)) throw new SpaceEventError('invalid-argument');
  const payload = toSpaceEventWritePayload(draft);
  if (!payload) throw new SpaceEventError('invalid-argument');

  try {
    const ref = await addDoc(eventsCol(spaceId), {
      ...payload,
      createdByUid: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return ref.id;
  } catch (error) {
    throw toSpaceEventError(error, 'write');
  }
}

export async function updateSpaceEvent(
  spaceId: string,
  eventId: string,
  draft: SpaceEventDraft,
): Promise<void> {
  requireUid();
  if (!isUsableId(spaceId) || !isUsableId(eventId)) {
    throw new SpaceEventError('invalid-argument');
  }
  const payload = toSpaceEventWritePayload(draft);
  if (!payload) throw new SpaceEventError('invalid-argument');

  try {
    await updateDoc(eventRef(spaceId, eventId), {
      ...payload,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw toSpaceEventError(error, 'write');
  }
}

export async function deleteSpaceEvent(spaceId: string, eventId: string): Promise<void> {
  requireUid();
  if (!isUsableId(spaceId) || !isUsableId(eventId)) {
    throw new SpaceEventError('invalid-argument');
  }
  try {
    await deleteDoc(eventRef(spaceId, eventId));
  } catch (error) {
    throw toSpaceEventError(error, 'write');
  }
}
