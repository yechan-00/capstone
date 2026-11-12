const FALLBACK_AUTHOR_NAME = '이름 없음';

/**
 * 공유 공간 일정 — 날짜·시간 정책
 *
 * - 캘린더 날짜는 Firestore Timestamp(UTC 자정)가 아니라 `dateKey`(YYYY-MM-DD) 문자열로 저장한다.
 *   Timestamp 자정을 쓰면 한국(UTC+9)에서 날짜가 하루 밀릴 수 있다.
 * - `dateKey`는 기기 로컬 캘린더 날짜다. 한국 사용자는 보통 Asia/Seoul이다.
 * - 시작·종료 시각은 타임존 없는 벽시계 `HH:mm`이다. UTC로 변환하지 않는다.
 * - `createdAt` / `updatedAt`만 Firestore Timestamp(절대 시각)이며, 화면에는 로컬 시각으로 표시한다.
 * - 개인 가계부 `spentAt` Timestamp 로직과 섞지 않는다.
 */
export const SPACE_EVENTS_COLLECTION = 'events';
export { FALLBACK_AUTHOR_NAME as SPACE_EVENT_AUTHOR_FALLBACK_NAME };
export const SPACE_EVENT_TITLE_MAX = 60;
export const SPACE_EVENT_DESCRIPTION_MAX = 500;

export const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_HM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export type SpaceEvent = {
  id: string;
  title: string;
  dateKey: string;
  allDay: boolean;
  startTime: string | null;
  endTime: string | null;
  description: string;
  createdByUid: string;
  createdAt: Date | null;
  updatedAt: Date | null;
};

export type SpaceEventDraft = {
  title: string;
  dateKey: string;
  allDay: boolean;
  startTime: string | null;
  endTime: string | null;
  description: string;
};

export type SpaceCalendarCell = {
  dateKey: string;
  day: number;
  inMonth: boolean;
};

export type SpaceEventAuthorView = {
  uid: string;
  displayName: string;
  photoURL?: string;
};

type AuthorSource = {
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

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

export function dateKeyFromLocalDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function localDateFromDateKey(dateKey: string): Date | null {
  if (!isValidDateKey(dateKey)) return null;
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function isValidDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_KEY_RE.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  );
}

export function isValidTimeHm(value: unknown): value is string {
  return typeof value === 'string' && TIME_HM_RE.test(value);
}

export function parseClientEventTitle(raw: string): string {
  return raw.trim();
}

export function isValidSpaceEventTitle(raw: string): boolean {
  const title = parseClientEventTitle(raw);
  return title.length > 0 && title.length <= SPACE_EVENT_TITLE_MAX;
}

export function parseClientEventDescription(raw: string): string {
  return raw.trim();
}

export function isValidSpaceEventDescription(raw: string): boolean {
  return parseClientEventDescription(raw).length <= SPACE_EVENT_DESCRIPTION_MAX;
}

export function normalizeEventTimes(input: {
  allDay: boolean;
  startTime: string | null;
  endTime: string | null;
}): { allDay: boolean; startTime: string | null; endTime: string | null } | null {
  if (input.allDay) {
    return { allDay: true, startTime: null, endTime: null };
  }
  if (!isValidTimeHm(input.startTime)) return null;
  if (input.endTime == null || input.endTime === '') {
    return { allDay: false, startTime: input.startTime, endTime: null };
  }
  if (!isValidTimeHm(input.endTime) || input.endTime < input.startTime) return null;
  return { allDay: false, startTime: input.startTime, endTime: input.endTime };
}

export function isValidSpaceEventDraft(draft: SpaceEventDraft): boolean {
  if (!isValidSpaceEventTitle(draft.title)) return false;
  if (!isValidDateKey(draft.dateKey)) return false;
  if (!isValidSpaceEventDescription(draft.description)) return false;
  return normalizeEventTimes(draft) != null;
}

export function monthStartDate(month: Date): Date {
  return new Date(month.getFullYear(), month.getMonth(), 1);
}

export function shiftMonth(month: Date, delta: number): Date {
  return new Date(month.getFullYear(), month.getMonth() + delta, 1);
}

export function formatSpaceMonth(month: Date): string {
  return `${month.getFullYear()}년 ${month.getMonth() + 1}월`;
}

export function formatSpaceDayHeading(dateKey: string): string {
  const date = localDateFromDateKey(dateKey);
  if (!date) return dateKey;
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEKDAYS[date.getDay()]})`;
}

export function formatSpaceEventTimeLabel(event: Pick<SpaceEvent, 'allDay' | 'startTime' | 'endTime'>): string {
  if (event.allDay || !event.startTime) return '종일';
  if (!event.endTime) return event.startTime;
  return `${event.startTime} – ${event.endTime}`;
}

export function formatSpaceEventCreatedAt(date: Date | null): string | null {
  if (!date || Number.isNaN(date.getTime())) return null;
  const hour = date.getHours();
  const minute = date.getMinutes();
  const period = hour >= 12 ? '오후' : '오전';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}. ${period} ${h12}:${String(minute).padStart(2, '0')}`;
}

export function buildSpaceCalendarGrid(month: Date): SpaceCalendarCell[] {
  const year = month.getFullYear();
  const monthIndex = month.getMonth();
  const first = new Date(year, monthIndex, 1);
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
  const cells: SpaceCalendarCell[] = [];

  for (let pad = first.getDay(); pad > 0; pad -= 1) {
    const date = new Date(year, monthIndex, 1 - pad);
    cells.push({
      dateKey: dateKeyFromLocalDate(date),
      day: date.getDate(),
      inMonth: false,
    });
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(year, monthIndex, day);
    cells.push({
      dateKey: dateKeyFromLocalDate(date),
      day,
      inMonth: true,
    });
  }

  while (cells.length % 7 !== 0) {
    const last = localDateFromDateKey(cells[cells.length - 1]?.dateKey ?? '') ?? new Date(year, monthIndex + 1, 0);
    const next = new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1);
    cells.push({
      dateKey: dateKeyFromLocalDate(next),
      day: next.getDate(),
      inMonth: false,
    });
  }

  return cells;
}

export function monthEventQueryRange(month: Date): { start: string; end: string } {
  const cells = buildSpaceCalendarGrid(month);
  const start = cells[0]?.dateKey;
  const end = cells[cells.length - 1]?.dateKey;
  if (!start || !end) {
    const fallback = monthStartDate(month);
    return {
      start: dateKeyFromLocalDate(fallback),
      end: dateKeyFromLocalDate(new Date(fallback.getFullYear(), fallback.getMonth() + 1, 0)),
    };
  }
  return { start, end };
}

export function defaultSelectedDateKey(month: Date, now: Date = new Date()): string {
  if (now.getFullYear() === month.getFullYear() && now.getMonth() === month.getMonth()) {
    return dateKeyFromLocalDate(now);
  }
  return dateKeyFromLocalDate(monthStartDate(month));
}

export function compareSpaceEvents(a: SpaceEvent, b: SpaceEvent): number {
  if (a.dateKey !== b.dateKey) return a.dateKey < b.dateKey ? -1 : 1;
  if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
  const aTime = a.startTime ?? '';
  const bTime = b.startTime ?? '';
  if (aTime !== bTime) return aTime < bTime ? -1 : 1;
  const aCreated = a.createdAt?.getTime() ?? 0;
  const bCreated = b.createdAt?.getTime() ?? 0;
  if (aCreated !== bCreated) return aCreated - bCreated;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

export function sortSpaceEvents(events: SpaceEvent[]): SpaceEvent[] {
  return [...events].sort(compareSpaceEvents);
}

export function eventsOnDate(events: SpaceEvent[], dateKey: string): SpaceEvent[] {
  return sortSpaceEvents(events.filter((event) => event.dateKey === dateKey));
}

export function dateKeysWithEvents(events: SpaceEvent[]): Set<string> {
  const keys = new Set<string>();
  for (const event of events) keys.add(event.dateKey);
  return keys;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object') return null;
  return value as Record<string, unknown>;
}

function parseOptionalTime(value: unknown): string | null | undefined {
  if (value == null) return null;
  if (!isValidTimeHm(value)) return undefined;
  return value;
}

export function parseSpaceEvent(id: string, data: unknown): SpaceEvent | null {
  if (!id || id.includes('/')) return null;
  const row = asRecord(data);
  if (!row) return null;
  if (!isValidSpaceEventTitle(typeof row.title === 'string' ? row.title : '')) return null;
  if (!isValidDateKey(row.dateKey)) return null;
  if (typeof row.createdByUid !== 'string' || row.createdByUid.length === 0 || row.createdByUid.includes('/')) {
    return null;
  }
  const description = typeof row.description === 'string' ? row.description : '';
  if (!isValidSpaceEventDescription(description)) return null;

  const allDay = row.allDay === true;
  const startTime = parseOptionalTime(row.startTime);
  const endTime = parseOptionalTime(row.endTime);
  if (startTime === undefined || endTime === undefined) return null;
  const times = normalizeEventTimes({ allDay, startTime, endTime });
  if (!times) return null;

  return {
    id,
    title: parseClientEventTitle(row.title as string),
    dateKey: row.dateKey,
    allDay: times.allDay,
    startTime: times.startTime,
    endTime: times.endTime,
    description: parseClientEventDescription(description),
    createdByUid: row.createdByUid,
    createdAt: timestampToDateOrNull(row.createdAt),
    updatedAt: timestampToDateOrNull(row.updatedAt),
  };
}

export function resolveSpaceEventAuthor(
  createdByUid: string,
  members: AuthorSource[],
): SpaceEventAuthorView {
  const member = members.find((row) => row.uid === createdByUid);
  if (!member) {
    return { uid: createdByUid, displayName: FALLBACK_AUTHOR_NAME };
  }
  return {
    uid: member.uid,
    displayName: member.displayName || FALLBACK_AUTHOR_NAME,
    photoURL: member.photoURL,
  };
}

export function toSpaceEventWritePayload(draft: SpaceEventDraft): {
  title: string;
  dateKey: string;
  allDay: boolean;
  startTime: string | null;
  endTime: string | null;
  description: string;
} | null {
  const times = normalizeEventTimes(draft);
  if (!times || !isValidSpaceEventTitle(draft.title) || !isValidDateKey(draft.dateKey)) return null;
  if (!isValidSpaceEventDescription(draft.description)) return null;
  return {
    title: parseClientEventTitle(draft.title),
    dateKey: draft.dateKey,
    allDay: times.allDay,
    startTime: times.startTime,
    endTime: times.endTime,
    description: parseClientEventDescription(draft.description),
  };
}

export function timeHmFromDate(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function dateFromDateKeyAndTime(dateKey: string, timeHm: string | null): Date | null {
  const date = localDateFromDateKey(dateKey);
  if (!date) return null;
  if (!timeHm) return date;
  if (!isValidTimeHm(timeHm)) return null;
  const [hours, minutes] = timeHm.split(':').map(Number);
  date.setHours(hours, minutes, 0, 0);
  return date;
}
