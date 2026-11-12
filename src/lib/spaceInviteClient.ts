import type { SpaceTypeId } from './spaceTypes';

export const INVITE_CODE_LENGTH = 8;
export const INVITE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';

export type SpaceInviteErrorCode =
  | 'unauthenticated'
  | 'invalid-argument'
  | 'permission-denied'
  | 'not-found'
  | 'failed-precondition'
  | 'aborted'
  | 'resource-exhausted'
  | 'unavailable'
  | 'deadline-exceeded'
  | 'internal';

export type SpaceInvitePreviewReason = 'ok' | 'already-member' | 'full';

export type SpaceInvitePreview = {
  name: string;
  type?: SpaceTypeId;
  canJoin: boolean;
  reason: SpaceInvitePreviewReason;
};

export type SpaceInviteRecord = {
  code: string;
  expiresAt: Date;
};

const USER_MESSAGES: Record<SpaceInviteErrorCode, string> = {
  unauthenticated: '로그인이 필요해요.',
  'invalid-argument': '공간을 확인할 수 없어요.',
  'permission-denied': '공간 소유자만 초대 코드를 다룰 수 있어요.',
  'not-found': '유효한 초대 코드가 없어요.',
  'failed-precondition': '현재 이용할 수 없는 공간이에요.',
  aborted: '잠시 후 다시 시도해 주세요.',
  'resource-exhausted': '잠시 후 다시 시도해 주세요.',
  unavailable: '네트워크 연결을 확인한 뒤 다시 시도해 주세요.',
  'deadline-exceeded': '네트워크 연결을 확인한 뒤 다시 시도해 주세요.',
  internal: '초대 코드를 처리하지 못했어요. 잠시 후 다시 시도해 주세요.',
};

const JOIN_USER_MESSAGES: Record<SpaceInviteErrorCode, string> = {
  unauthenticated: '로그인이 필요해요.',
  'invalid-argument': '초대 코드 형식을 다시 확인해 주세요.',
  'permission-denied': '로그인이 필요해요.',
  'not-found': '유효한 초대 코드가 없어요.',
  'failed-precondition': '현재 이용할 수 없는 공간이에요.',
  aborted: '잠시 후 다시 시도해 주세요.',
  'resource-exhausted': '잠시 후 다시 시도해 주세요.',
  unavailable: '네트워크 연결을 확인한 뒤 다시 시도해 주세요.',
  'deadline-exceeded': '네트워크 연결을 확인한 뒤 다시 시도해 주세요.',
  internal: '초대 코드를 확인하지 못했어요. 잠시 후 다시 시도해 주세요.',
};

const JOIN_ALLOWED_SERVER_MESSAGES = new Set([
  '현재 이용할 수 없는 공간이에요.',
  '이 공간은 참여 인원이 가득 찼어요.',
  '초대 코드를 확인할 수 없어요.',
  '잠시 후 다시 시도해 주세요.',
]);

const KNOWN_CODES: readonly SpaceInviteErrorCode[] = [
  'unauthenticated',
  'invalid-argument',
  'permission-denied',
  'not-found',
  'failed-precondition',
  'aborted',
  'resource-exhausted',
  'unavailable',
  'deadline-exceeded',
  'internal',
];

export class SpaceInviteError extends Error {
  readonly code: SpaceInviteErrorCode;
  readonly userMessage: string;

  constructor(code: SpaceInviteErrorCode, userMessage = USER_MESSAGES[code]) {
    super(userMessage);
    this.name = 'SpaceInviteError';
    this.code = code;
    this.userMessage = userMessage;
  }
}

export function normalizeInviteCode(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw.trim().toUpperCase().replace(/[\s-]/g, '');
}

export function sanitizeInviteCodeInput(raw: string): string {
  const normalized = normalizeInviteCode(raw);
  let out = '';
  for (let i = 0; i < normalized.length && out.length < INVITE_CODE_LENGTH; i += 1) {
    if (INVITE_ALPHABET.includes(normalized[i])) out += normalized[i];
  }
  return out;
}

export function isInviteCode(raw: unknown): raw is string {
  const code = normalizeInviteCode(raw);
  if (code.length !== INVITE_CODE_LENGTH) return false;
  for (let i = 0; i < code.length; i += 1) {
    if (!INVITE_ALPHABET.includes(code[i])) return false;
  }
  return true;
}

export function parseExpiresAt(raw: unknown): Date | null {
  if (typeof raw !== 'string' || raw.trim().length === 0) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseSpaceInviteResult(data: unknown): SpaceInviteRecord | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as { code?: unknown; expiresAt?: unknown };
  if (!isInviteCode(record.code)) return null;
  const expiresAt = parseExpiresAt(record.expiresAt);
  if (!expiresAt) return null;
  return {
    code: normalizeInviteCode(record.code),
    expiresAt,
  };
}

export function parseRevokeResult(data: unknown): boolean {
  if (!data || typeof data !== 'object') return false;
  return (data as { revoked?: unknown }).revoked === true;
}

function isPreviewReason(value: unknown): value is SpaceInvitePreviewReason {
  return value === 'ok' || value === 'already-member' || value === 'full';
}

function isPreviewSpaceType(value: unknown): value is SpaceTypeId {
  return value === 'couple' || value === 'friends' || value === 'family' || value === 'travel';
}

export function parseSpaceInvitePreview(data: unknown): SpaceInvitePreview | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as {
    name?: unknown;
    type?: unknown;
    canJoin?: unknown;
    reason?: unknown;
  };
  if (typeof record.name !== 'string') return null;
  const name = record.name.trim();
  if (!name) return null;
  if (!isPreviewReason(record.reason)) return null;
  if (typeof record.canJoin !== 'boolean') return null;
  if (record.canJoin !== (record.reason === 'ok')) return null;
  return {
    name,
    type: isPreviewSpaceType(record.type) ? record.type : undefined,
    canJoin: record.canJoin,
    reason: record.reason,
  };
}

export function parseJoinSpaceResult(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const spaceId = (data as { spaceId?: unknown }).spaceId;
  if (typeof spaceId !== 'string') return null;
  const trimmed = spaceId.trim();
  if (!trimmed || trimmed.includes('/')) return null;
  return trimmed;
}

export function remainingMs(expiresAt: Date, now = Date.now()): number {
  return expiresAt.getTime() - now;
}

export function isInviteExpired(expiresAt: Date, now = Date.now()): boolean {
  return remainingMs(expiresAt, now) <= 0;
}

export function formatInviteCountdown(expiresAt: Date, now = Date.now()): string {
  const total = Math.max(0, Math.floor(remainingMs(expiresAt, now) / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function formatInviteExpiryLabel(expiresAt: Date): string {
  try {
    return new Intl.DateTimeFormat('ko-KR', {
      timeZone: 'Asia/Seoul',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(expiresAt);
  } catch {
    return expiresAt.toISOString();
  }
}

/** app.config.js scheme. 임의로 바꾸지 않는다. */
export const INVITE_URL_SCHEME = 'regretwallet';

export function buildInviteAppLink(code: string): string {
  const sanitized = sanitizeInviteCodeInput(code);
  if (!isInviteCode(sanitized)) return '';
  return `${INVITE_URL_SCHEME}://spaces/join?${JOIN_CODE_PARAM}=${encodeURIComponent(sanitized)}`;
}

export function buildInviteShareMessage(input: {
  code: string;
  expiresAt: Date;
  spaceName?: string;
}): string {
  const sanitized = normalizeInviteCode(input.code);
  const expiry = formatInviteExpiryLabel(input.expiresAt);
  const link = buildInviteAppLink(sanitized);
  const name = typeof input.spaceName === 'string' ? input.spaceName.trim() : '';
  const lines = [
    '후회가계부에서 함께할 공간에 초대했어요!',
    '',
  ];
  if (name) {
    lines.push(`공간: ${name}`, '');
  }
  if (link) {
    lines.push('초대 링크:', link, '');
  }
  lines.push(
    `초대 코드: ${sanitized}`,
    '',
    '앱이 설치되어 있다면 링크를 눌러 참여해 주세요.',
    '링크가 열리지 않으면 앱에서 초대 코드를 직접 입력할 수 있어요.',
    `유효기간: ${expiry}까지`,
  );
  return lines.join('\n');
}

function functionsErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('code' in error)) return null;
  const code = (error as { code: unknown }).code;
  if (typeof code !== 'string' || code.length === 0) return null;
  return code.replace(/^functions\//, '');
}

function isSpaceInviteErrorCode(code: string): code is SpaceInviteErrorCode {
  return (KNOWN_CODES as readonly string[]).includes(code);
}

export function toSpaceInviteError(error: unknown): SpaceInviteError {
  if (error instanceof SpaceInviteError) return error;
  const raw = functionsErrorCode(error);
  if (raw && isSpaceInviteErrorCode(raw)) {
    return new SpaceInviteError(raw);
  }
  return new SpaceInviteError('unavailable');
}

function errorMessage(error: unknown): string {
  if (!error || typeof error !== 'object' || !('message' in error)) return '';
  const message = (error as { message: unknown }).message;
  return typeof message === 'string' ? message.trim() : '';
}

export function toSpaceJoinError(
  error: unknown,
  action: 'preview' | 'join' = 'preview',
): SpaceInviteError {
  if (error instanceof SpaceInviteError) return error;
  const raw = functionsErrorCode(error);
  const serverMessage = errorMessage(error);
  const fallback = action === 'join'
    ? '공간에 참여하지 못했어요. 잠시 후 다시 시도해 주세요.'
    : JOIN_USER_MESSAGES.internal;
  if (JOIN_ALLOWED_SERVER_MESSAGES.has(serverMessage)) {
    const code = raw && isSpaceInviteErrorCode(raw) ? raw : 'internal';
    return new SpaceInviteError(code, serverMessage);
  }
  if (raw && isSpaceInviteErrorCode(raw)) {
    if (raw === 'internal') return new SpaceInviteError(raw, fallback);
    return new SpaceInviteError(raw, JOIN_USER_MESSAGES[raw]);
  }
  return new SpaceInviteError('unavailable', JOIN_USER_MESSAGES.unavailable);
}

export function isSpaceOwner(role: string | undefined, ownerUid: string | undefined, uid: string | null): boolean {
  if (!uid) return false;
  if (role === 'owner') return true;
  return typeof ownerUid === 'string' && ownerUid === uid;
}

export const JOIN_SPACE_PATH = '/spaces/join' as const;
export const JOIN_CODE_PARAM = 'code' as const;

export type JoinSpaceHref = {
  pathname: typeof JOIN_SPACE_PATH;
  params?: { code: string };
};

/** 라우트·쿼리에서 온 값을 입력란용으로만 정규화한다. 참여는 호출하지 않는다. */
export function inviteCodeFromRouteParam(raw: string | string[] | undefined): string {
  if (raw == null) return '';
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string') return '';
  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    decoded = value;
  }
  return sanitizeInviteCodeInput(decoded);
}

export function inviteCodeFromLink(url: string): string {
  if (typeof url !== 'string' || url.trim().length === 0) return '';
  try {
    const parsed = new URL(url.trim());
    const fromQuery = parsed.searchParams.get(JOIN_CODE_PARAM);
    if (fromQuery) return inviteCodeFromRouteParam(fromQuery);
  } catch {
    /* 커스텀 스킴 파싱 실패 시 쿼리만 추출 */
  }
  const match = /[?&]code=([^&]+)/i.exec(url);
  if (!match) return '';
  return inviteCodeFromRouteParam(match[1]);
}

export function buildJoinSpaceHref(code?: string): JoinSpaceHref {
  const sanitized = code ? sanitizeInviteCodeInput(code) : '';
  if (!sanitized) return { pathname: JOIN_SPACE_PATH };
  return { pathname: JOIN_SPACE_PATH, params: { [JOIN_CODE_PARAM]: sanitized } };
}

/**
 * 로그인 후 참여 화면 복귀용 프로세스 메모리.
 * AsyncStorage에는 쓰지 않는다. 다음 단계에서 AuthGate/로그인이 consume 한다.
 */
let pendingJoinCode: string | null = null;

export function stashJoinCodeForAuth(code: string): void {
  const sanitized = sanitizeInviteCodeInput(code);
  pendingJoinCode = sanitized.length > 0 ? sanitized : null;
}

export function consumeJoinCodeForAuth(): string | null {
  const value = pendingJoinCode;
  pendingJoinCode = null;
  return value;
}

export function hrefAfterAuth(): JoinSpaceHref | '/(tabs)' {
  const pending = consumeJoinCodeForAuth();
  if (pending && isInviteCode(pending)) return buildJoinSpaceHref(pending);
  return '/(tabs)';
}

export function isInviteJoinRoute(segments: string[]): boolean {
  if (segments[0] === 'invite') return true;
  return segments[0] === 'spaces' && segments[1] === 'join';
}
