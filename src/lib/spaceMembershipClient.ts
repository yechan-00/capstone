export const LEAVE_SPACE_FN = 'leaveSpace';
export const REMOVE_SPACE_MEMBER_FN = 'removeSpaceMember';

export const LEAVE_CONFIRM_TITLE = '공간에서 나가기';
export const LEAVE_CONFIRM_LABEL = '나가기';
export const LEAVE_CONFIRM_MESSAGE = [
  '공간에서 나가게 됩니다.',
  '공유 공간에 더 이상 접근할 수 없습니다.',
  '다시 참여하려면 초대 코드가 필요합니다.',
  '개인 소비 기록은 삭제되지 않습니다.',
].join('\n');

export const REMOVE_CONFIRM_TITLE = '멤버 내보내기';
export const REMOVE_CONFIRM_LABEL = '내보내기';
export const REMOVE_CONFIRM_MESSAGE = [
  '선택한 멤버를 공간에서 내보냅니다.',
  '해당 멤버는 공간에 접근할 수 없게 됩니다.',
  '다시 참여하려면 유효한 초대 코드가 필요합니다.',
].join('\n');

export type SpaceMembershipErrorCode =
  | 'unauthenticated'
  | 'invalid-argument'
  | 'permission-denied'
  | 'not-found'
  | 'failed-precondition'
  | 'aborted'
  | 'unavailable'
  | 'deadline-exceeded'
  | 'internal';

const LEAVE_MESSAGES: Record<SpaceMembershipErrorCode, string> = {
  unauthenticated: '로그인이 필요해요.',
  'invalid-argument': '공간을 확인할 수 없어요.',
  'permission-denied': '이 공간에서 나갈 수 없어요.',
  'not-found': '공간을 찾을 수 없어요.',
  'failed-precondition': '현재 이용할 수 없는 공간이에요.',
  aborted: '잠시 후 다시 시도해 주세요.',
  unavailable: '네트워크 연결을 확인한 뒤 다시 시도해 주세요.',
  'deadline-exceeded': '네트워크 연결을 확인한 뒤 다시 시도해 주세요.',
  internal: '공간을 나가지 못했어요. 잠시 후 다시 시도해 주세요.',
};

const REMOVE_MESSAGES: Record<SpaceMembershipErrorCode, string> = {
  unauthenticated: '로그인이 필요해요.',
  'invalid-argument': '멤버를 확인할 수 없어요.',
  'permission-denied': '공간 소유자만 멤버를 내보낼 수 있어요.',
  'not-found': '해당 멤버를 찾을 수 없어요.',
  'failed-precondition': '현재 이용할 수 없는 공간이에요.',
  aborted: '잠시 후 다시 시도해 주세요.',
  unavailable: '네트워크 연결을 확인한 뒤 다시 시도해 주세요.',
  'deadline-exceeded': '네트워크 연결을 확인한 뒤 다시 시도해 주세요.',
  internal: '멤버를 내보내지 못했어요. 잠시 후 다시 시도해 주세요.',
};

const ALLOWED_SERVER_MESSAGES = new Set([
  '로그인이 필요해요.',
  '공간을 확인할 수 없어요.',
  '멤버를 확인할 수 없어요.',
  '공간을 찾을 수 없어요.',
  '현재 이용할 수 없는 공간이에요.',
  '방장은 공간을 나갈 수 없어요.',
  '이미 이 공간에서 나갔어요.',
  '이 공간에서 나갈 수 없어요.',
  '공간 소유자만 멤버를 내보낼 수 있어요.',
  '자기 자신은 내보낼 수 없어요.',
  '방장은 내보낼 수 없어요.',
  '해당 멤버를 찾을 수 없어요.',
  '잠시 후 다시 시도해 주세요.',
  '공간을 나가지 못했어요. 잠시 후 다시 시도해 주세요.',
  '멤버를 내보내지 못했어요. 잠시 후 다시 시도해 주세요.',
  '네트워크 연결을 확인한 뒤 다시 시도해 주세요.',
]);

const KNOWN_CODES: readonly SpaceMembershipErrorCode[] = [
  'unauthenticated',
  'invalid-argument',
  'permission-denied',
  'not-found',
  'failed-precondition',
  'aborted',
  'unavailable',
  'deadline-exceeded',
  'internal',
];

export class SpaceMembershipError extends Error {
  readonly code: SpaceMembershipErrorCode;
  readonly userMessage: string;

  constructor(code: SpaceMembershipErrorCode, userMessage: string) {
    super(userMessage);
    this.name = 'SpaceMembershipError';
    this.code = code;
    this.userMessage = userMessage;
  }
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

function isSpaceMembershipErrorCode(code: string): code is SpaceMembershipErrorCode {
  return (KNOWN_CODES as readonly string[]).includes(code);
}

export function toSpaceMembershipError(
  error: unknown,
  action: 'leave' | 'remove',
): SpaceMembershipError {
  if (error instanceof SpaceMembershipError) return error;
  const fallback = action === 'leave' ? LEAVE_MESSAGES : REMOVE_MESSAGES;
  const raw = functionsErrorCode(error);
  const serverMessage = errorMessage(error);
  if (serverMessage && ALLOWED_SERVER_MESSAGES.has(serverMessage)) {
    const code = raw && isSpaceMembershipErrorCode(raw) ? raw : 'internal';
    return new SpaceMembershipError(code, serverMessage);
  }
  if (raw && isSpaceMembershipErrorCode(raw)) {
    return new SpaceMembershipError(raw, fallback[raw]);
  }
  return new SpaceMembershipError('unavailable', fallback.unavailable);
}

export function parseLeaveSpaceResult(data: unknown): string | null {
  if (!data || typeof data !== 'object') return null;
  const spaceId = (data as { spaceId?: unknown }).spaceId;
  if (typeof spaceId !== 'string') return null;
  const trimmed = spaceId.trim();
  if (!trimmed || trimmed.includes('/')) return null;
  return trimmed;
}

export function parseRemoveSpaceMemberResult(data: unknown): { spaceId: string; uid: string } | null {
  if (!data || typeof data !== 'object') return null;
  const record = data as { spaceId?: unknown; uid?: unknown };
  if (typeof record.spaceId !== 'string' || typeof record.uid !== 'string') return null;
  const spaceId = record.spaceId.trim();
  const uid = record.uid.trim();
  if (!spaceId || spaceId.includes('/') || !uid || uid.includes('/')) return null;
  return { spaceId, uid };
}

export function canShowLeaveSpace(
  role: string | undefined,
  ownerUid: string | undefined,
  uid: string | null,
): boolean {
  if (!uid) return false;
  if (role === 'owner') return false;
  return !(typeof ownerUid === 'string' && ownerUid === uid);
}

export function canShowRemoveMember(args: {
  viewerIsOwner: boolean;
  viewerUid: string | null;
  member: { uid: string; role: string };
}): boolean {
  if (!args.viewerIsOwner || !args.viewerUid) return false;
  if (args.member.uid === args.viewerUid) return false;
  if (args.member.role === 'owner') return false;
  return true;
}

export function isAlreadyLeftError(error: SpaceMembershipError): boolean {
  return error.code === 'failed-precondition' && error.userMessage === '이미 이 공간에서 나갔어요.';
}

export function isAlreadyRemovedError(error: SpaceMembershipError): boolean {
  return error.code === 'not-found' && error.userMessage === '해당 멤버를 찾을 수 없어요.';
}

export function createActionGate() {
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
