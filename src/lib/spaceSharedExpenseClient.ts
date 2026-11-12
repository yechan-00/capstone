export const CREATE_SPACE_SHARED_EXPENSE_FN = 'createSpaceSharedExpense';
export const UPDATE_SPACE_SHARED_EXPENSE_FN = 'updateSpaceSharedExpense';

export const DELETE_SHARED_EXPENSE_CONFIRM_TITLE = '공동 소비를 삭제할까요?';
export const DELETE_SHARED_EXPENSE_CONFIRM_LABEL = '삭제';
export const DELETE_SHARED_EXPENSE_CONFIRM_MESSAGE =
  '이 공동 소비만 공간에서 사라져요. 개인 가계부 기록은 그대로 남아요.';

export const SHARE_TO_SPACE_CONFIRM_TITLE = '공유 공간에 복사할까요?';
export const SHARE_TO_SPACE_CONFIRM_LABEL = '공유';
export const SHARE_TO_SPACE_CONFIRM_MESSAGE =
  '선택한 정보만 공간에 복사돼요. 개인 소비는 그대로 남고, 이후 수정·삭제는 서로 반영되지 않아요.';

export type SpaceSharedExpenseErrorCode =
  | 'unauthenticated'
  | 'invalid-argument'
  | 'permission-denied'
  | 'not-found'
  | 'failed-precondition'
  | 'unavailable'
  | 'deadline-exceeded';

export type SpaceSharedExpenseErrorKind =
  | 'unauthenticated'
  | 'permission-denied'
  | 'not-found'
  | 'inactive'
  | 'unavailable'
  | 'invalid';

const USER_MESSAGES: Record<SpaceSharedExpenseErrorCode, string> = {
  unauthenticated: '로그인이 필요해요.',
  'invalid-argument': '공동 소비 내용을 다시 확인해 주세요.',
  'permission-denied': '이 공간의 멤버만 공동 소비를 볼 수 있어요.',
  'not-found': '공동 소비를 찾을 수 없어요.',
  'failed-precondition': '현재 이용할 수 없는 공간이에요.',
  unavailable: '네트워크 연결을 확인한 뒤 다시 시도해 주세요.',
  'deadline-exceeded': '네트워크 연결을 확인한 뒤 다시 시도해 주세요.',
};

const WRITE_DENIED = '작성한 멤버만 수정하거나 삭제할 수 있어요.';
const SHARE_DENIED = '내 소비만 공유 공간에 복사할 수 있어요.';
export const OPEN_SETTLEMENT_DENIED =
  '진행 중인 정산이 있어 금액·결제자·참여자를 바꿀 수 없어요. 정산을 먼저 취소해 주세요.';
export const OPEN_SETTLEMENT_DELETE_MESSAGE =
  '진행 중인 정산이 있어 공동 소비를 삭제할 수 없어요. 정산을 먼저 취소해 주세요.';

const KNOWN_CODES: readonly SpaceSharedExpenseErrorCode[] = [
  'unauthenticated',
  'invalid-argument',
  'permission-denied',
  'not-found',
  'failed-precondition',
  'unavailable',
  'deadline-exceeded',
];

export class SpaceSharedExpenseError extends Error {
  readonly code: SpaceSharedExpenseErrorCode;
  readonly userMessage: string;

  constructor(code: SpaceSharedExpenseErrorCode, userMessage?: string) {
    const message = userMessage ?? USER_MESSAGES[code];
    super(message);
    this.name = 'SpaceSharedExpenseError';
    this.code = code;
    this.userMessage = message;
  }
}

export function spaceSharedExpenseErrorMessage(kind: SpaceSharedExpenseErrorKind): string {
  if (kind === 'unauthenticated') return USER_MESSAGES.unauthenticated;
  if (kind === 'permission-denied') return USER_MESSAGES['permission-denied'];
  if (kind === 'not-found') return USER_MESSAGES['not-found'];
  if (kind === 'inactive') return USER_MESSAGES['failed-precondition'];
  if (kind === 'invalid') return USER_MESSAGES['invalid-argument'];
  return USER_MESSAGES.unavailable;
}

export function canMutateSpaceSharedExpense(
  createdByUid: string | undefined,
  viewerUid: string | null,
): boolean {
  return Boolean(createdByUid && viewerUid && createdByUid === viewerUid);
}

export function createSharedExpenseWriteGate() {
  let busy = false;
  return {
    get busy() {
      return busy;
    },
    tryStart() {
      if (busy) return false;
      busy = true;
      return true;
    },
    end() {
      busy = false;
    },
  };
}

function firestoreErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object' || !('code' in error)) return '';
  const code = (error as { code: unknown }).code;
  if (typeof code !== 'string') return '';
  return code.replace(/^firestore\//, '').replace(/^functions\//, '');
}

function koreanServerMessage(error: unknown): string | null {
  if (!error || typeof error !== 'object' || !('message' in error)) return null;
  const message = (error as { message: unknown }).message;
  if (typeof message !== 'string') return null;
  const cleaned = message
    .replace(/^Firebase:\s*/i, '')
    .replace(/\s*\([^)]*\)\s*$/, '')
    .trim();
  if (!cleaned || !/[가-힣]/.test(cleaned)) return null;
  return cleaned;
}

function isSpaceSharedExpenseErrorCode(code: string): code is SpaceSharedExpenseErrorCode {
  return (KNOWN_CODES as readonly string[]).includes(code);
}

export function toSpaceSharedExpenseError(
  error: unknown,
  action: 'read' | 'write' | 'share' = 'read',
): SpaceSharedExpenseError {
  if (error instanceof SpaceSharedExpenseError) return error;
  const code = firestoreErrorCode(error);
  if (code && isSpaceSharedExpenseErrorCode(code)) {
    if (code === 'permission-denied' && action === 'write') {
      return new SpaceSharedExpenseError(code, WRITE_DENIED);
    }
    if (code === 'permission-denied' && action === 'share') {
      return new SpaceSharedExpenseError(code, SHARE_DENIED);
    }
    if ((code === 'failed-precondition' || code === 'invalid-argument') && koreanServerMessage(error)) {
      return new SpaceSharedExpenseError(code, koreanServerMessage(error) ?? USER_MESSAGES[code]);
    }
    return new SpaceSharedExpenseError(code);
  }
  return new SpaceSharedExpenseError('unavailable');
}

export function classifySpaceSharedExpenseError(error: unknown): SpaceSharedExpenseErrorKind {
  const mapped = toSpaceSharedExpenseError(error);
  if (mapped.code === 'unauthenticated') return 'unauthenticated';
  if (mapped.code === 'permission-denied') return 'permission-denied';
  if (mapped.code === 'not-found') return 'not-found';
  if (mapped.code === 'failed-precondition') return 'inactive';
  if (mapped.code === 'invalid-argument') return 'invalid';
  return 'unavailable';
}

export function parseCreateSharedExpenseResult(
  data: unknown,
): { spaceId: string; sharedExpenseId: string } | null {
  if (!data || typeof data !== 'object') return null;
  const row = data as Record<string, unknown>;
  if (typeof row.spaceId !== 'string' || row.spaceId.includes('/')) return null;
  if (typeof row.sharedExpenseId !== 'string' || row.sharedExpenseId.includes('/')) return null;
  if (!row.spaceId || !row.sharedExpenseId) return null;
  return { spaceId: row.spaceId, sharedExpenseId: row.sharedExpenseId };
}

export function parseUpdateSharedExpenseResult(data: unknown): { sharedExpenseId: string } | null {
  if (!data || typeof data !== 'object') return null;
  const row = data as Record<string, unknown>;
  if (typeof row.sharedExpenseId !== 'string' || !row.sharedExpenseId || row.sharedExpenseId.includes('/')) {
    return null;
  }
  return { sharedExpenseId: row.sharedExpenseId };
}
