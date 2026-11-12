export const SHARED_EXPENSES_COLLECTION = 'shared_expenses';
export const SPACE_EXPENSE_LINKS_COLLECTION = 'space_expense_links';
export const SHARED_EXPENSE_TITLE_MAX = 60;
export const SHARED_EXPENSE_MEMO_MAX = 500;
export const SHARED_EXPENSE_AMOUNT_MIN = 1;
export const SHARED_EXPENSE_AMOUNT_MAX = 99_999_999;
export const SHARED_EXPENSE_PARTICIPANT_MAX = 20;
export const SHARED_EXPENSE_PAGE_SIZE = 20;
export const SHARED_EXPENSE_AUTHOR_FALLBACK_NAME = '이름 없음';
export const SHARED_EXPENSE_CATEGORIES = ['takeout', 'cafe', 'delivery'] as const;

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const UID_MAX = 128;

export type SharedExpenseCategory = (typeof SHARED_EXPENSE_CATEGORIES)[number];

export type SpaceSharedExpense = {
  id: string;
  title: string;
  amount: number;
  dateKey: string;
  category: SharedExpenseCategory;
  paidByUid: string;
  participantUids: string[];
  memo: string;
  createdByUid: string;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type SpaceSharedExpenseDraft = {
  title: string;
  amount: number;
  dateKey: string;
  category: SharedExpenseCategory;
  paidByUid: string;
  participantUids: string[];
  memo: string;
};

export type SpaceSharedExpenseMemberView = {
  uid: string;
  displayName: string;
  photoURL?: string;
};

export type SpaceExpenseLink = {
  spaceId: string;
  sharedExpenseId: string;
  expenseId: string;
  createdAt: Date | null;
};

export type PersonalExpenseShareSource = {
  item?: unknown;
  content?: unknown;
  amount?: unknown;
  category?: unknown;
  reason?: unknown;
  mood?: unknown;
  tags?: unknown;
  summaryLine?: unknown;
  imageUrl?: unknown;
  imageUrls?: unknown;
};

type MemberSource = {
  uid: string;
  displayName: string;
  photoURL?: string;
};

function timestampToDateOrNull(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'object' && 'toDate' in value && typeof (value as { toDate: () => Date }).toDate === 'function') {
    try {
      const date = (value as { toDate: () => Date }).toDate();
      return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
    } catch {
      return null;
    }
  }
  return null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

function usableText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

export function isUsableSharedExpenseId(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= UID_MAX && !value.includes('/');
}

export function isValidSharedExpenseDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_KEY_RE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day;
}

export function parseSharedExpenseTitle(raw: string): string {
  return raw.trim();
}

export function parseSharedExpenseMemo(raw: string): string {
  return raw.trim();
}

export function isValidSharedExpenseTitle(raw: string): boolean {
  const title = parseSharedExpenseTitle(raw);
  return title.length > 0 && title.length <= SHARED_EXPENSE_TITLE_MAX;
}

export function isValidSharedExpenseMemo(raw: string): boolean {
  return parseSharedExpenseMemo(raw).length <= SHARED_EXPENSE_MEMO_MAX;
}

export function parseSharedExpenseAmount(raw: unknown): number | null {
  if (typeof raw === 'number') {
    if (!Number.isInteger(raw) || !Number.isSafeInteger(raw)) return null;
    if (raw < SHARED_EXPENSE_AMOUNT_MIN || raw > SHARED_EXPENSE_AMOUNT_MAX) return null;
    return raw;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!/^\d+$/.test(trimmed)) return null;
    if (trimmed.length > 8) return null;
    const amount = Number(trimmed);
    if (!Number.isSafeInteger(amount)) return null;
    if (amount < SHARED_EXPENSE_AMOUNT_MIN || amount > SHARED_EXPENSE_AMOUNT_MAX) return null;
    return amount;
  }
  return null;
}

export function parseSharedExpenseCategory(raw: unknown): SharedExpenseCategory | null {
  if (raw === 'food') return 'takeout';
  if (raw === 'takeout' || raw === 'cafe' || raw === 'delivery') return raw;
  return null;
}

export function parseParticipantUids(raw: unknown): string[] | null {
  if (!Array.isArray(raw)) return null;
  if (raw.length < 1 || raw.length > SHARED_EXPENSE_PARTICIPANT_MAX) return null;
  const uids: string[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!isUsableSharedExpenseId(item) || seen.has(item)) return null;
    seen.add(item);
    uids.push(item);
  }
  return uids;
}

export function parsePaidByUid(raw: unknown, participantUids: string[]): string | null {
  if (!isUsableSharedExpenseId(raw)) return null;
  if (!participantUids.includes(raw)) return null;
  return raw;
}

export function isValidSpaceSharedExpenseDraft(draft: SpaceSharedExpenseDraft): boolean {
  if (!isValidSharedExpenseTitle(draft.title)) return false;
  if (parseSharedExpenseAmount(draft.amount) == null) return false;
  if (!isValidSharedExpenseDateKey(draft.dateKey)) return false;
  if (!parseSharedExpenseCategory(draft.category)) return false;
  if (!isValidSharedExpenseMemo(draft.memo)) return false;
  const participants = parseParticipantUids(draft.participantUids);
  if (!participants) return false;
  return parsePaidByUid(draft.paidByUid, participants) != null;
}

export function toSpaceSharedExpenseWritePayload(
  draft: SpaceSharedExpenseDraft,
): {
  title: string;
  amount: number;
  dateKey: string;
  category: SharedExpenseCategory;
  paidByUid: string;
  participantUids: string[];
  memo: string;
} | null {
  const amount = parseSharedExpenseAmount(draft.amount);
  const category = parseSharedExpenseCategory(draft.category);
  const participantUids = parseParticipantUids(draft.participantUids);
  const paidByUid = participantUids ? parsePaidByUid(draft.paidByUid, participantUids) : null;
  if (
    amount == null
    || !category
    || !participantUids
    || !paidByUid
    || !isValidSharedExpenseTitle(draft.title)
    || !isValidSharedExpenseDateKey(draft.dateKey)
    || !isValidSharedExpenseMemo(draft.memo)
  ) {
    return null;
  }
  return {
    title: parseSharedExpenseTitle(draft.title),
    amount,
    dateKey: draft.dateKey,
    category,
    paidByUid,
    participantUids,
    memo: parseSharedExpenseMemo(draft.memo),
  };
}

export function parseSpaceSharedExpense(id: string, data: unknown): SpaceSharedExpense | null {
  if (!isUsableSharedExpenseId(id)) return null;
  const row = asRecord(data);
  if (!row) return null;
  const title = typeof row.title === 'string' ? row.title : '';
  const memo = typeof row.memo === 'string' ? row.memo : '';
  const amount = parseSharedExpenseAmount(row.amount);
  const category = parseSharedExpenseCategory(row.category);
  const participantUids = parseParticipantUids(row.participantUids);
  const paidByUid = participantUids ? parsePaidByUid(row.paidByUid, participantUids) : null;
  if (
    amount == null
    || !category
    || !participantUids
    || !paidByUid
    || !isValidSharedExpenseTitle(title)
    || !isValidSharedExpenseDateKey(row.dateKey)
    || !isValidSharedExpenseMemo(memo)
    || !isUsableSharedExpenseId(row.createdByUid)
  ) {
    return null;
  }
  return {
    id,
    title: parseSharedExpenseTitle(title),
    amount,
    dateKey: row.dateKey,
    category,
    paidByUid,
    participantUids,
    memo: parseSharedExpenseMemo(memo),
    createdByUid: row.createdByUid,
    createdAt: timestampToDateOrNull(row.createdAt),
    updatedAt: timestampToDateOrNull(row.updatedAt),
  };
}

export function parseSpaceExpenseLink(_id: string, data: unknown): SpaceExpenseLink | null {
  const row = asRecord(data);
  if (!row) return null;
  if (!isUsableSharedExpenseId(row.spaceId)) return null;
  if (!isUsableSharedExpenseId(row.sharedExpenseId)) return null;
  if (!isUsableSharedExpenseId(row.expenseId)) return null;
  return {
    spaceId: row.spaceId,
    sharedExpenseId: row.sharedExpenseId,
    expenseId: row.expenseId,
    createdAt: timestampToDateOrNull(row.createdAt),
  };
}

export function spaceExpenseLinkId(spaceId: string, sharedExpenseId: string): string {
  return `${spaceId}_${sharedExpenseId}`;
}

export function compareSpaceSharedExpenses(a: SpaceSharedExpense, b: SpaceSharedExpense): number {
  if (a.dateKey !== b.dateKey) return a.dateKey > b.dateKey ? -1 : 1;
  const aCreated = a.createdAt?.getTime() ?? 0;
  const bCreated = b.createdAt?.getTime() ?? 0;
  if (aCreated !== bCreated) return bCreated - aCreated;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function sortSpaceSharedExpenses(rows: SpaceSharedExpense[]): SpaceSharedExpense[] {
  return [...rows].sort(compareSpaceSharedExpenses);
}

export function sharedExpensesOnDate(rows: SpaceSharedExpense[], dateKey: string): SpaceSharedExpense[] {
  return sortSpaceSharedExpenses(rows.filter((row) => row.dateKey === dateKey));
}

export function dateKeysWithSharedExpenses(rows: SpaceSharedExpense[]): Set<string> {
  const keys = new Set<string>();
  for (const row of rows) keys.add(row.dateKey);
  return keys;
}

export function resolveSpaceSharedExpenseMember(
  uid: string,
  members: MemberSource[],
): SpaceSharedExpenseMemberView {
  const member = members.find((row) => row.uid === uid);
  if (!member) {
    return { uid, displayName: SHARED_EXPENSE_AUTHOR_FALLBACK_NAME };
  }
  return {
    uid: member.uid,
    displayName: member.displayName || SHARED_EXPENSE_AUTHOR_FALLBACK_NAME,
    photoURL: member.photoURL,
  };
}

export function defaultSharedExpensePaidBy(memberUids: string[], viewerUid: string): string {
  if (memberUids.includes(viewerUid)) return viewerUid;
  return memberUids[0] ?? viewerUid;
}

export function defaultSharedExpenseParticipants(memberUids: string[], viewerUid: string): string[] {
  const unique = parseParticipantUids(memberUids.filter((uid) => isUsableSharedExpenseId(uid)));
  if (unique && unique.length > 0) return unique;
  return isUsableSharedExpenseId(viewerUid) ? [viewerUid] : [];
}

function uidSet(values: Iterable<string>): Set<string> {
  const next = new Set<string>();
  for (const uid of values) {
    if (isUsableSharedExpenseId(uid)) next.add(uid);
  }
  return next;
}

/** 신규 생성: 결제자·참여자는 모두 현재 멤버여야 한다. */
export function isAllowedSharedExpenseMembershipCreate(
  paidByUid: string,
  participantUids: string[],
  currentMemberUids: Iterable<string>,
): boolean {
  const current = uidSet(currentMemberUids);
  if (!current.has(paidByUid)) return false;
  for (const uid of participantUids) {
    if (!current.has(uid)) return false;
  }
  return true;
}

/**
 * 수정: 이미 저장된 결제자·참여자는 탈퇴 후에도 유지 가능.
 * 새로 넣는 결제자·참여자만 현재 멤버여야 한다.
 */
export function isAllowedSharedExpenseMembershipUpdate(
  existing: { paidByUid: string; participantUids: string[] },
  next: { paidByUid: string; participantUids: string[] },
  currentMemberUids: Iterable<string>,
): boolean {
  const current = uidSet(currentMemberUids);
  const existingParticipants = uidSet(existing.participantUids);
  for (const uid of next.participantUids) {
    if (!existingParticipants.has(uid) && !current.has(uid)) return false;
  }
  if (next.paidByUid !== existing.paidByUid && !current.has(next.paidByUid)) return false;
  return true;
}

export function formatSharedExpenseAmount(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}

export function personalExpenseShareTitle(source: PersonalExpenseShareSource): string {
  const item = usableText(source.item);
  if (item) return item.slice(0, SHARED_EXPENSE_TITLE_MAX);
  const content = usableText(source.content);
  if (content) return content.slice(0, SHARED_EXPENSE_TITLE_MAX);
  return '';
}

export function pickPersonalExpenseShareFields(
  source: PersonalExpenseShareSource,
  dateKey: string,
  includeTitle: boolean,
): { title: string; amount: number; dateKey: string; category: SharedExpenseCategory } | null {
  const amount = parseSharedExpenseAmount(source.amount);
  const category = parseSharedExpenseCategory(source.category);
  if (amount == null || !category || !isValidSharedExpenseDateKey(dateKey)) return null;
  const rawTitle = includeTitle ? personalExpenseShareTitle(source) : '';
  const title = rawTitle || categoryShareFallbackTitle(category);
  if (!isValidSharedExpenseTitle(title)) return null;
  return {
    title,
    amount,
    dateKey,
    category,
  };
}

export function categoryShareFallbackTitle(category: SharedExpenseCategory): string {
  if (category === 'cafe') return '카페 소비';
  if (category === 'delivery') return '배달 소비';
  return '외식(포장) 소비';
}

export function sharedExpensePublicKeys(): string[] {
  return [
    'title',
    'amount',
    'dateKey',
    'category',
    'paidByUid',
    'participantUids',
    'memo',
    'createdByUid',
    'createdAt',
    'updatedAt',
  ];
}
