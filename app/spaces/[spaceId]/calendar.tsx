import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfirmModal } from '@/components/ConfirmModal';
import { ErrorRetryCard } from '@/components/ErrorRetryCard';
import { SubScreenHeader } from '@/components/SubScreenHeader';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { SpaceEventCalendar } from '@/components/spaces/SpaceEventCalendar';
import { SpaceEventDetailSheet } from '@/components/spaces/SpaceEventDetailSheet';
import { SpaceEventList } from '@/components/spaces/SpaceEventList';
import { useAuth } from '@/hooks/useAuth';
import { useSpaceDetail } from '@/hooks/useSpaceDetail';
import { useSpaceMembers } from '@/hooks/useSpaceMembers';
import { useSpaceMonthEvents } from '@/hooks/useSpaceMonthEvents';
import { useSpaceMonthMemories } from '@/hooks/useSpaceMonthMemories';
import { useSpaceMonthSharedExpenses } from '@/hooks/useSpaceMonthSharedExpenses';
import {
  dateKeyFromLocalDate,
  dateKeysWithEvents,
  defaultSelectedDateKey,
  eventsOnDate,
  localDateFromDateKey,
  monthStartDate,
  shiftMonth,
  type SpaceCalendarCell,
  type SpaceEvent,
} from '@/lib/spaceEvent';
import {
  dateKeysWithMemories,
  memoriesOnDate,
  resolveSpaceMemoryAuthor,
  type SpaceMemory,
} from '@/lib/spaceMemory';
import {
  dateKeysWithSharedExpenses,
  formatSharedExpenseAmount,
  resolveSpaceSharedExpenseMember,
  sharedExpensesOnDate,
  type SpaceSharedExpense,
} from '@/lib/spaceSharedExpense';
import {
  DELETE_EVENT_CONFIRM_LABEL,
  DELETE_EVENT_CONFIRM_MESSAGE,
  DELETE_EVENT_CONFIRM_TITLE,
  canMutateSpaceEvent,
  createEventWriteGate,
  toSpaceEventError,
} from '@/lib/spaceEventClient';
import type { SpaceMember } from '@/lib/spaceMembersClient';
import { SPACE_TYPE_BY_ID, spaceTypeButtonFill, spaceTypeButtonInk } from '@/lib/spaceTypes';
import { deleteSpaceEvent } from '@/services/spaceEventService';
import { BRAND_GREEN, useTheme } from '@/theme/ThemeContext';
import { showAlert } from '@/utils/alert';
import { firstParam } from '@/utils/routerParams';

function CalendarMemoryList({
  memories,
  members,
  accent,
  loading,
  onAdd,
  onOpen,
}: {
  memories: SpaceMemory[];
  members: SpaceMember[];
  accent: string;
  loading: boolean;
  onAdd: () => void;
  onOpen: (memory: SpaceMemory) => void;
}) {
  const { colors, isDark } = useTheme();
  return (
    <View style={calendarMemoryStyles.wrap}>
      <Text style={[calendarMemoryStyles.heading, { color: colors.text }]}>함께한 기록</Text>
      {loading ? (
        <View style={calendarMemoryStyles.state}>
          <ActivityIndicator size="small" color={BRAND_GREEN} />
        </View>
      ) : memories.length === 0 ? (
        <View style={[calendarMemoryStyles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[calendarMemoryStyles.emptyTitle, { color: colors.text }]}>이 날의 기록이 없어요</Text>
          <Pressable
            onPress={onAdd}
            style={[calendarMemoryStyles.addBtn, { backgroundColor: spaceTypeButtonFill(accent, isDark) }]}
          >
            <Text style={[calendarMemoryStyles.addBtnText, { color: spaceTypeButtonInk(accent, isDark) }]}>
              기록 추가
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={calendarMemoryStyles.list}>
          {memories.map((memory) => {
            const author = resolveSpaceMemoryAuthor(memory.createdByUid, members);
            return (
              <Pressable
                key={memory.id}
                onPress={() => onOpen(memory)}
                style={[calendarMemoryStyles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <ProfileAvatar uri={author.photoURL} name={author.displayName} size={36} accent={accent} />
                <View style={calendarMemoryStyles.rowBody}>
                  <Text style={[calendarMemoryStyles.title, { color: colors.text }]} numberOfLines={1}>
                    {memory.title}
                  </Text>
                  <Text style={[calendarMemoryStyles.meta, { color: colors.textSec }]} numberOfLines={1}>
                    기록 · {author.displayName}
                  </Text>
                </View>
              </Pressable>
            );
          })}
          <Pressable
            onPress={onAdd}
            style={[
              calendarMemoryStyles.addBtn,
              { backgroundColor: spaceTypeButtonFill(accent, isDark), alignSelf: 'flex-start' },
            ]}
          >
            <Text style={[calendarMemoryStyles.addBtnText, { color: spaceTypeButtonInk(accent, isDark) }]}>
              기록 추가
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

function CalendarSharedExpenseList({
  expenses,
  members,
  accent,
  loading,
  onAdd,
  onOpen,
}: {
  expenses: SpaceSharedExpense[];
  members: SpaceMember[];
  accent: string;
  loading: boolean;
  onAdd: () => void;
  onOpen: (expense: SpaceSharedExpense) => void;
}) {
  const { colors, isDark } = useTheme();
  return (
    <View style={calendarMemoryStyles.wrap}>
      <Text style={[calendarMemoryStyles.heading, { color: colors.text }]}>공동 소비</Text>
      {loading ? (
        <View style={calendarMemoryStyles.state}>
          <ActivityIndicator size="small" color={BRAND_GREEN} />
        </View>
      ) : expenses.length === 0 ? (
        <View style={[calendarMemoryStyles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[calendarMemoryStyles.emptyTitle, { color: colors.text }]}>이 날의 공동 소비가 없어요</Text>
          <Pressable
            onPress={onAdd}
            style={[calendarMemoryStyles.addBtn, { backgroundColor: spaceTypeButtonFill(accent, isDark) }]}
          >
            <Text style={[calendarMemoryStyles.addBtnText, { color: spaceTypeButtonInk(accent, isDark) }]}>
              공동 소비 추가
            </Text>
          </Pressable>
        </View>
      ) : (
        <View style={calendarMemoryStyles.list}>
          {expenses.map((expense) => {
            const paidBy = resolveSpaceSharedExpenseMember(expense.paidByUid, members);
            return (
              <Pressable
                key={expense.id}
                onPress={() => onOpen(expense)}
                style={[calendarMemoryStyles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
              >
                <ProfileAvatar uri={paidBy.photoURL} name={paidBy.displayName} size={36} accent={accent} />
                <View style={calendarMemoryStyles.rowBody}>
                  <Text style={[calendarMemoryStyles.title, { color: colors.text }]} numberOfLines={1}>
                    {expense.title}
                  </Text>
                  <Text style={[calendarMemoryStyles.meta, { color: colors.textSec }]} numberOfLines={1}>
                    {formatSharedExpenseAmount(expense.amount)} · {paidBy.displayName}
                  </Text>
                </View>
              </Pressable>
            );
          })}
          <Pressable
            onPress={onAdd}
            style={[
              calendarMemoryStyles.addBtn,
              { backgroundColor: spaceTypeButtonFill(accent, isDark), alignSelf: 'flex-start' },
            ]}
          >
            <Text style={[calendarMemoryStyles.addBtnText, { color: spaceTypeButtonInk(accent, isDark) }]}>
              공동 소비 추가
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

export default function SpaceCalendarScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ spaceId?: string | string[] }>();
  const spaceId = firstParam(params.spaceId);
  const { user, isRegistered } = useAuth();
  const uid = isRegistered && user?.uid ? user.uid : null;
  const fallbackHref = spaceId ? `/spaces/${spaceId}` : '/spaces';

  const { space, status: detailStatus, errorKind: detailKind, errorMessage: detailError, retry: retryDetail } =
    useSpaceDetail(spaceId);
  const membersState = useSpaceMembers(spaceId);
  const [month, setMonth] = useState(() => monthStartDate(new Date()));
  const [selectedDateKey, setSelectedDateKey] = useState(() => defaultSelectedDateKey(new Date()));
  const { events, status: eventsStatus, errorKind: eventsKind, errorMessage: eventsError, retry: retryEvents } =
    useSpaceMonthEvents(spaceId, month);
  const {
    memories,
    status: memoriesStatus,
    errorKind: memoriesKind,
    errorMessage: memoriesError,
    retry: retryMemories,
  } = useSpaceMonthMemories(spaceId, month);
  const {
    expenses: monthExpenses,
    status: expensesStatus,
    errorKind: expensesKind,
    errorMessage: expensesError,
    retry: retryExpenses,
  } = useSpaceMonthSharedExpenses(spaceId, month);

  const accent = space?.type ? SPACE_TYPE_BY_ID[space.type].accent : colors.primary;
  const todayKey = dateKeyFromLocalDate(new Date());
  const eventDateKeys = useMemo(() => dateKeysWithEvents(events), [events]);
  const memoryDateKeys = useMemo(() => dateKeysWithMemories(memories), [memories]);
  const expenseDateKeys = useMemo(() => dateKeysWithSharedExpenses(monthExpenses), [monthExpenses]);
  const dayEvents = useMemo(() => eventsOnDate(events, selectedDateKey), [events, selectedDateKey]);
  const dayMemories = useMemo(() => memoriesOnDate(memories, selectedDateKey), [memories, selectedDateKey]);
  const dayExpenses = useMemo(
    () => sharedExpensesOnDate(monthExpenses, selectedDateKey),
    [monthExpenses, selectedDateKey],
  );

  const [detail, setDetail] = useState<SpaceEvent | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SpaceEvent | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const deleteGate = useRef(createEventWriteGate());

  const blocked = detailStatus === 'error';
  const showSpinner = detailStatus === 'loading' && !blocked;
  const eventsLoading = eventsStatus === 'loading';
  const eventsFailed = eventsStatus === 'error';
  const memoriesLoading = memoriesStatus === 'loading';
  const memoriesFailed = memoriesStatus === 'error';
  const expensesLoading = expensesStatus === 'loading';
  const expensesFailed = expensesStatus === 'error';

  const openForm = (dateKey: string, eventId?: string) => {
    if (!spaceId) return;
    router.push({
      pathname: '/spaces/[spaceId]/event-form',
      params: eventId ? { spaceId, dateKey, eventId } : { spaceId, dateKey },
    });
  };

  const onSelectDate = (cell: SpaceCalendarCell) => {
    setSelectedDateKey(cell.dateKey);
    if (!cell.inMonth) {
      const next = localDateFromDateKey(cell.dateKey);
      if (next) setMonth(monthStartDate(next));
    }
  };

  const openMemoryForm = (dateKey: string, memoryId?: string) => {
    if (!spaceId) return;
    router.push({
      pathname: '/spaces/[spaceId]/memory-form',
      params: memoryId ? { spaceId, dateKey, memoryId } : { spaceId, dateKey },
    });
  };

  const openExpenseForm = (dateKey: string) => {
    if (!spaceId) return;
    router.push({
      pathname: '/spaces/[spaceId]/expense-form',
      params: { spaceId, dateKey },
    });
  };

  const onRetry = () => {
    retryDetail();
    retryEvents();
    retryMemories();
    retryExpenses();
    membersState.retry();
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SubScreenHeader title={space?.name ?? '공유 캘린더'} fallbackHref={fallbackHref} />

      {showSpinner ? (
        <View style={styles.stateWrap}>
          <ActivityIndicator size="large" color={BRAND_GREEN} />
        </View>
      ) : blocked ? (
        <View style={styles.errorWrap}>
          <ErrorRetryCard
            title={detailError ?? '캘린더를 불러오지 못했어요.'}
            desc={
              detailKind === 'permission-denied'
                ? '이 공간의 멤버만 일정을 볼 수 있어요.'
                : detailKind === 'not-found'
                  ? '공간을 찾을 수 없어요.'
                  : detailKind === 'inactive'
                    ? '이 공간은 현재 사용할 수 없어요.'
                    : '네트워크 연결을 확인한 뒤 다시 시도해 주세요.'
            }
            onRetry={() => {
              if (detailKind === 'unauthenticated') {
                router.replace(Platform.OS === 'web' ? '/home' : '/(auth)/login');
                return;
              }
              onRetry();
            }}
          />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom, 12) + 32 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <SpaceEventCalendar
            month={month}
            selectedDateKey={selectedDateKey}
            todayKey={todayKey}
            eventDateKeys={eventDateKeys}
            memoryDateKeys={memoryDateKeys}
            expenseDateKeys={expenseDateKeys}
            accent={accent}
            onPrevMonth={() => {
              const next = shiftMonth(month, -1);
              setMonth(next);
              setSelectedDateKey(defaultSelectedDateKey(next));
            }}
            onNextMonth={() => {
              const next = shiftMonth(month, 1);
              setMonth(next);
              setSelectedDateKey(defaultSelectedDateKey(next));
            }}
            onToday={() => {
              const now = new Date();
              setMonth(monthStartDate(now));
              setSelectedDateKey(dateKeyFromLocalDate(now));
            }}
            onSelectDate={onSelectDate}
          />

          {eventsFailed ? (
            <View style={styles.listError}>
              <ErrorRetryCard
                title={eventsError ?? '일정을 불러오지 못했어요.'}
                desc={
                  eventsKind === 'permission-denied'
                    ? '이 공간의 멤버만 일정을 볼 수 있어요.'
                    : '네트워크 연결을 확인한 뒤 다시 시도해 주세요.'
                }
                onRetry={retryEvents}
              />
            </View>
          ) : (
            <SpaceEventList
              dateKey={selectedDateKey}
              events={dayEvents}
              members={membersState.members}
              accent={accent}
              loading={eventsLoading}
              onAdd={() => openForm(selectedDateKey)}
              onOpen={setDetail}
            />
          )}

          {memoriesFailed ? (
            <View style={styles.listError}>
              <ErrorRetryCard
                title={memoriesError ?? '기록을 불러오지 못했어요.'}
                desc={
                  memoriesKind === 'permission-denied'
                    ? '이 공간의 멤버만 기록을 볼 수 있어요.'
                    : '네트워크 연결을 확인한 뒤 다시 시도해 주세요.'
                }
                onRetry={retryMemories}
              />
            </View>
          ) : (
            <CalendarMemoryList
              memories={dayMemories}
              members={membersState.members}
              accent={accent}
              loading={memoriesLoading}
              onAdd={() => openMemoryForm(selectedDateKey)}
              onOpen={(memory) => {
                if (!spaceId) return;
                router.push({
                  pathname: '/spaces/[spaceId]/memory/[memoryId]',
                  params: { spaceId, memoryId: memory.id },
                });
              }}
            />
          )}

          {expensesFailed ? (
            <View style={styles.listError}>
              <ErrorRetryCard
                title={expensesError ?? '공동 소비를 불러오지 못했어요.'}
                desc={
                  expensesKind === 'permission-denied'
                    ? '이 공간의 멤버만 공동 소비를 볼 수 있어요.'
                    : '네트워크 연결을 확인한 뒤 다시 시도해 주세요.'
                }
                onRetry={retryExpenses}
              />
            </View>
          ) : (
            <CalendarSharedExpenseList
              expenses={dayExpenses}
              members={membersState.members}
              accent={accent}
              loading={expensesLoading}
              onAdd={() => openExpenseForm(selectedDateKey)}
              onOpen={(expense) => {
                if (!spaceId) return;
                router.push({
                  pathname: '/spaces/[spaceId]/expense/[expenseId]',
                  params: { spaceId, expenseId: expense.id },
                });
              }}
            />
          )}
        </ScrollView>
      )}

      <SpaceEventDetailSheet
        event={detail}
        members={membersState.members}
        viewerUid={uid}
        accent={accent}
        onClose={() => setDetail(null)}
        onEdit={(event) => {
          setDetail(null);
          openForm(event.dateKey, event.id);
        }}
        onDelete={(event) => {
          if (!canMutateSpaceEvent(event.createdByUid, uid)) return;
          setDeleteTarget(event);
        }}
      />

      <ConfirmModal
        visible={deleteTarget != null}
        title={DELETE_EVENT_CONFIRM_TITLE}
        message={DELETE_EVENT_CONFIRM_MESSAGE}
        confirmLabel={DELETE_EVENT_CONFIRM_LABEL}
        cancelLabel="취소"
        destructive
        loading={deleteBusy}
        onCancel={() => {
          if (deleteGate.current.busy) return;
          setDeleteTarget(null);
        }}
        onConfirm={() => {
          if (!spaceId || !deleteTarget) return;
          if (!canMutateSpaceEvent(deleteTarget.createdByUid, uid)) return;
          if (!deleteGate.current.tryStart()) return;
          setDeleteBusy(true);
          const eventId = deleteTarget.id;
          void (async () => {
            try {
              await deleteSpaceEvent(spaceId, eventId);
              setDeleteTarget(null);
              setDetail(null);
            } catch (error) {
              showAlert('일정을 삭제하지 못했어요', toSpaceEventError(error, 'write').userMessage);
            } finally {
              deleteGate.current.end();
              setDeleteBusy(false);
            }
          })();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  stateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorWrap: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  listError: {
    marginTop: 20,
  },
});

const calendarMemoryStyles = StyleSheet.create({
  wrap: { marginTop: 22 },
  heading: { fontSize: 15, fontWeight: '800', marginBottom: 12 },
  state: { minHeight: 72, alignItems: 'center', justifyContent: 'center' },
  empty: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  emptyTitle: { fontSize: 15, fontWeight: '800' },
  addBtn: {
    marginTop: 12,
    minHeight: 40,
    borderRadius: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  addBtnText: { fontSize: 13, fontWeight: '800' },
  list: { gap: 8 },
  row: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowBody: { flex: 1, minWidth: 0 },
  title: { fontSize: 15, fontWeight: '800' },
  meta: { marginTop: 4, fontSize: 12, fontWeight: '600' },
});
