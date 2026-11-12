export const DELETE_EVENT_CONFIRM_TITLE = '일정을 삭제할까요?';
export const DELETE_EVENT_CONFIRM_LABEL = '삭제';
export const DELETE_EVENT_CONFIRM_MESSAGE = '이 일정은 공간에서 사라지며, 되돌릴 수 없어요.';

export type SpaceEventErrorCode =
  | 'unauthenticated'
  | 'invalid-argument'
  | 'permission-denied'
  | 'not-found'
  | 'unavailable'
  | 'deadline-exceeded';

export type SpaceEventErrorKind =
  | 'unauthenticated'
  | 'permission-denied'
  | 'not-found'
  | 'unavailable'
  | 'invalid';

const USER_MESSAGES: Record<SpaceEventErrorCode, string> = {
  unauthenticated: '로그인이 필요해요.',
  'invalid-argument': '일정 내용을 다시 확인해 주세요.',
  'permission-denied': '이 공간의 멤버만 일정을 볼 수 있어요.',
  'not-found': '일정을 찾을 수 없어요.',
  unavailable: '네트워크 연결을 확인한 뒤 다시 시도해 주세요.',
  'deadline-exceeded': '네트워크 연결을 확인한 뒤 다시 시도해 주세요.',
};

const WRITE_DENIED = '이 일정을 수정하거나 삭제할 수 없어요.';

const KNOWN_CODES: readonly SpaceEventErrorCode[] = [
  'unauthenticated',
  'invalid-argument',
  'permission-denied',
  'not-found',
  'unavailable',
  'deadline-exceeded',
];

export class SpaceEventError extends Error {
  readonly code: SpaceEventErrorCode;
  readonly userMessage: string;

  constructor(code: SpaceEventErrorCode, userMessage?: string) {
    const message = userMessage ?? USER_MESSAGES[code];
    super(message);
    this.name = 'SpaceEventError';
    this.code = code;
    this.userMessage = message;
  }
}

export function spaceEventErrorMessage(kind: SpaceEventErrorKind): string {
  if (kind === 'unauthenticated') return USER_MESSAGES.unauthenticated;
  if (kind === 'permission-denied') return USER_MESSAGES['permission-denied'];
  if (kind === 'not-found') return USER_MESSAGES['not-found'];
  if (kind === 'invalid') return USER_MESSAGES['invalid-argument'];
  return USER_MESSAGES.unavailable;
}

export function canMutateSpaceEvent(createdByUid: string | undefined, viewerUid: string | null): boolean {
  return Boolean(createdByUid && viewerUid && createdByUid === viewerUid);
}

export function createEventWriteGate() {
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

function isSpaceEventErrorCode(code: string): code is SpaceEventErrorCode {
  return (KNOWN_CODES as readonly string[]).includes(code);
}

export function toSpaceEventError(error: unknown, action: 'read' | 'write' = 'read'): SpaceEventError {
  if (error instanceof SpaceEventError) return error;
  const code = firestoreErrorCode(error);
  if (code && isSpaceEventErrorCode(code)) {
    if (code === 'permission-denied' && action === 'write') {
      return new SpaceEventError(code, WRITE_DENIED);
    }
    return new SpaceEventError(code);
  }
  return new SpaceEventError('unavailable');
}

export function classifySpaceEventError(error: unknown): SpaceEventErrorKind {
  const mapped = toSpaceEventError(error);
  if (mapped.code === 'unauthenticated') return 'unauthenticated';
  if (mapped.code === 'permission-denied') return 'permission-denied';
  if (mapped.code === 'not-found') return 'not-found';
  if (mapped.code === 'invalid-argument') return 'invalid';
  return 'unavailable';
}
