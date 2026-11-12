export const DEFAULT_SPACE_MEMBER_DISPLAY_NAME = '이름 없음';
export const SPACE_MEMBER_NAME_MAX = 24;
export const LIST_SPACE_MEMBERS_FN = 'listSpaceMembers';

export type SpaceMemberRole = 'owner' | 'member';

export type SpaceMember = {
  uid: string;
  displayName: string;
  role: SpaceMemberRole;
  joinedAt: Date | null;
  photoURL?: string;
};

export type SpaceMembersErrorCode =
  | 'unauthenticated'
  | 'invalid-argument'
  | 'permission-denied'
  | 'not-found'
  | 'failed-precondition'
  | 'unavailable'
  | 'deadline-exceeded'
  | 'internal';

export type SpaceMembersErrorKind =
  | 'unauthenticated'
  | 'permission-denied'
  | 'not-found'
  | 'inactive'
  | 'unavailable'
  | 'invalid';

const USER_MESSAGES: Record<SpaceMembersErrorCode, string> = {
  unauthenticated: '로그인이 필요해요.',
  'invalid-argument': '공간을 확인할 수 없어요.',
  'permission-denied': '이 공간의 멤버만 목록을 볼 수 있어요.',
  'not-found': '공간을 찾을 수 없어요.',
  'failed-precondition': '현재 이용할 수 없는 공간이에요.',
  unavailable: '네트워크 연결을 확인한 뒤 다시 시도해 주세요.',
  'deadline-exceeded': '네트워크 연결을 확인한 뒤 다시 시도해 주세요.',
  internal: '멤버 목록을 불러오지 못했어요. 잠시 후 다시 시도해 주세요.',
};

const ALLOWED_SERVER_MESSAGES = new Set(Object.values(USER_MESSAGES));

const KNOWN_CODES: readonly SpaceMembersErrorCode[] = [
  'unauthenticated',
  'invalid-argument',
  'permission-denied',
  'not-found',
  'failed-precondition',
  'unavailable',
  'deadline-exceeded',
  'internal',
];

export class SpaceMembersError extends Error {
  readonly code: SpaceMembersErrorCode;
  readonly userMessage: string;

  constructor(code: SpaceMembersErrorCode, userMessage?: string) {
    const message = userMessage && ALLOWED_SERVER_MESSAGES.has(userMessage)
      ? userMessage
      : USER_MESSAGES[code];
    super(message);
    this.name = 'SpaceMembersError';
    this.code = code;
    this.userMessage = message;
  }
}

export function spaceMemberRoleLabel(role: unknown): string {
  return role === 'owner' ? '방장' : '멤버';
}

export function parseMemberRole(raw: unknown): SpaceMemberRole {
  return raw === 'owner' ? 'owner' : 'member';
}

function parseIsoDate(raw: unknown): Date | null {
  if (typeof raw !== 'string' || raw.trim().length === 0) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseDisplayName(raw: unknown): string {
  if (typeof raw !== 'string') return DEFAULT_SPACE_MEMBER_DISPLAY_NAME;
  const name = raw.trim().slice(0, SPACE_MEMBER_NAME_MAX);
  return name.length > 0 ? name : DEFAULT_SPACE_MEMBER_DISPLAY_NAME;
}

function parsePublicPhotoUrl(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined;
  const url = raw.trim();
  if (!/^https:\/\//i.test(url)) return undefined;
  if (/firebasestorage\.googleapis\.com/i.test(url)) return undefined;
  if (/storage\.googleapis\.com/i.test(url)) return undefined;
  return url;
}

export function parseSpaceMember(raw: unknown): SpaceMember | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  if (typeof row.uid !== 'string' || row.uid.trim().length === 0 || row.uid.includes('/')) {
    return null;
  }
  const member: SpaceMember = {
    uid: row.uid.trim(),
    displayName: parseDisplayName(row.displayName),
    role: parseMemberRole(row.role),
    joinedAt: parseIsoDate(row.joinedAt),
  };
  const photoURL = parsePublicPhotoUrl(row.profileImageUrl) ?? parsePublicPhotoUrl(row.photoURL);
  if (photoURL) member.photoURL = photoURL;
  return member;
}

export function compareSpaceMembers(a: SpaceMember, b: SpaceMember): number {
  const aOwner = a.role === 'owner' ? 0 : 1;
  const bOwner = b.role === 'owner' ? 0 : 1;
  if (aOwner !== bOwner) return aOwner - bOwner;
  const aTime = a.joinedAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
  const bTime = b.joinedAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
  if (aTime !== bTime) return aTime - bTime;
  if (a.uid < b.uid) return -1;
  if (a.uid > b.uid) return 1;
  return 0;
}

export function sortSpaceMembers(members: SpaceMember[]): SpaceMember[] {
  return [...members].sort(compareSpaceMembers);
}

export function parseSpaceMembersResult(data: unknown): SpaceMember[] | null {
  if (!data || typeof data !== 'object') return null;
  const members = (data as { members?: unknown }).members;
  if (!Array.isArray(members)) return null;
  const parsed: SpaceMember[] = [];
  const seen = new Set<string>();
  for (const row of members) {
    const member = parseSpaceMember(row);
    if (!member || seen.has(member.uid)) continue;
    seen.add(member.uid);
    parsed.push(member);
  }
  return sortSpaceMembers(parsed);
}

export function classifySpaceMembersError(error: unknown): SpaceMembersErrorKind {
  const mapped = error instanceof SpaceMembersError ? error : toSpaceMembersError(error);
  if (mapped.code === 'unauthenticated') return 'unauthenticated';
  if (mapped.code === 'permission-denied') return 'permission-denied';
  if (mapped.code === 'not-found') return 'not-found';
  if (mapped.code === 'failed-precondition') return 'inactive';
  if (mapped.code === 'invalid-argument') return 'invalid';
  return 'unavailable';
}

export function spaceMembersErrorMessage(kind: SpaceMembersErrorKind): string {
  if (kind === 'unauthenticated') return USER_MESSAGES.unauthenticated;
  if (kind === 'permission-denied') return USER_MESSAGES['permission-denied'];
  if (kind === 'not-found') return USER_MESSAGES['not-found'];
  if (kind === 'inactive') return USER_MESSAGES['failed-precondition'];
  if (kind === 'invalid') return USER_MESSAGES['invalid-argument'];
  return USER_MESSAGES.unavailable;
}

export function membersCountLabel(count: number | null): string | null {
  if (count == null || !Number.isFinite(count) || count < 0) return null;
  return `${count}명`;
}

export function shouldShowMembersSpinner(
  status: 'loading' | 'ready' | 'error',
  refreshing: boolean,
): boolean {
  return status === 'loading' && !refreshing;
}

function functionsErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('code' in error)) return null;
  const code = (error as { code: unknown }).code;
  if (typeof code !== 'string' || code.length === 0) return null;
  return code.replace(/^functions\//, '');
}

function errorMessage(error: unknown): string {
  if (!error || typeof error !== 'object' || !('message' in error)) return '';
  const message = (error as { message: unknown }).message;
  return typeof message === 'string' ? message.trim() : '';
}

function isSpaceMembersErrorCode(code: string): code is SpaceMembersErrorCode {
  return (KNOWN_CODES as readonly string[]).includes(code);
}

export function toSpaceMembersError(error: unknown): SpaceMembersError {
  if (error instanceof SpaceMembersError) return error;
  const raw = functionsErrorCode(error);
  const serverMessage = errorMessage(error);
  if (raw && isSpaceMembersErrorCode(raw)) {
    if (ALLOWED_SERVER_MESSAGES.has(serverMessage)) {
      return new SpaceMembersError(raw, serverMessage);
    }
    return new SpaceMembersError(raw);
  }
  return new SpaceMembersError('unavailable');
}

export function memberInitial(displayName: string): string {
  const trimmed = displayName.trim();
  if (!trimmed || trimmed === DEFAULT_SPACE_MEMBER_DISPLAY_NAME) return '?';
  return trimmed[0]?.toUpperCase() ?? '?';
}
