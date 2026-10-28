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
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { useRegretPatternAlertSync } from '@/hooks/useRegretPatternAlertSync';
import { useRefreshPendingReviewCountOnFocus } from '@/hooks/usePendingReviewCount';
import { ErrorRetryCard } from '@/components/ErrorRetryCard';
import { HomeRegretAnalysisCard } from '@/components/home/HomeRegretAnalysisCard';
import { HomeRegretPatternCard } from '@/components/home/HomeRegretPatternCard';
import { HomeRegretPatternAlertSheet } from '@/components/home/HomeRegretPatternAlertSheet';
import { HomeCompactSpendingSummary } from '@/components/home/HomeCompactSpendingSummary';
import { PhotoCalendarDayCell } from '@/components/home/PhotoCalendarDayCell';
import { HomeDayExpenseModal } from '@/components/home/HomeDayExpenseModal';
import { ShareNotificationsModal } from '@/components/ShareNotificationsModal';
import { expenseService } from '@/services/expenseService';
import { reviewService } from '@/services/reviewService';
import {
  ensureNotificationPermission,
  getNotificationPermissionKind,
  type NotificationPermissionKind,
} from '@/services/notificationService';
import { scheduleService } from '@/services/scheduleService';
import { userNotificationService } from '@/services/userNotificationService';
import { toUserMessage } from '@/utils/error';
import { BRAND_GREEN, useTheme } from '@/theme/ThemeContext';


import type { Expense, Review, ReviewSchedule } from '@/lib/types';
import { categoryDisplay } from '@/lib/expenseOptions';
import {
  budgetPeriodForMonth,
  currentBudgetPeriod,
  formatBudgetPeriodRange,
  isPaydayCell,
  resolveBudgetPeriodMode,
  toFoodBudgetKrw,
} from '@/lib/budgetPeriod';
import { buildHomeRegretPatternView, type HomeRegretPatternView } from '@/lib/regretPatternAlert';
import { loadAllTimePatternInsights } from '@/services/regretPatternAlertService';
import {
  buildCalendarCells,
  buildHomeRegretSummary,
  formatMonth,
  sortExpensesForCalendarCells,
  summarizeMonthByCategory,
  toDayKey,
} from '@/lib/homeCalendar';

export default function HomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { width, height } = useWindowDimensions();
  const isCompact = height < 760 || width < 420;
  const isWeb = Platform.OS === 'web';
  const calendarMaxWidth = Math.min(width - (isCompact ? 16 : 32), 980);
  const { user, account, loading: authLoading } = useAuth();
  const [expenses, setExpenses] = React.useState<Expense[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<Error | null>(null);
  const [currentMonth, setCurrentMonth] = React.useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const calendarCells = React.useMemo(() => buildCalendarCells(currentMonth), [currentMonth]);
  const calendarRows = React.useMemo(() => Math.ceil(calendarCells.length / 7), [calendarCells]);
  const calendarCellHeight = React.useMemo(() => {
    // dateRow 21 + gap 3 + card + cell padding (compact 4 / regular 6)
    if (!isWeb) return isCompact ? 74 : 82;
    const reservedHeight = isCompact ? 340 : 380;
    const available = Math.floor((height - reservedHeight) / Math.max(1, calendarRows));
    return Math.max(isCompact ? 72 : 78, Math.min(isCompact ? 76 : 84, available));
  }, [calendarRows, height, isCompact, isWeb]);
  /** 날짜 탭 시 상세 모달에 표시할 날짜 (YYYY-MM-DD) */
  const [detailDayKey, setDetailDayKey] = React.useState<string | null>(null);
  const [regretPatternStatus, setRegretPatternStatus] = React.useState<'loading' | 'error' | 'ready'>(
    'loading',
  );
  const [regretPatternView, setRegretPatternView] = React.useState<HomeRegretPatternView | null>(null);
  const [patternAlertSheetOpen, setPatternAlertSheetOpen] = React.useState(false);
  const [notificationPermission, setNotificationPermission] = React.useState<
    NotificationPermissionKind | 'loading'
  >(Platform.OS === 'web' ? 'unknown' : 'loading');
  /** 지출 ID → 해당 지출의 가장 최근 리뷰 (캘린더 감성 색) */
  const [reviewsByExpenseId, setReviewsByExpenseId] = React.useState<Map<string, Review>>(() => new Map());
  /** 지출 ID → pending·expired 리뷰 스케줄 (홈/상세와 동일한 상태 계산용) */
  const [reviewSchedulesByExpenseId, setReviewSchedulesByExpenseId] = React.useState<
    Map<string, ReviewSchedule[]>
  >(() => new Map());
  const [unreadCommentsByExpenseId, setUnreadCommentsByExpenseId] = React.useState<Map<string, number>>(
    () => new Map(),
  );
  const [notificationsOpen, setNotificationsOpen] = React.useState(false);
  const [headerScrolled, setHeaderScrolled] = React.useState(false);
  const headerScrolledRef = React.useRef(false);
  const handleHomeScroll = React.useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = event.nativeEvent.contentOffset.y > 2;
    if (next === headerScrolledRef.current) return;
    headerScrolledRef.current = next;
    setHeaderScrolled(next);
  }, []);
  const lastFocusRefreshAtRef = React.useRef(0);
  /** 월 이동·중복 요청 시 이전 응답이 state를 덮어쓰지 않도록 */
  const loadSeqRef = React.useRef(0);
  const viewingMonthRef = React.useRef(currentMonth);

  React.useEffect(() => {
    viewingMonthRef.current = currentMonth;
  }, [currentMonth]);

  const budgetPeriod = React.useMemo(() => {
    if (!account) {
      return budgetPeriodForMonth(currentMonth.getFullYear(), currentMonth.getMonth(), null);
    }
    const now = new Date();
    const viewingCurrentMonth =
      currentMonth.getFullYear() === now.getFullYear() &&
      currentMonth.getMonth() === now.getMonth();
    if (resolveBudgetPeriodMode(account) === 'payday' && viewingCurrentMonth) {
      return currentBudgetPeriod(account, now);
    }
    return budgetPeriodForMonth(currentMonth.getFullYear(), currentMonth.getMonth(), account);
  }, [currentMonth, account?.budgetPeriodMode, account?.paydayDayOfMonth, account]);

  const calendarExpenses = React.useMemo(() => {
    const y = currentMonth.getFullYear();
    const m = currentMonth.getMonth();
    return expenses.filter((e) => e.spentAt.getFullYear() === y && e.spentAt.getMonth() === m);
  }, [expenses, currentMonth]);

  const previousMonthExpenses = React.useMemo(() => {
    const previous = new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1);
    return expenses.filter(
      (expense) =>
        expense.spentAt.getFullYear() === previous.getFullYear() &&
        expense.spentAt.getMonth() === previous.getMonth(),
    );
  }, [expenses, currentMonth]);

  const homeRegretSummary = React.useMemo(
    () =>
      buildHomeRegretSummary(
        calendarExpenses,
        previousMonthExpenses,
        reviewsByExpenseId,
        currentMonth,
      ),
    [calendarExpenses, previousMonthExpenses, reviewsByExpenseId, currentMonth],
  );

  const periodExpenses = React.useMemo(
    () => expenses.filter((e) => e.spentAt >= budgetPeriod.start && e.spentAt <= budgetPeriod.end),
    [expenses, budgetPeriod],
  );

  const isOffline = error?.message?.toLowerCase().includes('offline');
  const expenseMapByDay = React.useMemo(() => {
    const map = new Map<string, Expense[]>();
    for (const e of calendarExpenses) {
      const key = toDayKey(e.spentAt);
      const arr = map.get(key) ?? [];
      arr.push(e);
      map.set(key, arr);
    }
    return map;
  }, [calendarExpenses]);

  const sortedExpensesByDayKey = React.useMemo(() => {
    const out = new Map<string, Expense[]>();
    expenseMapByDay.forEach((raw, k) => {
      out.set(k, sortExpensesForCalendarCells(raw));
    });
    return out;
  }, [expenseMapByDay]);

  const detailDayExpenses = React.useMemo(() => {
    if (!detailDayKey) return [];
    return sortedExpensesByDayKey.get(detailDayKey) ?? [];
  }, [detailDayKey, sortedExpensesByDayKey]);

  const monthCategoryTotals = React.useMemo(() => summarizeMonthByCategory(periodExpenses), [periodExpenses]);
  const monthTotalAmount = monthCategoryTotals.total;
  const foodBudgetKrw = account ? toFoodBudgetKrw(account) : 0;
  useRegretPatternAlertSync(account, `${expenses.length}:${reviewsByExpenseId.size}`);
  useRefreshPendingReviewCountOnFocus();
  const loadCommentNotifications = React.useCallback(async () => {
    if (!user?.uid) {
      setUnreadCommentsByExpenseId(new Map());
      return;
    }
    try {
      const notifications = await userNotificationService.listForUser(user.uid);
      const next = new Map<string, number>();
      notifications.forEach((notification) => {
        if (!notification.read && notification.expenseId) {
          next.set(notification.expenseId, (next.get(notification.expenseId) ?? 0) + 1);
        }
      });
      setUnreadCommentsByExpenseId(next);
    } catch {
      setUnreadCommentsByExpenseId(new Map());
    }
  }, [user?.uid]);

  const handleShareUnreadChange = React.useCallback(() => {
    void loadCommentNotifications();
  }, [loadCommentNotifications]);

  const handleShareNotificationsClose = React.useCallback(() => {
    setNotificationsOpen(false);
    void loadCommentNotifications();
  }, [loadCommentNotifications]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(Platform.OS === 'web' ? '/home' : '/(auth)/login');
    }
  }, [user, authLoading]);

  useEffect(() => {
    ensureNotificationPermission();
  }, []);

  useEffect(() => {
    if (!account) {
      setExpenses([]);
      setReviewsByExpenseId(new Map());
      setReviewSchedulesByExpenseId(new Map());
      setUnreadCommentsByExpenseId(new Map());
      setLoading(false);
      setError(null);
      return;
    }
    void loadMonthExpenses(false);
  }, [account, currentMonth]);

  /** 날짜 모달을 열 때 해당 날 지출의 최신 리뷰를 다시 읽어 캘린더와 동일한 감성 배경이 적용되게 함 */
  React.useEffect(() => {
    if (!account?.id || !detailDayKey) return;
    const list = expenseMapByDay.get(detailDayKey);
    if (!list?.length) return;
    let cancelled = false;
    void (async () => {
      try {
        const ids = list.map((e) => e.id);
        const [fresh, schedMap] = await Promise.all([
          reviewService.getLatestByExpenseIds(account.id, ids),
          scheduleService.getActiveSchedulesByExpenseIds(account.id, ids),
        ]);
        if (cancelled) return;
        setReviewsByExpenseId((prev) => {
          const next = new Map(prev);
          fresh.forEach((rev, expenseId) => next.set(expenseId, rev));
          return next;
        });
        setReviewSchedulesByExpenseId((prev) => {
          const next = new Map(prev);
          ids.forEach((expenseId) => {
            next.set(expenseId, schedMap.get(expenseId) ?? []);
          });
          return next;
        });
      } catch {
        /* 기존 맵 유지 */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [detailDayKey, account?.id, expenseMapByDay]);

  // ref에 최신 함수 항상 동기화
  React.useEffect(() => {
    loadMonthExpensesRef.current = loadMonthExpenses;
  });

  // globalThis에 노출 — _layout.tsx에서 저장 후 즉시 호출
  React.useEffect(() => {
    (globalThis as any).__reloadHomeExpenses = () => {
      loadMonthExpensesRef.current?.(true);
    };
    return () => { delete (globalThis as any).__reloadHomeExpenses; };
  }, []);

  const refreshNotificationPermission = React.useCallback(() => {
    if (Platform.OS === 'web') {
      setNotificationPermission('unknown');
      return;
    }
    void getNotificationPermissionKind().then(setNotificationPermission);
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      refreshNotificationPermission();
    }, [refreshNotificationPermission]),
  );

  useFocusEffect(
    React.useCallback(() => {
      if (!account) return;
      const now = Date.now();
      // 포커스가 짧은 간격으로 반복될 때 과도한 로딩 토글(깜빡임) 방지
      if (now - lastFocusRefreshAtRef.current < 1200) return;
      lastFocusRefreshAtRef.current = now;
      void loadMonthExpensesRef.current?.(true);
      void loadAllTimePatternInsights(account.id)
        .then(({ weekdayInsights, timeOfDayInsights }) => {
          setRegretPatternView(buildHomeRegretPatternView(weekdayInsights, timeOfDayInsights));
          setRegretPatternStatus('ready');
        })
        .catch(() => {
          setRegretPatternStatus((prev) => (prev === 'ready' ? 'ready' : 'error'));
        });
      void loadCommentNotifications();
    }, [account, loadCommentNotifications])
  );

const loadMonthExpensesRef = React.useRef<((silent: boolean) => Promise<any>) | null>(null);

  const isStaleMonthLoad = (seq: number, month: Date) => {
    const viewing = viewingMonthRef.current;
    return (
      seq !== loadSeqRef.current ||
      month.getFullYear() !== viewing.getFullYear() ||
      month.getMonth() !== viewing.getMonth()
    );
  };

  const loadMonthExpenses = async (silent: boolean): Promise<Expense[] | undefined> => {
    if (!account) return undefined;
    const seq = ++loadSeqRef.current;
    const monthSnapshot = new Date(viewingMonthRef.current.getTime());
    try {
      if (!silent) setLoading(true);
      setError(null);

      const y = monthSnapshot.getFullYear();
      const m = monthSnapshot.getMonth();
      const calStart = new Date(y, m, 1, 0, 0, 0, 0);
      const calEnd = new Date(y, m + 1, 0, 23, 59, 59, 999);
      const previousMonthStart = new Date(y, m - 1, 1, 0, 0, 0, 0);
      const period = budgetPeriodForMonth(y, m, account);
      const start = new Date(
        Math.min(previousMonthStart.getTime(), calStart.getTime(), period.start.getTime()),
      );
      const end = new Date(Math.max(calEnd.getTime(), period.end.getTime()));
      const data = await expenseService.getByAccountIdInRange(account.id, start, end);
      if (isStaleMonthLoad(seq, monthSnapshot)) return undefined;
      setExpenses(data);

      try {
        const revMap = await reviewService.getLatestByExpenseIds(
          account.id,
          data.map((e) => e.id),
        );
        if (isStaleMonthLoad(seq, monthSnapshot)) return data;
        setReviewsByExpenseId(revMap);
      } catch (reviewErr) {
        console.warn('[home] reviews load failed', reviewErr);
      }

      try {
        const schedMap = await scheduleService.getActiveSchedulesByExpenseIds(
          account.id,
          data.map((e) => e.id),
        );
        if (isStaleMonthLoad(seq, monthSnapshot)) return data;
        setReviewSchedulesByExpenseId(schedMap);
      } catch (scheduleErr) {
        console.warn('[home] review schedules load failed', scheduleErr);
      }

      return data;
    } catch (err) {
      if (isStaleMonthLoad(seq, monthSnapshot)) return undefined;
      const e = err instanceof Error ? err : new Error('소비 목록을 불러오는데 실패했습니다.');
      setError(e);
      setReviewsByExpenseId(new Map());
      setReviewSchedulesByExpenseId(new Map());
      return undefined;
    } finally {
      // silent 여부와 관계없이 «가장 최신» 요청이 끝나면 로딩 해제
      // (silent가 non-silent를 덮어쓴 뒤 loading이 true에 갇히는 문제 방지)
      if (seq === loadSeqRef.current) setLoading(false);
    }
  };

  const openReviewForExpense = (expenseId: string, scheduleId: string) => {
    setDetailDayKey(null);
    router.push({ pathname: '/review', params: { expenseId, scheduleId } });
  };

  const handleExpensePress = (expenseId: string) => {
    setDetailDayKey(null);
    setTimeout(() => router.push(`/expense/${expenseId}`), 150);
  };

  const handleEditExpense = (expenseId: string) => {
    setDetailDayKey(null);
    setTimeout(() => router.push(`/edit-expense/${expenseId}`), 150);
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
                (globalThis as { __reloadPendingReviewCount?: () => void }).__reloadPendingReviewCount?.();
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
        <ActivityIndicator size="large" color={BRAND_GREEN} />
      </View>
    );
  }

  if (!user || !account) {
    return null;
  }

  const todayKey = toDayKey(new Date());

  const cardElev =
    !isDark && Platform.OS !== 'web'
      ? {
          shadowColor: '#20352B',
          shadowOffset: { width: 0, height: 5 },
          shadowOpacity: 0.06,
          shadowRadius: 14,
          elevation: 4,
        }
      : {};

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View
        style={[
          styles.homeHeader,
          isCompact && styles.homeHeaderCompact,
          {
            paddingTop: Math.max(insets.top, 12) + 8,
            backgroundColor: colors.bg,
            borderBottomColor: headerScrolled ? colors.headerDivider : 'transparent',
          },
        ]}
      >
        <View style={styles.homeTopBar}>
          <View>
            <Text style={[styles.homeEyebrow, { color: colors.text }]}>REGRET WALLET</Text>
            <Text style={[styles.homeGreeting, { color: colors.text }]}>나의 후회 기록</Text>
          </View>
          <Pressable
            onPress={() => setNotificationsOpen(true)}
            hitSlop={10}
            style={[styles.notificationButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel="댓글 알림 열기"
          >
            <MaterialIcons name="notifications-none" size={24} color={colors.textSec} />
            {unreadCommentsByExpenseId.size > 0 ? <View style={styles.notificationDot} /> : null}
          </Pressable>
        </View>
      </View>
      {isOffline && (
        <View style={[styles.offlineBanner, { backgroundColor: colors.offlineBg, borderBottomColor: colors.offlineBorder }]}>
          <Text style={[styles.offlineText, { color: colors.offlineText }]}>네트워크 연결이 필요합니다</Text>
        </View>
      )}
      <ScrollView
        contentContainerStyle={[
          styles.list,
          isCompact && styles.listCompact,
          styles.listBelowHeader,
          isCompact && styles.listBelowHeaderCompact,
        ]}
        onScroll={handleHomeScroll}
        scrollEventThrottle={32}
      >
        <HomeRegretAnalysisCard
          rate={homeRegretSummary.rate}
          deltaPp={homeRegretSummary.deltaPp}
          dailyPoints={homeRegretSummary.dailyPoints}
          regretCount={homeRegretSummary.regretCount}
          reviewCount={homeRegretSummary.reviewCount}
        />

        <View
          style={[
            styles.calendarCard,
            isCompact && styles.calendarCardCompact,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
              maxWidth: calendarMaxWidth,
              alignSelf: 'center',
              width: '100%',
            },
            cardElev,
          ]}
        >
          <View style={styles.monthHeader}>
            <Pressable
              onPress={() => {
                setDetailDayKey(null);
                setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
              }}
              hitSlop={8}
            >
              <MaterialIcons name="chevron-left" size={28} color={colors.text} />
            </Pressable>
            <Text style={[styles.monthTitle, { color: colors.text }]}>{formatMonth(currentMonth)}</Text>
            <View style={styles.monthHeaderRight}>
              <Pressable
                style={[styles.todayBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
                onPress={() => {
                  const now = new Date();
                  setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                  setDetailDayKey(null);
                }}
              >
                <Text style={[styles.todayBtnText, { color: colors.textSec }]}>오늘</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setDetailDayKey(null);
                  setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
                }}
                hitSlop={8}
              >
                <MaterialIcons name="chevron-right" size={28} color={colors.text} />
              </Pressable>
            </View>
          </View>
          <View style={styles.weekRow}>
            {['일', '월', '화', '수', '목', '금', '토'].map((w, i) => (
              <Text
                key={w}
                style={[
                  styles.weekText,
                  {
                    color:
                      i === 0 ? '#C47A7A' : i === 6 ? '#7A8A94' : colors.textSec,
                  },
                ]}
              >
                {w}
              </Text>
            ))}
          </View>
          <View style={styles.grid}>
            {calendarCells.map((cell, idx) => {
              if (!cell) {
                return <View key={`empty-${idx}`} style={[styles.dayCell, { minHeight: calendarCellHeight }]} />;
              }
              const key = toDayKey(new Date(currentMonth.getFullYear(), currentMonth.getMonth(), cell));
              const dayExpenses = sortedExpensesByDayKey.get(key) ?? [];
              const active = detailDayKey === key;
              const today = key === todayKey;
              const dow = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), cell).getDay();
              const isSun = dow === 0;
              const isSat = dow === 6;
              return (
                <PhotoCalendarDayCell
                  key={key}
                  day={cell}
                  expenses={dayExpenses}
                  reviewsByExpenseId={reviewsByExpenseId}
                  unreadCommentsByExpenseId={unreadCommentsByExpenseId}
                  selected={active}
                  today={today}
                  payday={isPaydayCell(currentMonth.getFullYear(), currentMonth.getMonth(), cell, account)}
                  sunday={isSun}
                  saturday={isSat}
                  compact={isCompact}
                  minHeight={calendarCellHeight}
                  onPress={() => setDetailDayKey(key)}
                />
              );
            })}
          </View>
        </View>

        <HomeRegretPatternCard
          status={regretPatternStatus}
          view={regretPatternView}
          account={account}
          permission={notificationPermission}
          elevation={cardElev}
          onPress={() => {
            if (!patternAlertSheetOpen) setPatternAlertSheetOpen(true);
          }}
        />

        <HomeRegretPatternAlertSheet
          visible={patternAlertSheetOpen}
          onClose={() => setPatternAlertSheetOpen(false)}
          account={account}
          view={regretPatternView}
          patternStatus={regretPatternStatus}
          permission={notificationPermission}
          onPermissionRefresh={refreshNotificationPermission}
        />

        <HomeCompactSpendingSummary
          periodLabel={formatBudgetPeriodRange(budgetPeriod.start, budgetPeriod.end)}
          totalAmount={monthTotalAmount}
          budgetKrw={foodBudgetKrw}
          expenseCount={periodExpenses.length}
          categories={(['takeout', 'delivery', 'cafe'] as const).map((key) => {
            const display = categoryDisplay(key);
            return {
              label: display?.label ?? key,
              amount: monthCategoryTotals[key],
              emoji: display?.emoji ?? '',
            };
          })}
        />

        {loading ? (
          <View style={styles.monthStateWrap}>
            <ActivityIndicator size="large" color={BRAND_GREEN} />
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

      {detailDayKey !== null ? (
        <HomeDayExpenseModal
          dayKey={detailDayKey}
          expenses={detailDayExpenses}
          reviewsByExpenseId={reviewsByExpenseId}
          reviewSchedulesByExpenseId={reviewSchedulesByExpenseId}
          onClose={() => setDetailDayKey(null)}
          onOpenExpense={handleExpensePress}
          onEditExpense={handleEditExpense}
          onDeleteExpense={handleDeleteExpense}
          onReviewExpense={openReviewForExpense}
          onAddExpense={() => {
            setDetailDayKey(null);
            router.push('/add-expense');
          }}
        />
      ) : null}

      <ShareNotificationsModal
        visible={notificationsOpen}
        userId={user.uid}
        onClose={handleShareNotificationsClose}
        onUnreadChange={handleShareUnreadChange}
      />
    </View>
  );
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
  /** 기존 스크롤 안 상단 바와 같은 위치·간격: 좌우 16, 아래 marginBottom 4 + gap 절반 */
  homeHeader: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  homeHeaderCompact: { paddingBottom: 8 },
  homeTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  listBelowHeader: { paddingTop: 6 },
  listBelowHeaderCompact: { paddingTop: 4 },
  homeEyebrow: {
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 1,
  },
  homeGreeting: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
    lineHeight: 28,
  },
  notificationButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  notificationDot: {
    position: 'absolute',
    right: 8,
    top: 7,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F05252',
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
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
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    padding: 12,
    paddingBottom: 8,
  },
  calendarCardCompact: {
    borderRadius: 12,
    padding: 8,
    paddingBottom: 6,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  monthHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  todayBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  todayBtnText: { fontSize: 11, fontWeight: '700' },
  monthTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.3 },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekText: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: {
    width: '14.285%',
    alignItems: 'center',
    paddingHorizontal: 2,
    paddingVertical: 3,
  },
  monthStateWrap: {
    minHeight: 80,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
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
});
