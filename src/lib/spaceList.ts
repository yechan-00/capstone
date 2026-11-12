import { Timestamp } from 'firebase/firestore';
import { isSpaceTypeId, type SpaceListItem, type SpaceTypeId } from '@/lib/spaceTypes';

export const SPACES_COLLECTION = 'spaces';
export const SPACE_MEMBERS_COLLECTION = 'space_members';

export type SpaceMembershipRow = {
  spaceId: string;
  role?: string;
};

export function spaceIdFromMemberPath(path: string): string | null {
  const segments = path.split('/').filter(Boolean);
  if (
    segments.length !== 4 ||
    segments[0] !== SPACES_COLLECTION ||
    segments[2] !== SPACE_MEMBERS_COLLECTION
  ) {
    return null;
  }
  const spaceId = segments[1];
  return spaceId.length > 0 ? spaceId : null;
}

export function parseMembershipRole(raw: unknown): string | undefined {
  return typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : undefined;
}

export function timestampToDateOrNull(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'object' && 'toDate' in value && typeof (value as Timestamp).toDate === 'function') {
    try {
      const date = (value as Timestamp).toDate();
      return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
    } catch {
      return null;
    }
  }
  return null;
}

export type SpaceDetailRecord = {
  id: string;
  name: string;
  type?: SpaceTypeId;
  status?: string;
  ownerUid?: string;
  maxMembers?: number;
  createdAt?: Date;
  updatedAt?: Date;
};

export type SpaceDetailErrorKind =
  | 'unauthenticated'
  | 'permission-denied'
  | 'not-found'
  | 'inactive'
  | 'unavailable';

export function parseSpaceDetail(
  spaceId: string,
  data: Record<string, unknown> | undefined,
): SpaceDetailRecord | null {
  if (!spaceId || !data) return null;
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  if (!name) return null;
  return {
    id: spaceId,
    name,
    type: isSpaceTypeId(data.type) ? data.type : undefined,
    status: typeof data.status === 'string' ? data.status : undefined,
    ownerUid: typeof data.ownerUid === 'string' ? data.ownerUid : undefined,
    maxMembers: typeof data.maxMembers === 'number' ? data.maxMembers : undefined,
    createdAt: timestampToDateOrNull(data.createdAt) ?? undefined,
    updatedAt: timestampToDateOrNull(data.updatedAt) ?? undefined,
  };
}

export function parseSpaceListItem(
  spaceId: string,
  data: Record<string, unknown> | undefined,
  role?: string,
): SpaceListItem | null {
  if (!spaceId || !data) return null;
  const name = typeof data.name === 'string' ? data.name.trim() : '';
  if (!name) return null;
  const createdAt = timestampToDateOrNull(data.createdAt) ?? undefined;
  return {
    id: spaceId,
    name,
    type: isSpaceTypeId(data.type) ? data.type : undefined,
    role,
    createdAt,
  };
}

export function sortSpaceListItems(spaces: SpaceListItem[]): SpaceListItem[] {
  return [...spaces].sort((a, b) => {
    const aTime = a.createdAt?.getTime() ?? 0;
    const bTime = b.createdAt?.getTime() ?? 0;
    if (aTime !== bTime) return bTime - aTime;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

export function uniqueMemberships(rows: SpaceMembershipRow[]): SpaceMembershipRow[] {
  const byId = new Map<string, SpaceMembershipRow>();
  for (const row of rows) {
    if (!row.spaceId || byId.has(row.spaceId)) continue;
    byId.set(row.spaceId, row);
  }
  return [...byId.values()];
}

function firestoreErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object' || !('code' in error)) return '';
  const code = (error as { code: unknown }).code;
  if (typeof code !== 'string') return '';
  return code.replace(/^firestore\//, '');
}

export function isPermissionDeniedError(error: unknown): boolean {
  const code = firestoreErrorCode(error);
  return code === 'permission-denied' || code === 'unauthenticated';
}

export function toSpaceListErrorMessage(error: unknown): string {
  const code = firestoreErrorCode(error);
  if (code === 'unauthenticated') return '로그인이 필요해요.';
  if (code === 'permission-denied') return '이 목록을 볼 권한이 없어요.';
  if (code === 'failed-precondition') return '공간을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.';
  if (code === 'unavailable' || code === 'deadline-exceeded') {
    return '네트워크 연결을 확인해 주세요.';
  }
  return '공간을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.';
}

export function classifySpaceDetailError(error: unknown): SpaceDetailErrorKind {
  const code = firestoreErrorCode(error);
  if (code === 'unauthenticated') return 'unauthenticated';
  if (code === 'permission-denied') return 'permission-denied';
  if (code === 'not-found') return 'not-found';
  return 'unavailable';
}

export function spaceDetailErrorMessage(kind: SpaceDetailErrorKind): string {
  if (kind === 'unauthenticated') return '로그인이 필요해요.';
  if (kind === 'permission-denied') return '이 공간에 접근할 권한이 없어요.';
  if (kind === 'not-found') return '공간을 찾을 수 없어요.';
  if (kind === 'inactive') return '현재 이용할 수 없는 공간이에요.';
  return '공간 정보를 불러오지 못했어요.';
}
