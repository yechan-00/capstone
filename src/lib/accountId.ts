const ACCOUNT_PREFIX = 'account_';

/** Firebase UID → 앱 accountId (Firestore `accounts` 문서 ID) */
export function toAccountId(uid: string): string {
  return `${ACCOUNT_PREFIX}${uid}`;
}

/** accountId → Firebase Auth UID (형식: account_{uid}) */
export function userIdFromAccountId(accountId: string): string | null {
  if (!accountId.startsWith(ACCOUNT_PREFIX)) return null;
  const uid = accountId.slice(ACCOUNT_PREFIX.length);
  return uid.length > 0 ? uid : null;
}

/** accountId에서 userId를 추출. 형식이 맞지 않으면 오류 */
export function requireUserIdFromAccountId(accountId: string): string {
  const uid = userIdFromAccountId(accountId);
  if (!uid) {
    throw new Error(`유효하지 않은 accountId: ${accountId}`);
  }
  return uid;
}

/** 저장 시 userId가 없으면 accountId에서 유도 */
export function resolveUserId(params: { accountId: string; userId?: string | null }): string {
  if (params.userId?.trim()) return params.userId.trim();
  return requireUserIdFromAccountId(params.accountId);
}

/** 문서에 userId가 없을 때 accountId에서 보완 (레거시 호환) */
export function resolveDocumentUserId(data: {
  accountId?: string;
  userId?: string | null;
}): string | undefined {
  if (typeof data.userId === 'string' && data.userId.trim()) {
    return data.userId.trim();
  }
  if (typeof data.accountId === 'string') {
    return userIdFromAccountId(data.accountId) ?? undefined;
  }
  return undefined;
}
