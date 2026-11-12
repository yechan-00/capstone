import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_SPACE_MEMBER_DISPLAY_NAME } from './spaceMembersClient.ts';
import {
  SPACE_EVENT_AUTHOR_FALLBACK_NAME,
  buildSpaceCalendarGrid,
  dateKeyFromLocalDate,
  dateKeysWithEvents,
  defaultSelectedDateKey,
  eventsOnDate,
  formatSpaceEventTimeLabel,
  isValidDateKey,
  isValidSpaceEventDraft,
  isValidTimeHm,
  localDateFromDateKey,
  monthEventQueryRange,
  normalizeEventTimes,
  parseSpaceEvent,
  resolveSpaceEventAuthor,
  shiftMonth,
  sortSpaceEvents,
  toSpaceEventWritePayload,
  type SpaceEvent,
} from './spaceEvent.ts';

function event(partial: Partial<SpaceEvent> & Pick<SpaceEvent, 'id' | 'dateKey'>): SpaceEvent {
  return {
    title: '일정',
    allDay: true,
    startTime: null,
    endTime: null,
    description: '',
    createdByUid: 'u1',
    createdAt: null,
    updatedAt: null,
    ...partial,
  };
}

test('dateKey uses local calendar components, not UTC midnight', () => {
  const localMorning = new Date(2026, 10, 7, 0, 30, 0);
  assert.equal(dateKeyFromLocalDate(localMorning), '2026-11-07');
  const utcKey = [
    localMorning.getUTCFullYear(),
    String(localMorning.getUTCMonth() + 1).padStart(2, '0'),
    String(localMorning.getUTCDate()).padStart(2, '0'),
  ].join('-');
  if (localMorning.getTimezoneOffset() !== 0) {
    assert.notEqual(dateKeyFromLocalDate(localMorning), utcKey);
  }
  const parsed = localDateFromDateKey('2026-11-07');
  assert.ok(parsed);
  assert.equal(parsed.getFullYear(), 2026);
  assert.equal(parsed.getMonth(), 10);
  assert.equal(parsed.getDate(), 7);
  assert.equal(parsed.getHours(), 0);
});

test('rejects invalid calendar dates and times', () => {
  assert.equal(isValidDateKey('2026-11-07'), true);
  assert.equal(isValidDateKey('2026-02-31'), false);
  assert.equal(isValidDateKey('2026/11/07'), false);
  assert.equal(isValidDateKey('2026-13-01'), false);
  assert.equal(isValidTimeHm('09:00'), true);
  assert.equal(isValidTimeHm('24:00'), false);
  assert.equal(isValidTimeHm('9:00'), false);
  assert.equal(normalizeEventTimes({ allDay: true, startTime: '09:00', endTime: '10:00' })?.startTime, null);
  assert.equal(normalizeEventTimes({ allDay: false, startTime: null, endTime: null }), null);
  assert.equal(normalizeEventTimes({ allDay: false, startTime: '10:00', endTime: '09:00' }), null);
  assert.deepEqual(normalizeEventTimes({ allDay: false, startTime: '09:00', endTime: null }), {
    allDay: false,
    startTime: '09:00',
    endTime: null,
  });
});

test('draft validation trims title and bounds description', () => {
  assert.equal(
    isValidSpaceEventDraft({
      title: '  점심  ',
      dateKey: '2026-11-07',
      allDay: true,
      startTime: null,
      endTime: null,
      description: '',
    }),
    true,
  );
  assert.equal(
    isValidSpaceEventDraft({
      title: ' ',
      dateKey: '2026-11-07',
      allDay: true,
      startTime: null,
      endTime: null,
      description: '',
    }),
    false,
  );
  assert.equal(
    toSpaceEventWritePayload({
      title: '  점심  ',
      dateKey: '2026-11-07',
      allDay: false,
      startTime: '12:00',
      endTime: '13:00',
      description: '  메모  ',
    })?.title,
    '점심',
  );
});

test('parses event docs and drops malformed rows', () => {
  const parsed = parseSpaceEvent('e1', {
    title: '저녁',
    dateKey: '2026-11-07',
    allDay: false,
    startTime: '18:00',
    endTime: '20:00',
    description: '모임',
    createdByUid: 'member-1',
    createdAt: new Date('2026-11-07T01:00:00.000Z'),
  });
  assert.ok(parsed);
  assert.equal(parsed.title, '저녁');
  assert.equal(parsed.startTime, '18:00');
  assert.equal(parseSpaceEvent('e1', { title: 'x', dateKey: 'nope', createdByUid: 'u1', allDay: true }), null);
  assert.equal(parseSpaceEvent('a/b', { title: 'x', dateKey: '2026-11-07', createdByUid: 'u1', allDay: true }), null);
});

test('sorts all-day before timed events, then by start time', () => {
  const sorted = sortSpaceEvents([
    event({ id: 't2', dateKey: '2026-11-07', allDay: false, startTime: '18:00' }),
    event({ id: 'd1', dateKey: '2026-11-07', allDay: true }),
    event({ id: 't1', dateKey: '2026-11-07', allDay: false, startTime: '09:00' }),
    event({ id: 'other', dateKey: '2026-11-08', allDay: true }),
  ]);
  assert.deepEqual(sorted.map((row) => row.id), ['d1', 't1', 't2', 'other']);
  assert.deepEqual(eventsOnDate(sorted, '2026-11-07').map((row) => row.id), ['d1', 't1', 't2']);
  assert.equal(dateKeysWithEvents(sorted).has('2026-11-07'), true);
});

test('monthly grid covers adjacent days and query range stays on the visible sheet', () => {
  const month = new Date(2026, 10, 1);
  const grid = buildSpaceCalendarGrid(month);
  assert.equal(grid.length % 7, 0);
  assert.equal(grid.filter((cell) => cell.inMonth).length, 30);
  const range = monthEventQueryRange(month);
  assert.equal(range.start, grid[0]?.dateKey);
  assert.equal(range.end, grid[grid.length - 1]?.dateKey);
  assert.equal(defaultSelectedDateKey(month, new Date(2026, 10, 7)), '2026-11-07');
  assert.equal(defaultSelectedDateKey(shiftMonth(month, -1), new Date(2026, 10, 7)), '2026-10-01');
});

test('time labels and departed author fallback', () => {
  assert.equal(formatSpaceEventTimeLabel({ allDay: true, startTime: null, endTime: null }), '종일');
  assert.equal(formatSpaceEventTimeLabel({ allDay: false, startTime: '09:00', endTime: null }), '09:00');
  assert.equal(
    formatSpaceEventTimeLabel({ allDay: false, startTime: '09:00', endTime: '10:30' }),
    '09:00 – 10:30',
  );
  assert.equal(SPACE_EVENT_AUTHOR_FALLBACK_NAME, DEFAULT_SPACE_MEMBER_DISPLAY_NAME);
  const missing = resolveSpaceEventAuthor('gone', []);
  assert.equal(missing.displayName, DEFAULT_SPACE_MEMBER_DISPLAY_NAME);
  assert.equal(missing.photoURL, undefined);
  const present = resolveSpaceEventAuthor('u1', [
    {
      uid: 'u1',
      displayName: '닉',
      role: 'member',
      joinedAt: null,
      photoURL: 'https://example.com/a.jpg',
    },
  ]);
  assert.equal(present.displayName, '닉');
  assert.equal(present.photoURL, 'https://example.com/a.jpg');
});
