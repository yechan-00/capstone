export const CREATE_SPACE_SETTLEMENT_FN = 'createSpaceSettlement';
export const UPDATE_SPACE_SETTLEMENT_FN = 'updateSpaceSettlement';
export const CANCEL_SPACE_SETTLEMENT_FN = 'cancelSpaceSettlement';
export const SET_SPACE_SETTLEMENT_TRANSFER_STATUS_FN = 'setSpaceSettlementTransferStatus';

export const CANCEL_SETTLEMENT_CONFIRM_TITLE = '정산을 취소할까요?';
export const CANCEL_SETTLEMENT_CONFIRM_LABEL = '취소하기';
export const CANCEL_SETTLEMENT_CONFIRM_MESSAGE =
  '정산 기록은 남아 있고, 같은 공동 소비로 다시 정산할 수 있어요. 완료로 표시한 송금은 실제 이체를 확인하지 않아요.';

export const COMPLETE_TRANSFER_CONFIRM_TITLE = '정산 완료로 표시할까요?';
export const COMPLETE_TRANSFER_CONFIRM_LABEL = '완료';
export const COMPLETE_TRANSFER_CONFIRM_MESSAGE =
  '실제 송금 여부는 확인하지 않아요. 송금한 사람 또는 받은 사람이 직접 표시해요.';

export const COMPLETE_LAST_TRANSFER_CONFIRM_TITLE = '마지막 정산을 완료할까요?';
export const COMPLETE_LAST_TRANSFER_CONFIRM_LABEL = '모두 완료';
export const COMPLETE_LAST_TRANSFER_CONFIRM_MESSAGE =
  '이 표시로 정산이 모두 끝나요. 실제 송금 여부는 앱에서 확인하지 않아요.';

export const UNCOMPLETE_TRANSFER_CONFIRM_TITLE = '미정산으로 되돌릴까요?';
export const UNCOMPLETE_TRANSFER_CONFIRM_LABEL = '되돌리기';
export const UNCOMPLETE_TRANSFER_CONFIRM_MESSAGE =
  '아직 정산이 모두 끝나지 않은 경우에만 되돌릴 수 있어요.';

export const CREATE_SETTLEMENT_CONFIRM_TITLE = '이 내용으로 정산할까요?';
export const CREATE_SETTLEMENT_CONFIRM_LABEL = '정산 만들기';
export const CREATE_SETTLEMENT_CONFIRM_MESSAGE =
  '금액과 참여자는 지금 공동 소비 기준으로 저장돼요. 진행 중에는 금액·결제자·참여자를 바꿀 수 없어요.';

export type SpaceSettlementErrorCode =
  | 'unauthenticated'
  | 'invalid-argument'
  | 'permission-denied'
  | 'not-found'
  | 'already-exists'
  | 'failed-precondition'
  | 'unavailable'
  | 'deadline-exceeded';

export type SpaceSettlementErrorKind =
  | 'unauthenticated'
  | 'permission-denied'
  | 'not-found'
  | 'inactive'
  | 'conflict'
  | 'unavailable'
  | 'invalid';

const USER_MESSAGES: Record<SpaceSettlementErrorCode, string> = {
  unauthenticated: '로그인이 필요해요.',
  'invalid-argument': '정산 내용을 다시 확인해 주세요.',
  'permission-denied': '이 공간의 멤버만 정산을 볼 수 있어요.',
  'not-found': '정산을 찾을 수 없어요.',
  'already-exists': '이미 이 소비에 대한 정산이 있어요.',
  'failed-precondition': '현재 이 정산을 바꿀 수 없어요.',
  unavailable: '네트워크 연결을 확인한 뒤 다시 시도해 주세요.',
  'deadline-exceeded': '네트워크 연결을 확인한 뒤 다시 시도해 주세요.',
};

const WRITE_DENIED = '정산을 만든 멤버만 수정하거나 취소할 수 있어요.';
const CREATE_DENIED = '공동 소비를 작성한 멤버만 정산을 시작할 수 있어요.';
const COMPLETE_DENIED = '송금할 사람 또는 받을 사람만 완료 처리할 수 있어요.';

const KNOWN_CODES: readonly SpaceSettlementErrorCode[] = [
  'unauthenticated',
  'invalid-argument',
  'permission-denied',
  'not-found',
  'already-exists',
  'failed-precondition',
  'unavailable',
  'deadline-exceeded',
];

export class SpaceSettlementError extends Error {
  readonly code: SpaceSettlementErrorCode;
  readonly userMessage: string;

  constructor(code: SpaceSettlementErrorCode, userMessage?: string) {
    const message = userMessage ?? USER_MESSAGES[code];
    super(message);
    this.name = 'SpaceSettlementError';
    this.code = code;
    this.userMessage = message;
  }
}

export function spaceSettlementErrorMessage(kind: SpaceSettlementErrorKind): string {
  if (kind === 'unauthenticated') return USER_MESSAGES.unauthenticated;
  if (kind === 'permission-denied') return USER_MESSAGES['permission-denied'];
  if (kind === 'not-found') return USER_MESSAGES['not-found'];
  if (kind === 'inactive') return USER_MESSAGES['failed-precondition'];
  if (kind === 'conflict') return USER_MESSAGES['already-exists'];
  if (kind === 'invalid') return USER_MESSAGES['invalid-argument'];
  return USER_MESSAGES.unavailable;
}

/** 목록/상세 ErrorRetryCard용 — 제목·설명이 같은 문구로 겹치지 않게 한다. */
export function spaceSettlementErrorCardCopy(kind: SpaceSettlementErrorKind | null): {
  title: string;
  desc: string;
} {
  if (kind === 'unauthenticated') {
    return { title: USER_MESSAGES.unauthenticated, desc: '로그인 후 다시 시도해 주세요.' };
  }
  if (kind === 'permission-denied') {
    return {
      title: '정산을 볼 수 없어요',
      desc: '이 공간의 멤버만 정산을 볼 수 있어요. 공간에서 나가거나 권한이 바뀌었을 수 있어요.',
    };
  }
  if (kind === 'not-found') {
    return {
      title: USER_MESSAGES['not-found'],
      desc: '주소가 바뀌었거나 정산이 삭제됐을 수 있어요.',
    };
  }
  if (kind === 'inactive') {
    return {
      title: '지금은 정산을 열 수 없어요',
      desc: '공간이 이용 중지 상태이거나 정산을 열 조건이 맞지 않아요.',
    };
  }
  if (kind === 'invalid') {
    return {
      title: USER_MESSAGES['invalid-argument'],
      desc: '입력한 내용을 확인한 뒤 다시 시도해 주세요.',
    };
  }
  return {
    title: '정산을 불러오지 못했어요',
    desc: '네트워크 상태를 확인하거나 잠시 후 다시 시도해 주세요.',
  };
}

export function logSpaceSettlementError(scope: string, error: unknown): void {
  if (!__DEV__) return;
  const mapped = toSpaceSettlementError(error);
  const raw = firestoreErrorCode(error) || '(none)';
  console.error(`[${scope}]`, mapped.code, raw);
}

export function createSettlementWriteGate() {
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

function isSpaceSettlementErrorCode(code: string): code is SpaceSettlementErrorCode {
  return (KNOWN_CODES as readonly string[]).includes(code);
}

export function toSpaceSettlementError(
  error: unknown,
  action: 'read' | 'write' | 'create' | 'complete' = 'read',
): SpaceSettlementError {
  if (error instanceof SpaceSettlementError) return error;
  const code = firestoreErrorCode(error);
  const serverMessage = koreanServerMessage(error);
  if (code && isSpaceSettlementErrorCode(code)) {
    if (code === 'permission-denied' && action === 'write') {
      return new SpaceSettlementError(code, WRITE_DENIED);
    }
    if (code === 'permission-denied' && action === 'create') {
      return new SpaceSettlementError(code, CREATE_DENIED);
    }
    if (code === 'permission-denied' && action === 'complete') {
      return new SpaceSettlementError(code, COMPLETE_DENIED);
    }
    if ((code === 'failed-precondition' || code === 'invalid-argument' || code === 'already-exists') && serverMessage) {
      return new SpaceSettlementError(code, serverMessage);
    }
    return new SpaceSettlementError(code);
  }
  return new SpaceSettlementError('unavailable');
}

export function classifySpaceSettlementError(error: unknown): SpaceSettlementErrorKind {
  const mapped = toSpaceSettlementError(error);
  if (mapped.code === 'unauthenticated') return 'unauthenticated';
  if (mapped.code === 'permission-denied') return 'permission-denied';
  if (mapped.code === 'not-found') return 'not-found';
  if (mapped.code === 'already-exists') return 'conflict';
  if (mapped.code === 'failed-precondition') return 'inactive';
  if (mapped.code === 'invalid-argument') return 'invalid';
  return 'unavailable';
}

export function parseCreateSettlementResult(
  data: unknown,
): { spaceId: string; settlementId: string } | null {
  if (!data || typeof data !== 'object') return null;
  const row = data as Record<string, unknown>;
  if (typeof row.spaceId !== 'string' || row.spaceId.includes('/')) return null;
  if (typeof row.settlementId !== 'string' || row.settlementId.includes('/')) return null;
  if (!row.spaceId || !row.settlementId) return null;
  return { spaceId: row.spaceId, settlementId: row.settlementId };
}

export function parseMutationSettlementResult(data: unknown): { settlementId: string } | null {
  if (!data || typeof data !== 'object') return null;
  const row = data as Record<string, unknown>;
  if (typeof row.settlementId !== 'string' || !row.settlementId || row.settlementId.includes('/')) {
    return null;
  }
  return { settlementId: row.settlementId };
}
