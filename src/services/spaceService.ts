import {
  collectionGroup,
  doc,
  getDoc,
  onSnapshot,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import {
  CreateSpaceError,
  parseCreateSpaceResult,
  toCreateSpaceError,
} from '@/lib/createSpaceClient';
import { db, functions } from '@/lib/firebase';
import {
  SPACE_MEMBERS_COLLECTION,
  SPACES_COLLECTION,
  classifySpaceDetailError,
  isPermissionDeniedError,
  parseMembershipRole,
  parseSpaceDetail,
  parseSpaceListItem,
  sortSpaceListItems,
  spaceIdFromMemberPath,
  uniqueMemberships,
  type SpaceDetailErrorKind,
  type SpaceDetailRecord,
  type SpaceMembershipRow,
} from '@/lib/spaceList';
import {
  isSpaceTypeId,
  isValidSpaceName,
  parseClientSpaceName,
  type SpaceListItem,
  type SpaceTypeId,
} from '@/lib/spaceTypes';

const SPACE_FETCH_CONCURRENCY = 8;

export type CreateSpaceInput = {
  name: string;
  type: SpaceTypeId;
};

export type CreateSpaceResult = {
  spaceId: string;
};

export { CreateSpaceError };

export async function createSpace(input: CreateSpaceInput): Promise<CreateSpaceResult> {
  const name = parseClientSpaceName(input.name);
  if (!isValidSpaceName(name)) {
    throw new CreateSpaceError('invalid-argument');
  }
  if (!isSpaceTypeId(input.type)) {
    throw new CreateSpaceError('invalid-argument');
  }

  try {
    const call = httpsCallable<{ name: string; type: SpaceTypeId }, unknown>(
      functions,
      'createSpace',
    );
    const result = await call({ name, type: input.type });
    const spaceId = parseCreateSpaceResult(result.data);
    if (!spaceId) {
      throw new CreateSpaceError('unavailable', true);
    }
    return { spaceId };
  } catch (error) {
    if (__DEV__) {
      console.error('[createSpace]', error);
    }
    throw toCreateSpaceError(error);
  }
}

export function subscribeMySpaceMemberships(
  uid: string,
  onNext: (rows: SpaceMembershipRow[]) => void,
  onError: (error: unknown) => void,
): Unsubscribe {
  const membershipQuery = query(
    collectionGroup(db, SPACE_MEMBERS_COLLECTION),
    where('uid', '==', uid),
  );

  return onSnapshot(
    membershipQuery,
    (snapshot) => {
      const rows: SpaceMembershipRow[] = [];
      for (const memberDoc of snapshot.docs) {
        const data = memberDoc.data();
        if (data.uid !== uid) continue;
        const spaceId = spaceIdFromMemberPath(memberDoc.ref.path);
        if (!spaceId) continue;
        rows.push({
          spaceId,
          role: parseMembershipRole(data.role),
        });
      }
      onNext(uniqueMemberships(rows));
    },
    onError,
  );
}

async function mapInBatches<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  const out: R[] = [];
  for (let i = 0; i < items.length; i += limit) {
    const batch = items.slice(i, i + limit);
    out.push(...(await Promise.all(batch.map(mapper))));
  }
  return out;
}

export type LoadMySpacesResult =
  | { status: 'ok'; spaces: SpaceListItem[] }
  | { status: 'error'; error: unknown };

export async function loadSpacesForMemberships(
  rows: SpaceMembershipRow[],
): Promise<LoadMySpacesResult> {
  const unique = uniqueMemberships(rows);
  if (unique.length === 0) {
    return { status: 'ok', spaces: [] };
  }

  let permissionDenied = false;
  let hardFailure: unknown = null;

  const fetched = await mapInBatches(unique, SPACE_FETCH_CONCURRENCY, async (row) => {
    try {
      const snap = await getDoc(doc(db, SPACES_COLLECTION, row.spaceId));
      if (!snap.exists()) return null;
      return parseSpaceListItem(snap.id, snap.data() as Record<string, unknown>, row.role);
    } catch (error) {
      if (isPermissionDeniedError(error)) {
        permissionDenied = true;
        return null;
      }
      hardFailure = error;
      return null;
    }
  });

  const spaces = sortSpaceListItems(fetched.filter((item): item is SpaceListItem => item != null));

  if (spaces.length > 0) {
    return { status: 'ok', spaces };
  }
  if (permissionDenied || hardFailure) {
    return { status: 'error', error: hardFailure ?? { code: 'permission-denied' } };
  }
  return { status: 'ok', spaces: [] };
}

export type SpaceDetailSnapshot = {
  space: SpaceDetailRecord;
  role: string | undefined;
};

export function subscribeSpaceDetail(
  spaceId: string,
  uid: string,
  onNext: (payload: SpaceDetailSnapshot) => void,
  onError: (kind: SpaceDetailErrorKind, error?: unknown) => void,
): Unsubscribe {
  const spaceRef = doc(db, SPACES_COLLECTION, spaceId);
  const memberRef = doc(db, SPACES_COLLECTION, spaceId, SPACE_MEMBERS_COLLECTION, uid);

  let cancelled = false;
  let spaceSnap: { exists: boolean; id: string; data: Record<string, unknown> | undefined } | null = null;
  let memberSnap: { exists: boolean; id: string; data: Record<string, unknown> | undefined } | null = null;
  let spaceError: unknown = null;
  let memberError: unknown = null;
  let spaceReady = false;
  let memberReady = false;

  const emit = () => {
    if (cancelled || !spaceReady || !memberReady) return;

    if (memberError) {
      onError(classifySpaceDetailError(memberError), memberError);
      return;
    }
    if (!memberSnap?.exists) {
      onError('permission-denied');
      return;
    }
    const memberUid = memberSnap.data?.uid;
    if (typeof memberUid === 'string' && memberUid !== uid) {
      onError('permission-denied');
      return;
    }

    if (spaceError) {
      onError(classifySpaceDetailError(spaceError), spaceError);
      return;
    }
    if (!spaceSnap?.exists) {
      onError('not-found');
      return;
    }
    const parsed = parseSpaceDetail(spaceSnap.id, spaceSnap.data);
    if (!parsed) {
      onError('not-found');
      return;
    }
    if (parsed.status !== 'active') {
      onError('inactive');
      return;
    }
    onNext({
      space: parsed,
      role: parseMembershipRole(memberSnap.data?.role),
    });
  };

  const unsubSpace = onSnapshot(
    spaceRef,
    (snap) => {
      spaceError = null;
      spaceReady = true;
      spaceSnap = {
        exists: snap.exists(),
        id: snap.id,
        data: snap.exists() ? (snap.data() as Record<string, unknown>) : undefined,
      };
      emit();
    },
    (error) => {
      spaceError = error;
      spaceReady = true;
      emit();
    },
  );

  const unsubMember = onSnapshot(
    memberRef,
    (snap) => {
      memberError = null;
      memberReady = true;
      memberSnap = {
        exists: snap.exists(),
        id: snap.id,
        data: snap.exists() ? (snap.data() as Record<string, unknown>) : undefined,
      };
      emit();
    },
    (error) => {
      memberError = error;
      memberReady = true;
      emit();
    },
  );

  return () => {
    cancelled = true;
    unsubSpace();
    unsubMember();
  };
}
