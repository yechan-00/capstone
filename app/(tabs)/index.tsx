import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
  Platform,
  Modal,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { ReviewActionCard } from '@/components/ReviewActionCard';
import { ReviewStatusCard } from '@/components/ReviewStatusCard';
import { ErrorRetryCard } from '@/components/ErrorRetryCard';
import { expenseService } from '@/services/expenseService';
import { ensureNotificationPermission } from '@/services/notificationService';
import { scheduleService } from '@/services/scheduleService';
import { getDaysUntil } from '@/utils/time';
import { toUserMessage } from '@/utils/error';
import { useTheme } from '@/theme/ThemeContext';
import type { Expense, ExpenseCategory, ScheduleType } from '@/lib/types';

export default function HomeScreen() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const isCompact = height < 760 || width < 420;
  const isWeb = Platform.OS === 'web';
  const calendarMaxWidth = Math.min(width - (isCompact ? 16 : 32), 980);
  const { user, account, loading: authLoading } = useAuth();
  const [expenses, setExpenses] = React.useState<Expense[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);
  const [pendingLoading, setPendingLoading] = React.useState(true);
  const [pendingError, setPendingError] = React.useState<unknown | null>(null);
  const [pendingItem, setPendingItem] = React.useState<{
    id: string;
    expenseId: string;
    dueType: ScheduleType;
    title?: string;
    amount?: number;
    dueAt?: Date;
  } | null>(null);
  const [nextDueInDays, setNextDueInDays] = React.useState<number | undefined>(undefined);
  const [currentMonth, setCurrentMonth] = React.useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const calendarRows = React.useMemo(
    () => Math.ceil(buildCalendarCells(currentMonth).length / 7),
    [currentMonth]
  );
  const calendarCellHeight = React.useMemo(() => {
    if (!isWeb) return isCompact ? 56 : 72;
    const reservedHeight = isCompact ? 340 : 380;
    const available = Math.floor((height - reservedHeight) / Math.max(1, calendarRows));
    return Math.max(isCompact ? 48 : 58, Math.min(isCompact ? 66 : 92, available));
  }, [calendarRows, height, isCompact, isWeb]);
  /** 날짜 탭 시 상세 모달에 표시할 날짜 (YYYY-MM-DD) */
  const [detailDayKey, setDetailDayKey] = React.useState<string | null>(null);
  const [reviewCollapsed, setReviewCollapsed] = React.useState(isCompact);
  /** 이번 달 소비 정산 카드만 접기 (캘린더는 항상 표시) */
  const [monthBreakdownCollapsed, setMonthBreakdownCollapsed] = React.useState(false);
  const lastFocusRefreshAtRef = React.useRef(0);
  const pendingBusyRef = React.useRef(false);
  const monthBusyRef = React.useRef(false);

  const isOffline = error?.message?.toLowerCase().includes('offline');
  const expenseMapByDay = React.useMemo(() => {
    const map = new Map<string, Expense[]>();
    for (const e of expenses) {
      const key = toDayKey(e.spentAt);
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    return map;
  }, [expenses]);
  const detailDayExpenses = detailDayKey ? expenseMapByDay.get(detailDayKey) ?? [] : [];
  const monthCategoryTotals = React.useMemo(() => summarizeMonthByCategory(expenses), [expenses]);
  const monthTotalAmount = monthCategoryTotals.total;
  const activeDaysCount = expenseMapByDay.size;

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/(auth)/login');
    }
  }, [user, authLoading]);

  useEffect(() => {
    ensureNotificationPermission();
  }, []);

  useEffect(() => {
    if (!account) {
      setExpenses([]);
      setLoading(false);
      setError(null);
      setPendingLoading(false);
      setPendingError(null);
      setPendingItem(null);
      setNextDueInDays(undefined);
      return;
    }
    void loadMonthExpenses(false);
    void loadPendingReview(false);
  }, [account, currentMonth]);

  useFocusEffect(
    React.useCallback(() => {
      if (!account) return;
      const now = Date.now();
      // 포커스가 짧은 간격으로 반복될 때 과도한 로딩 토글(깜빡임) 방지
      if (now - lastFocusRefreshAtRef.current < 1200) return;
      lastFocusRefreshAtRef.current = now;
      void loadPendingReview(true);
      void loadMonthExpenses(true);
    }, [account, currentMonth])
  );

  const loadMonthExpenses = async (silent: boolean): Promise<Expense[] | undefined> => {
    if (!account || monthBusyRef.current) return undefined;
    monthBusyRef.current = true;
    try {
      if (!silent) setLoading(true);
      setError(null);

      const start = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1, 0, 0, 0, 0);
      const end = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0, 23, 59, 59, 999);
      const data = await expenseService.getByAccountIdInRange(account.id, start, end);
      setExpenses(data);
      return data;
    } catch (err) {
      const e = err instanceof Error ? err : new Error('소비 목록을 불러오는데 실패했습니다.');
      setError(e);
      return undefined;
    } finally {
      if (!silent) setLoading(false);
      monthBusyRef.current = false;
    }
  };

  const loadPendingReview = async (silent: boolean) => {
    if (!account) return;
    if (pendingBusyRef.current) return;
    pendingBusyRef.current = true;
    try {
      if (!silent) setPendingLoading(true);
      setPendingError(null);
      const pendingSchedules = await scheduleService.getPendingSchedules(account.id);
      if (pendingSchedules.length > 0) {
        const schedule = pendingSchedules[0];
        const expense = await expenseService.getById(schedule.expenseId);
        setPendingItem({
          id: schedule.id,
          expenseId: schedule.expenseId,
          dueType: schedule.type,
          title: expense?.reason,
          amount: expense?.amount,
          dueAt: schedule.dueAt,
        });
        setNextDueInDays(undefined);
        return;
      }

      const upcoming = await scheduleService.getNextUpcomingSchedule(account.id);
      setPendingItem(null);
      setNextDueInDays(upcoming?.dueAt ? getDaysUntil(upcoming.dueAt) : undefined);
    } catch (err: unknown) {
      console.error('[pendingSchedules] load failed', err);
      setPendingError(err);
      setPendingItem(null);
      setNextDueInDays(undefined);
    } finally {
      if (!silent) setPendingLoading(false);
      pendingBusyRef.current = false;
    }
  };

  const handleReviewPress = async (schedule: { id: string; expenseId: string }) => {
    router.push({ pathname: '/review', params: { expenseId: schedule.expenseId, scheduleId: schedule.id } });
  };

  const handleExpensePress = (expenseId: string) => {
    router.push(`/expense/${expenseId}`);
  };

  const handleDeleteExpense = (expenseId: string, reasonPreview: string, dayKey: string | null) => {
    Alert.alert(
      '소비 삭제',
      `이 기록을 삭제할까요?\n연결된 리뷰·알림 예약도 함께 지워져요.\n\n${reasonPreview.slice(0, 80)}${reasonPreview.length > 80 ? '…' : ''}`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await expenseService.delete(expenseId);
                const data = await loadMonthExpenses(false);
                await loadPendingReview(false);
                if (dayKey && data && !data.some((e) => toDayKey(e.spentAt) === dayKey)) {
                  setDetailDayKey((k) => (k === dayKey ? null : k));
                }
              } catch (err: unknown) {
                console.error('[home] delete expense failed', err);
                Alert.alert('삭제 실패', '소비를 삭제하지 못했어요. 네트워크를 확인해 주세요.');
              }
            })();
          },
        },
      ]
    );
  };

  if (authLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  if (!user || !account) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {isOffline && (
        <View style={[styles.offlineBanner, { backgroundColor: colors.offlineBg, borderBottomColor: colors.offlineBorder }]}>
          <Text style={[styles.offlineText, { color: colors.offlineText }]}>네트워크 연결이 필요합니다</Text>
        </View>
      )}
      <View style={styles.reviewSection}>
        <View style={styles.reviewHeaderRow}>
          <Text style={[styles.reviewHeaderTitle, { color: colors.text }]}>리뷰 알림</Text>
          <Pressable onPress={() => setReviewCollapsed((v) => !v)}>
            <Text style={[styles.reviewToggleText, { color: colors.primary }]}>
              {reviewCollapsed ? '펼치기' : '접기'}
            </Text>
          </Pressable>
        </View>
        {reviewCollapsed ? (
          <View style={[styles.reviewCollapsedCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.reviewCollapsedText, { color: colors.textSec }]}>
              {pendingItem
                ? '평가할 리뷰 1건이 있어요'
                : nextDueInDays == null
                  ? '예정된 리뷰가 없어요'
                  : `다음 리뷰 D-${nextDueInDays}`}
            </Text>
          </View>
        ) : pendingLoading ? (
          pendingItem ? (
            <ReviewActionCard item={pendingItem} onPressReview={handleReviewPress} />
          ) : (
            <ReviewStatusCard nextDueInDays={undefined} notificationsEnabled />
          )
        ) : pendingError ? (
          <ErrorRetryCard
            title="평가 목록을 불러오지 못했어요"
            desc={toUserMessage(pendingError)}
            onRetry={() => {
              void loadPendingReview(false);
            }}
          />
        ) : pendingItem ? (
          <ReviewActionCard item={pendingItem} onPressReview={handleReviewPress} />
        ) : (
          <ReviewStatusCard nextDueInDays={nextDueInDays} notificationsEnabled />
        )}
      </View>

      <View style={styles.spendingHeader}>
        <Text style={[styles.spendingHeaderTitle, { color: colors.text }]}>소비 내역</Text>
      </View>
      <ScrollView contentContainerStyle={[styles.list, isCompact && styles.listCompact]}>
        <View
          style={[
            styles.breakdownCard,
            isCompact && styles.breakdownCardCompact,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.breakdownHeader}>
            <View style={styles.breakdownHeaderLeft}>
              <Text style={[styles.breakdownTitle, { color: colors.text }]}>이번 달 소비</Text>
              <Text style={[styles.breakdownSubtitle, { color: colors.textMuted }]}>{formatMonth(currentMonth)}</Text>
            </View>
            <View style={styles.breakdownHeaderRight}>
              <View style={[styles.daysPill, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
                <MaterialIcons name="calendar-today" size={14} color={colors.textSec} />
                <Text style={[styles.daysPillText, { color: colors.textSec }]}>기록 {activeDaysCount}일</Text>
              </View>
              <Pressable
                onPress={() => setMonthBreakdownCollapsed((v) => !v)}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                accessibilityRole="button"
                accessibilityLabel={monthBreakdownCollapsed ? '이번 달 소비 펼치기' : '이번 달 소비 접기'}
              >
                <Text style={[styles.breakdownToggleText, { color: colors.primary }]}>
                  {monthBreakdownCollapsed ? '펼치기' : '접기'}
                </Text>
              </Pressable>
            </View>
          </View>

          {monthBreakdownCollapsed ? (
            <Text style={[styles.breakdownCollapsedSummary, { color: colors.textSec }]} numberOfLines={2}>
              합계 {monthTotalAmount.toLocaleString()}원 · 외식(포장) {monthCategoryTotals.takeout.toLocaleString()}원 · 배달{' '}
              {monthCategoryTotals.delivery.toLocaleString()}원 · 카페 {monthCategoryTotals.cafe.toLocaleString()}원
            </Text>
          ) : (
            <>
              <View style={[styles.breakdownDivider, { backgroundColor: colors.border }]} />

              {(
                [
                  { key: 'takeout' as const, label: '외식(포장)', amount: monthCategoryTotals.takeout, cat: 'takeout' as ExpenseCategory },
                  { key: 'delivery' as const, label: '배달', amount: monthCategoryTotals.delivery, cat: 'delivery' as ExpenseCategory },
                  { key: 'cafe' as const, label: '카페', amount: monthCategoryTotals.cafe, cat: 'cafe' as ExpenseCategory },
                ] as const
              ).map((row) => (
                <View key={row.key} style={styles.breakdownRow}>
                  <View style={styles.breakdownRowLeft}>
                    <View style={[styles.breakdownDot, { backgroundColor: categoryAccent(row.cat) }]} />
                    <Text style={[styles.breakdownRowLabel, { color: colors.textSec }]}>{row.label}</Text>
                  </View>
                  <Text style={[styles.breakdownRowAmount, { color: colors.text }]}>{row.amount.toLocaleString()}원</Text>
                </View>
              ))}

              <View style={[styles.breakdownDividerBold, { backgroundColor: colors.border }]} />

              <View style={styles.breakdownTotalRow}>
                <Text style={[styles.breakdownTotalLabel, { color: colors.text }]}>합계</Text>
                <Text style={[styles.breakdownTotalAmount, { color: colors.primary }]}>{monthTotalAmount.toLocaleString()}원</Text>
              </View>
            </>
          )}
        </View>

        <View
          style={[
            styles.calendarCard,
            isCompact && styles.calendarCardCompact,
            { backgroundColor: colors.surface, borderColor: colors.border, maxWidth: calendarMaxWidth, alignSelf: 'center', width: '100%' },
          ]}
        >
          <View style={styles.monthHeader}>
            <Pressable onPress={() => {
              setDetailDayKey(null);
              setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
            }}>
              <Text style={[styles.monthNav, { color: colors.primary }]}>{'‹'}</Text>
            </Pressable>
            <Text style={[styles.monthTitle, { color: colors.text }]}>{formatMonth(currentMonth)}</Text>
            <View style={styles.monthHeaderRight}>
              <Pressable
                style={[styles.todayBtn, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
                onPress={() => {
                  const now = new Date();
                  setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                  setDetailDayKey(null);
                }}
              >
                <Text style={[styles.todayBtnText, { color: colors.textSec }]}>오늘</Text>
              </Pressable>
              <Pressable onPress={() => {
                setDetailDayKey(null);
                setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
              }}>
                <Text style={[styles.monthNav, { color: colors.primary }]}>{'›'}</Text>
              </Pressable>
            </View>
          </View>
          <View style={styles.weekRow}>
            {['일', '월', '화', '수', '목', '금', '토'].map((w) => (
              <Text key={w} style={[styles.weekText, { color: colors.textMuted }]}>{w}</Text>
            ))}
          </View>
          <View style={styles.grid}>
            {buildCalendarCells(currentMonth).map((cell, idx) => {
              if (!cell) return <View key={`empty-${idx}`} style={styles.dayCell} />;
              const key = toDayKey(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), cell));
              const dayExpenses = expenseMapByDay.get(key) ?? [];
              const count = dayExpenses.length;
              const active = detailDayKey === key;
              const today = key === toDayKey(new Date());
              const previewCount = isCompact ? 1 : 2;
              return (
                <Pressable
                  key={key}
                  style={[
                    styles.dayCell,
                    { minHeight: calendarCellHeight },
                    isCompact && styles.dayCellCompact,
                    active && { backgroundColor: colors.choiceActiveBg, borderRadius: 10, borderColor: colors.primary },
                    today && !active && { borderWidth: 1, borderColor: colors.primary, borderRadius: 10 },
                  ]}
                  onPress={() => setDetailDayKey(key)}
                >
                  <Text style={[styles.dayNum, isCompact && styles.dayNumCompact, { color: colors.text }]}>{cell}</Text>
                  <View style={styles.dayEvents}>
                    {dayExpenses.slice(0, previewCount).map((expense) => (
                      <View key={expense.id} style={[styles.eventPill, { backgroundColor: colors.choiceBg }]}>
                        <Text style={[styles.eventPillText, { color: colors.primary }]} numberOfLines={2}>
                          {formatExpenseCalendarLabel(expense)}
                        </Text>
                      </View>
                    ))}
                    {count > previewCount ? (
                      <Text style={[styles.morePillText, { color: colors.textMuted }]}>+{count - previewCount}</Text>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        {loading ? (
          <View style={styles.monthStateWrap}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : error ? (
          <View style={styles.monthStateWrap}>
            <ErrorRetryCard
              title="소비 목록을 불러오지 못했어요"
              desc={toUserMessage(error)}
              onRetry={() => {
                void loadMonthExpenses(false);
              }}
            />
          </View>
        ) : null}
      </ScrollView>

      <Modal
        visible={detailDayKey !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setDetailDayKey(null)}
      >
        <View style={[styles.modalRoot, { backgroundColor: isDark ? 'rgba(0,0,0,0.55)' : 'rgba(15,23,42,0.42)' }]}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setDetailDayKey(null)} accessibilityRole="button" accessibilityLabel="닫기" />
          <View
            style={[styles.modalCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            pointerEvents="box-none"
          >
            <View style={styles.modalCardInner}>
              <View style={styles.modalHeaderRow}>
                <Text style={[styles.modalHeaderTitle, { color: colors.text }]} numberOfLines={1}>
                  {detailDayKey ? formatDetailDayHeading(detailDayKey) : ''}
                </Text>
                <Pressable
                  onPress={() => setDetailDayKey(null)}
                  hitSlop={12}
                  style={[styles.modalCloseBtn, { backgroundColor: colors.surfaceMuted }]}
                  accessibilityRole="button"
                  accessibilityLabel="닫기"
                >
                  <MaterialIcons name="close" size={22} color={colors.textSec} />
                </Pressable>
              </View>
              <Text style={[styles.modalSub, { color: colors.textMuted }]}>
                {detailDayExpenses.length > 0 ? `${detailDayExpenses.length}건` : '기록 없음'}
              </Text>

              {detailDayExpenses.length === 0 ? (
                <View style={styles.modalEmpty}>
                  <MaterialIcons name="event-available" size={40} color={colors.emptyIcon} />
                  <Text style={[styles.modalEmptyText, { color: colors.textSec }]}>
                    이 날짜에 등록된 소비가 없어요.
                  </Text>
                </View>
              ) : (
                <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
                  {detailDayExpenses.map((item, index) => (
                    <View key={item.id}>
                      {index > 0 ? <View style={[styles.modalBlockDivider, { backgroundColor: colors.border }]} /> : null}
                      <Pressable onPress={() => handleExpensePress(item.id)}>
                        <View style={styles.modalEventTitleRow}>
                          <View style={[styles.modalDot, { backgroundColor: categoryAccent(item.category) }]} />
                          <Text style={[styles.modalEventTitle, { color: colors.text }]} numberOfLines={2}>
                            {(item.item ?? item.content ?? item.reason ?? '소비').trim()}
                          </Text>
                        </View>
                      </Pressable>

                      <View style={[styles.modalField, { borderBottomColor: colors.border }]}>
                        <Text style={[styles.modalFieldLabel, { color: colors.textMuted }]}>날짜 및 시간</Text>
                        <Text style={[styles.modalFieldValue, { color: colors.textSec }]}>{formatKoreanSpentAt(item.spentAt)}</Text>
                      </View>
                      <View style={[styles.modalField, { borderBottomColor: colors.border }]}>
                        <Text style={[styles.modalFieldLabel, { color: colors.textMuted }]}>금액</Text>
                        <Text style={[styles.modalFieldValue, { color: colors.text }]}>
                          {Number(item.amount).toLocaleString()}원
                        </Text>
                      </View>
                      <View style={[styles.modalField, { borderBottomColor: colors.border }]}>
                        <Text style={[styles.modalFieldLabel, { color: colors.textMuted }]}>카테고리</Text>
                        <Text style={[styles.modalFieldValue, { color: colors.textSec }]}>
                          {expenseCategoryLine(item.category)}
                        </Text>
                      </View>
                      {(item.reason?.trim() || item.summaryLine?.trim()) ? (
                        <View style={[styles.modalField, { borderBottomColor: colors.border }]}>
                          <Text style={[styles.modalFieldLabel, { color: colors.textMuted }]}>메모</Text>
                          <Text style={[styles.modalFieldValue, { color: colors.textSec }]}>
                            {[item.reason?.trim(), item.summaryLine?.trim()].filter(Boolean).join('\n')}
                          </Text>
                        </View>
                      ) : null}

                      <View style={styles.modalActions}>
                        <Pressable
                          onPress={() => handleExpensePress(item.id)}
                          style={[styles.modalGhostBtn, { borderColor: colors.border }]}
                        >
                          <Text style={[styles.modalGhostBtnText, { color: colors.primary }]}>상세 보기</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => handleDeleteExpense(item.id, item.reason, detailDayKey)}
                          style={[styles.modalGhostBtn, { borderColor: colors.logoutBorder }]}
                        >
                          <Text style={[styles.modalGhostBtnText, { color: colors.logoutText }]}>삭제</Text>
                        </Pressable>
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function toDayKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 이번 달 지출을 외식(포장)·배달·카페로 합산 (레거시 food는 포장 외식에 포함) */
function summarizeMonthByCategory(expenses: Expense[]): {
  takeout: number;
  delivery: number;
  cafe: number;
  total: number;
} {
  let takeout = 0;
  let delivery = 0;
  let cafe = 0;
  for (const e of expenses) {
    const amt = Number(e.amount) || 0;
    if (e.category === 'delivery') delivery += amt;
    else if (e.category === 'cafe') cafe += amt;
    else takeout += amt;
  }
  return { takeout, delivery, cafe, total: takeout + delivery + cafe };
}

function formatMonth(date: Date) {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월`;
}

function formatDetailDayHeading(dayKey: string): string {
  const [ys, ms, ds] = dayKey.split('-');
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  if (!y || !m || !d) return dayKey;
  const dt = new Date(y, m - 1, d);
  const w = ['일', '월', '화', '수', '목', '금', '토'][dt.getDay()];
  return `${y}년 ${m}월 ${d}일 (${w})`;
}

function formatKoreanSpentAt(date: Date): string {
  const hour = date.getHours();
  const minute = date.getMinutes();
  const period = hour >= 12 ? '오후' : '오전';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const mm = String(minute).padStart(2, '0');
  return `${date.getFullYear()}. ${date.getMonth() + 1}. ${date.getDate()}. ${period} ${h12}:${mm}`;
}

function expenseCategoryLine(category: ExpenseCategory): string {
  switch (category) {
    case 'delivery':
      return '외식(배달)';
    case 'cafe':
      return '외식(카페)';
    case 'takeout':
    case 'food':
    default:
      return '외식(포장)';
  }
}

function categoryAccent(category: ExpenseCategory): string {
  switch (category) {
    case 'delivery':
      return '#22c55e';
    case 'cafe':
      return '#ca8a04';
    case 'takeout':
    case 'food':
    default:
      return '#ea580c';
  }
}

function formatExpenseCalendarLabel(expense: Expense): string {
  const amount = Number(expense.amount) || 0;
  return `${amount.toLocaleString()}원, ${expenseCategoryLine(expense.category)}`;
}

function buildCalendarCells(currentMonth: Date): Array<number | null> {
  const first = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const cells: Array<number | null> = [];
  for (let i = 0; i < first.getDay(); i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },
  spendingHeaderTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.3 },
  reviewSection: {
    marginTop: 16,
    marginHorizontal: 16,
  },
  reviewHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  reviewHeaderTitle: { fontSize: 13, fontWeight: '800' },
  reviewToggleText: { fontSize: 12, fontWeight: '800' },
  reviewCollapsedCard: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  reviewCollapsedText: { fontSize: 13, fontWeight: '700' },
  list: {
    padding: 16,
    paddingBottom: 120,
    gap: 12,
  },
  listCompact: {
    paddingTop: 8,
    paddingBottom: 82,
    gap: 8,
  },
  calendarCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
  },
  calendarCardCompact: {
    borderRadius: 12,
    padding: 8,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  monthHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  todayBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  todayBtnText: { fontSize: 11, fontWeight: '700' },
  monthNav: { fontSize: 24, fontWeight: '700', paddingHorizontal: 10 },
  monthTitle: { fontSize: 16, fontWeight: '900' },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekText: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: {
    width: '14.285%',
    borderWidth: 0.5,
    borderColor: '#E5E7EB',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  dayCellCompact: {
    paddingHorizontal: 3,
    paddingVertical: 3,
  },
  dayNum: { fontSize: 13, fontWeight: '800', marginBottom: 3, alignSelf: 'flex-start' },
  dayNumCompact: { fontSize: 12 },
  dayEvents: { gap: 2, width: '100%' },
  eventPill: {
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  eventPillText: {
    fontSize: 10,
    fontWeight: '700',
  },
  morePillText: {
    fontSize: 10,
    fontWeight: '700',
    paddingLeft: 2,
  },
  breakdownCard: {
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  breakdownCardCompact: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  breakdownHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    flexWrap: 'wrap',
  },
  breakdownHeaderLeft: { flex: 1, minWidth: 0 },
  breakdownHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  },
  breakdownTitle: { fontSize: 17, fontWeight: '900', letterSpacing: -0.3 },
  breakdownSubtitle: { marginTop: 3, fontSize: 12, fontWeight: '600' },
  breakdownToggleText: { fontSize: 12, fontWeight: '800' },
  breakdownCollapsedSummary: {
    marginTop: 10,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 18,
  },
  daysPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexShrink: 0,
  },
  daysPillText: { fontSize: 12, fontWeight: '800' },
  breakdownDivider: {
    height: StyleSheet.hairlineWidth,
    marginTop: 12,
    marginBottom: 4,
  },
  breakdownDividerBold: {
    height: StyleSheet.hairlineWidth,
    marginTop: 4,
    marginBottom: 10,
  },
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 9,
    gap: 10,
  },
  breakdownRowLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 },
  breakdownDot: { width: 8, height: 8, borderRadius: 4 },
  breakdownRowLabel: { fontSize: 14, fontWeight: '700', flexShrink: 1 },
  breakdownRowAmount: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
    flexShrink: 0,
    ...Platform.select({ ios: { fontVariant: ['tabular-nums' as const] }, default: {} }),
  },
  breakdownTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  breakdownTotalLabel: { fontSize: 15, fontWeight: '900' },
  breakdownTotalAmount: {
    fontSize: 18,
    fontWeight: '900',
    letterSpacing: -0.4,
    flexShrink: 0,
    ...Platform.select({ ios: { fontVariant: ['tabular-nums' as const] }, default: {} }),
  },
  monthStateWrap: {
    minHeight: 80,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
  },
  modalRoot: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: 24,
  },
  modalCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
    maxHeight: '82%',
    overflow: 'hidden',
    marginHorizontal: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 12,
  },
  modalCardInner: {
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  modalHeaderTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalSub: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
  },
  modalScroll: {
    marginTop: 14,
    maxHeight: 420,
  },
  modalEmpty: {
    alignItems: 'center',
    paddingVertical: 28,
    gap: 10,
  },
  modalEmptyText: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  modalBlockDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 14,
  },
  modalEventTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
  },
  modalDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
  },
  modalEventTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 22,
  },
  modalField: {
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalFieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 4,
  },
  modalFieldValue: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  modalActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  modalGhostBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  modalGhostBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 16,
    marginBottom: 16,
  },
  offlineBanner: {
    backgroundColor: '#FFF3CD',
    borderBottomWidth: 1,
    borderBottomColor: '#FFE69C',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  offlineText: {
    color: '#856404',
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  addFirstButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addFirstText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
