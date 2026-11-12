export type CreateSpaceErrorCode =
  | 'unauthenticated'
  | 'invalid-argument'
  | 'permission-denied'
  | 'unavailable'
  | 'deadline-exceeded'
  | 'internal';

const UNCERTAIN_MESSAGE =
  '요청 결과를 확인하지 못했어요. 공간이 이미 만들어졌을 수 있으니 바로 다시 만들지 마세요.';

export const CREATE_SPACE_USER_MESSAGES: Record<CreateSpaceErrorCode, string> = {
  unauthenticated: '로그인이 필요해요.',
  'invalid-argument': '공간 이름과 유형을 다시 확인해 주세요.',
  'permission-denied': '정식 회원만 공간을 만들 수 있어요.',
  unavailable: UNCERTAIN_MESSAGE,
  'deadline-exceeded': UNCERTAIN_MESSAGE,
  internal: '공간을 만들지 못했어요. 잠시 후 다시 시도해 주세요.',
};

const KNOWN_CODES: readonly CreateSpaceErrorCode[] = [
  'unauthenticated',
  'invalid-argument',
  'permission-denied',
  'unavailable',
  'deadline-exceeded',
  'internal',
];

const UNCERTAIN_CODES = new Set<CreateSpaceErrorCode>(['unavailable', 'deadline-exceeded']);

export class CreateSpaceError extends Error {
  readonly code: CreateSpaceErrorCode;
  readonly uncertain: boolean;
  readonly userMessage: string;

  constructor(code: CreateSpaceErrorCode, uncertain = UNCERTAIN_CODES.has(code)) {
    const userMessage = CREATE_SPACE_USER_MESSAGES[code];
    super(userMessage);
    this.name = 'CreateSpaceError';
    this.code = code;
    this.uncertain = uncertain;
    this.userMessage = userMessage;
  }
}

export function parseCreateSpaceResult(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const spaceId = (data as { spaceId?: unknown }).spaceId;
  if (typeof spaceId !== 'string') return null;
  const trimmed = spaceId.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function functionsErrorCode(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('code' in error)) return null;
  const code = (error as { code: unknown }).code;
  if (typeof code !== 'string' || code.length === 0) return null;
  return code.replace(/^functions\//, '');
}

function isCreateSpaceErrorCode(code: string): code is CreateSpaceErrorCode {
  return (KNOWN_CODES as readonly string[]).includes(code);
}

export function toCreateSpaceError(error: unknown): CreateSpaceError {
  if (error instanceof CreateSpaceError) return error;
  const raw = functionsErrorCode(error);
  if (raw && isCreateSpaceErrorCode(raw)) {
    return new CreateSpaceError(raw);
  }
  return new CreateSpaceError('unavailable', true);
}
