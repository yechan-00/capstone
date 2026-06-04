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
import Animated, { FlipInEasyX, FlipOutEasyX } from 'react-native-reanimated';
import { useAuth } from '@/hooks/useAuth';
import { useRegretPatternAlertSync } from '@/hooks/useRegretPatternAlertSync';
import { useRefreshPendingReviewCountOnFocus } from '@/hooks/usePendingReviewCount';
import { ErrorRetryCard } from '@/components/ErrorRetryCard';
import { expenseService } from '@/services/expenseService';
import { reviewService } from '@/services/reviewService';
import { ensureNotificationPermission } from '@/services/notificationService';
import { scheduleService } from '@/services/scheduleService';
import { toUserMessage } from '@/utils/error';
import { normalizeReviewSatisfaction } from '@/utils/reviewNormalize';
import { useTheme } from '@/theme/ThemeContext';


import type { Expense, ExpenseCategory, Review, ReviewSchedule } from '@/lib/types';
import { categoryDotColor } from '@/lib/categoryColors';
import {
  budgetPeriodForMonth,
  currentBudgetPeriod,
  formatBudgetPeriodRange,
  isPaydayCell,
  resolveBudgetPeriodMode,
  toFoodBudgetKrw,
} from '@/lib/budgetPeriod';
import {
  buildRegretPatternHomeHeadline,
  formatRegretPatternAlertSummary,
} from '@/lib/regretPatternAlert';
import { loadAllTimePatternInsights } from '@/services/regretPatternAlertService';

export default function HomeScreen() {
  const router = useRouter();
  const { colors, isDark, animationsEnabled } = useTheme();
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
    if (!isWeb) return isCompact ? 56 : 72;
    const reservedHeight = isCompact ? 340 : 380;
    const available = Math.floor((height - reservedHeight) / Math.max(1, calendarRows));
    return Math.max(isCompact ? 48 : 58, Math.min(isCompact ? 66 : 92, available));
  }, [calendarRows, height, isCompact, isWeb]);
  /** 날짜 탭 시 상세 모달에 표시할 날짜 (YYYY-MM-DD) */
  const [detailDayKey, setDetailDayKey] = React.useState<string | null>(null);
  const [regretPatternHeadline, setRegretPatternHeadline] = React.useState<string | null>(null);
  /** 이번 달 소비 정산 카드만 접기 (캘린더는 항상 표시) */
  const [monthBreakdownCollapsed, setMonthBreakdownCollapsed] = React.useState(false);
  /** 지출 ID → 해당 지출의 가장 최근 리뷰 (캘린더 감성 색) */
  const [reviewsByExpenseId, setReviewsByExpenseId] = React.useState<Map<string, Review>>(() => new Map());
  /** 지출 ID → 해당 지출의 가장 이른 pending 리뷰 스케줄 (평가하기 이동용) */
  const [pendingScheduleByExpenseId, setPendingScheduleByExpenseId] = React.useState<
    Map<string, ReviewSchedule>
  >(() => new Map());
  const lastFocusRefreshAtRef = React.useRef(0);

  const monthBusyRef = React.useRef(false);

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
      out.set(k, sortExpensesForCalendarCells(raw, reviewsByExpenseId));
    });
    return out;
  }, [expenseMapByDay, reviewsByExpenseId]);

  const detailDayExpenses = React.useMemo(() => {
    if (!detailDayKey) return [];
    return sortedExpensesByDayKey.get(detailDayKey) ?? [];
  }, [detailDayKey, sortedExpensesByDayKey]);

  const monthCategoryTotals = React.useMemo(() => summarizeMonthByCategory(periodExpenses), [periodExpenses]);
  const monthTotalAmount = monthCategoryTotals.total;
  const foodBudgetKrw = account ? toFoodBudgetKrw(account) : 0;
  const foodBudgetRemaining = foodBudgetKrw > 0 ? foodBudgetKrw - monthTotalAmount : null;
  const regretPatternAlertSummary = formatRegretPatternAlertSummary(account?.regretPatternAlertSlots ?? []);

  useRegretPatternAlertSync(account, `${expenses.length}:${reviewsByExpenseId.size}`);
  useRefreshPendingReviewCountOnFocus();
  const periodDayKeys = React.useMemo(() => {
    const keys = new Set<string>();
    for (const e of periodExpenses) keys.add(toDayKey(e.spentAt));
    return keys.size;
  }, [periodExpenses]);
  const activeDaysCount = periodDayKeys;

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
      setReviewsByExpenseId(new Map());
      setPendingScheduleByExpenseId(new Map());
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
        const fresh = await reviewService.getLatestByExpenseIds(
          account.id,
          list.map((e) => e.id),
        );
        if (cancelled) return;
        setReviewsByExpenseId((prev) => {
          const next = new Map(prev);
          fresh.forEach((rev, expenseId) => next.set(expenseId, rev));
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

  useFocusEffect(
    React.useCallback(() => {
      if (!account) return;
      const now = Date.now();
      // 포커스가 짧은 간격으로 반복될 때 과도한 로딩 토글(깜빡임) 방지
      if (now - lastFocusRefreshAtRef.current < 1200) return;
      lastFocusRefreshAtRef.current = now;
      void loadMonthExpenses(true);
      void loadAllTimePatternInsights(account.id)
        .then(({ weekdayInsights, timeOfDayInsights }) => {
          setRegretPatternHeadline(buildRegretPatternHomeHeadline(weekdayInsights, timeOfDayInsights));
        })
        .catch(() => setRegretPatternHeadline(null));
    }, [account, currentMonth])
  );

const loadMonthExpensesRef = React.useRef<((silent: boolean) => Promise<any>) | null>(null);

  const loadMonthExpenses = async (silent: boolean): Promise<Expense[] | undefined> => {
    if (!account || monthBusyRef.current) return undefined;
    monthBusyRef.current = true;
    try {
      if (!silent) setLoading(true);
      setError(null);

      const y = currentMonth.getFullYear();
      const m = currentMonth.getMonth();
      const calStart = new Date(y, m, 1, 0, 0, 0, 0);
      const calEnd = new Date(y, m + 1, 0, 23, 59, 59, 999);
      const period = budgetPeriodForMonth(y, m, account);
      const start = new Date(Math.min(calStart.getTime(), period.start.getTime()));
      const end = new Date(Math.max(calEnd.getTime(), period.end.getTime()));
      const data = await expenseService.getByAccountIdInRange(account.id, start, end);
      setExpenses(data);
      try {
        const revMap = await reviewService.getLatestByExpenseIds(
          account.id,
          data.map((e) => e.id)
        );
        setReviewsByExpenseId(revMap);
        const pendMap = await scheduleService.getEarliestPendingScheduleByExpenseIds(
          account.id,
          data.map((e) => e.id),
          { includePastGraceWindow: true },
        );
        setPendingScheduleByExpenseId(pendMap);
      } catch {
        setReviewsByExpenseId(new Map());
        setPendingScheduleByExpenseId(new Map());
      }
      return data;
    } catch (err) {
      const e = err instanceof Error ? err : new Error('소비 목록을 불러오는데 실패했습니다.');
      setError(e);
      setReviewsByExpenseId(new Map());
      setPendingScheduleByExpenseId(new Map());
      return undefined;
    } finally {
      if (!silent) setLoading(false);
      monthBusyRef.current = false;
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
        <ActivityIndicator size="large" color={colors.primary} />
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
          shadowColor: '#1a2d4a',
          shadowOffset: { width: 0, height: 5 },
          shadowOpacity: 0.07,
          shadowRadius: 14,
          elevation: 4,
        }
      : {};

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {isOffline && (
        <View style={[styles.offlineBanner, { backgroundColor: colors.offlineBg, borderBottomColor: colors.offlineBorder }]}>
          <Text style={[styles.offlineText, { color: colors.offlineText }]}>네트워크 연결이 필요합니다</Text>
        </View>
      )}
      {regretPatternHeadline ? (
        <View style={styles.patternSection}>
          <View
            style={[
              styles.patternCardOuter,
              { backgroundColor: colors.surface, borderColor: colors.border },
              cardElev,
            ]}
          >
            <View style={[styles.patternIconWrap, { backgroundColor: isDark ? colors.surfaceMuted : '#EEF2FF' }]}>
              <MaterialIcons name="schedule" size={20} color={isDark ? '#a5b4fc' : '#4f46e5'} />
            </View>
            <View style={styles.patternTextWrap}>
              <Text style={[styles.patternTitle, { color: colors.text }]}>후회 많은 시간</Text>
              <Text style={[styles.patternHeadline, { color: colors.textSec }]}>{regretPatternHeadline}</Text>
              {account.regretPatternAlertEnabled !== false && account.regretPatternAlertSlots?.length ? (
                <Text style={[styles.patternMeta, { color: colors.textMuted }]}>{regretPatternAlertSummary}</Text>
              ) : null}
            </View>
          </View>
        </View>
      ) : null}
      <View style={styles.spendingHeader}>
        <Text style={[styles.spendingHeaderTitle, { color: colors.textSec }]}>이번 달 요약</Text>
      </View>
      <ScrollView contentContainerStyle={[styles.list, isCompact && styles.listCompact]}>
        <View
          style={[
            styles.breakdownCard,
            isCompact && styles.breakdownCardCompact,
            { backgroundColor: colors.surface, borderColor: colors.border },
            cardElev,
          ]}
        >
          <View style={styles.breakdownHeader}>
            <View style={styles.breakdownHeaderLeft}>
              <Text style={[styles.breakdownTitle, { color: colors.text }]}>
                {resolveBudgetPeriodMode(account) === 'payday' ? '식비 주기' : '이번 달 소비'}
              </Text>
              <Text style={[styles.breakdownSubtitle, { color: colors.textMuted }]}>
                {resolveBudgetPeriodMode(account) === 'payday'
                  ? formatBudgetPeriodRange(budgetPeriod.start, budgetPeriod.end)
                  : formatMonth(currentMonth)}
              </Text>
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
            <Animated.View
              key="breakdown-collapsed"
              style={styles.breakdownCollapsedBlock}
              entering={animationsEnabled ? FlipInEasyX.duration(320) : undefined}
              exiting={animationsEnabled ? FlipOutEasyX.duration(200) : undefined}
            >
              <View style={styles.breakdownCollapsedTotalRow}>
                <Text style={[styles.breakdownCollapsedTotalLabel, { color: colors.text }]}>합계</Text>
                <Text style={[styles.breakdownCollapsedTotalAmount, { color: colors.primary }]}>
                  {monthTotalAmount.toLocaleString()}원
                </Text>
              </View>
              <View style={styles.breakdownCollapsedCatsRow}>
                {(
                  [
                    { key: 'takeout' as const, label: '포장', amount: monthCategoryTotals.takeout, cat: 'takeout' as ExpenseCategory },
                    { key: 'delivery' as const, label: '배달', amount: monthCategoryTotals.delivery, cat: 'delivery' as ExpenseCategory },
                    { key: 'cafe' as const, label: '카페', amount: monthCategoryTotals.cafe, cat: 'cafe' as ExpenseCategory },
                  ] as const
                ).map((row) => (
                  <View key={row.key} style={styles.breakdownCollapsedCatCell}>
                    <View style={[styles.breakdownDot, { backgroundColor: categoryDotColor(row.cat) }]} />
                    <Text style={[styles.breakdownCollapsedCatText, { color: colors.textSec }]} numberOfLines={1}>
                      {row.label} {row.amount.toLocaleString()}
                    </Text>
                  </View>
                ))}
              </View>
            </Animated.View>
          ) : (
            <Animated.View
              key="breakdown-expanded"
              entering={animationsEnabled ? FlipInEasyX.duration(320) : undefined}
              exiting={animationsEnabled ? FlipOutEasyX.duration(200) : undefined}
            >
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
                    <View style={[styles.breakdownDot, { backgroundColor: categoryDotColor(row.cat) }]} />
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
              {foodBudgetRemaining != null ? (
                <Text
                  style={[
                    styles.breakdownBudgetHint,
                    { color: foodBudgetRemaining >= 0 ? colors.success : colors.logoutText },
                  ]}
                >
                  {foodBudgetRemaining >= 0
                    ? `식비 예산 잔여 ${foodBudgetRemaining.toLocaleString()}원 / ${foodBudgetKrw.toLocaleString()}원`
                    : `식비 예산 초과 ${Math.abs(foodBudgetRemaining).toLocaleString()}원`}
                </Text>
              ) : null}
            </Animated.View>
          )}
        </View>

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
              <MaterialIcons name="chevron-left" size={28} color={colors.primary} />
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
                <MaterialIcons name="chevron-right" size={28} color={colors.primary} />
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
                      i === 0 ? '#e11d48' : i === 6 ? '#2563eb' : colors.textSec,
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
              const count = dayExpenses.length;
              const active = detailDayKey === key;
              const today = key === todayKey;
              const previewCount = isCompact ? 1 : 2;
              const dow = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), cell).getDay();
              const isSun = dow === 0;
              const isSat = dow === 6;
              const isPayday =
                cell != null &&
                isPaydayCell(currentMonth.getFullYear(), currentMonth.getMonth(), cell, account);
              return (
                <Pressable
                  key={key}
                  style={[styles.dayCell, { minHeight: calendarCellHeight }, isCompact && styles.dayCellCompact]}
                  onPress={() => setDetailDayKey(key)}
                >
                  <View
                    style={[
                      styles.dayNumCircle,
                      active && { backgroundColor: colors.primary },
                      today && !active && { borderWidth: 2, borderColor: colors.primary },
                      isPayday && !active && { borderWidth: 2, borderColor: '#e11d48' },
                    ]}
                  >
                    <Text
                      style={[
                        styles.dayNum,
                        isCompact && styles.dayNumCompact,
                        active && { color: colors.onPrimary },
                        !active && isSun && { color: '#e11d48' },
                        !active && isSat && { color: '#2563eb' },
                        !active && !isSun && !isSat && { color: colors.text },
                      ]}
                    >
                      {cell}
                    </Text>
                  </View>
                  <View style={styles.dayEvents}>
                    {dayExpenses.slice(0, previewCount).map((expense) => {
                      const review = reviewsByExpenseId.get(expense.id);
                      const surf = review ? reviewSentimentSurface(review, isDark) : null;
                      const chipText = formatCalendarAmountChip(Number(expense.amount) || 0);
                      return (
                        <View
                          key={expense.id}
                          style={[
                            styles.eventPill,
                            {
                              backgroundColor: surf?.bg ?? colors.surfaceMuted,
                              borderWidth: StyleSheet.hairlineWidth,
                              borderColor: surf?.border ?? colors.border,
                            },
                          ]}
                        >
                          <Text
                            style={[
                              styles.eventPillText,
                              { color: surf ? surf.text : colors.textSec },
                            ]}
                            numberOfLines={1}
                          >
                            {chipText}
                          </Text>
                        </View>
                      );
                    })}
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

      {detailDayKey !== null ? (
      <Modal
        visible
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
                  {detailDayExpenses.map((item, index) => {
                    const itemReview = reviewsByExpenseId.get(item.id);
                    const pendingSched = pendingScheduleByExpenseId.get(item.id);
                    const canReview = !itemReview && pendingSched != null;
                    const surf = itemReview ? reviewSentimentSurface(itemReview, isDark) : null;
                    return (
                    <View key={item.id}>
                      {index > 0 ? <View style={[styles.modalBlockDivider, { backgroundColor: colors.border }]} /> : null}
                      <View
                        style={[
                          styles.modalExpenseBlock,
                          surf
                            ? {
                                backgroundColor: surf.bg,
                                borderWidth: StyleSheet.hairlineWidth,
                                borderColor: surf.border,
                              }
                            : { backgroundColor: colors.surfaceMuted },
                        ]}
                      >
                      <View style={styles.modalEventTitleRow}>
                        <Pressable
                          onPress={() => handleExpensePress(item.id)}
                          style={({ pressed }) => [
                            styles.modalEventTitlePress,
                            { opacity: pressed ? 0.88 : 1 },
                          ]}
                        >
                          <View
                            style={[
                              styles.modalDot,
                              { backgroundColor: categoryDotColor(item.category) },
                            ]}
                          />
                          <Text style={[styles.modalEventTitle, { color: colors.text }]} numberOfLines={2}>
                            {(item.item ?? item.content ?? item.reason ?? '소비').trim()}
                          </Text>
                        </Pressable>
                        {canReview && pendingSched ? (
                          <Pressable
                            onPress={() => openReviewForExpense(item.id, pendingSched.id)}
                            style={[
                              styles.modalReviewBtn,
                              { borderColor: colors.primary, backgroundColor: colors.choiceActiveBg },
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel="평가하기"
                          >
                            <Text style={[styles.modalReviewBtnText, { color: colors.primary }]}>평가하기</Text>
                          </Pressable>
                        ) : null}
                      </View>

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
                          onPress={() => handleEditExpense(item.id)}
                          style={[styles.modalGhostBtn, { borderColor: '#6366F1' }]}
                        >
                          <Text style={[styles.modalGhostBtnText, { color: '#6366F1' }]}>수정</Text>
                        </Pressable>
                        <Pressable
                          onPress={() => handleDeleteExpense(item.id, item.reason, detailDayKey)}
                          style={[styles.modalGhostBtn, { borderColor: colors.logoutBorder }]}
                        >
                          <Text style={[styles.modalGhostBtnText, { color: colors.logoutText }]}>삭제</Text>
                        </Pressable>
                      </View>
                      </View>
                    </View>
                    );
                  })}
                </ScrollView>
              )}
            </View>
          </View>
        </View>
      </Modal>
      ) : null}
    </View>
  );
}

function toDayKey(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** 같은 날 여러 건일 때 리뷰가 있는 지출이 캘린더 미리보기(1~2줄)에 먼저 오도록 */
function sortExpensesForCalendarCells(day: Expense[], reviewsByExpenseId: Map<string, Review>): Expense[] {
  const toneRank = (r: Review) => {
    const t = sentimentFromDecision(r);
    if (t === 'negative') return 0;
    if (t === 'neutral') return 1;
    return 2;
  };
  return [...day].sort((a, b) => {
    const hasA = reviewsByExpenseId.has(a.id);
    const hasB = reviewsByExpenseId.has(b.id);
    if (hasA !== hasB) return hasA ? -1 : 1;
    if (hasA && hasB) {
      const ra = reviewsByExpenseId.get(a.id)!;
      const rb = reviewsByExpenseId.get(b.id)!;
      const diff = toneRank(ra) - toneRank(rb);
      if (diff !== 0) return diff;
    }
    return b.spentAt.getTime() - a.spentAt.getTime();
  });
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

function formatCalendarAmountChip(amount: number): string {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (n < 10000) {
    const cheon = Math.round(n / 1000);
    return `${cheon <= 0 ? 1 : cheon}천`;
  }
  const man = n / 10000;
  const rounded = Math.round(man * 10) / 10;
  if (rounded === Math.floor(rounded)) return `${Math.floor(rounded)}만`;
  return `${rounded}만`;
}

type ReviewSentiment = 'positive' | 'negative' | 'neutral';

/**
 * 캘린더·모달 색. `reviewService`가 Firestore 값을 `normalizeReviewSatisfaction`으로 숫자화하므로
 * 기존 리뷰(문자열 satisfaction, Long 등)도 1~5면 그대로 4~5 초록·3 노랑·1~2 빨강.
 * satisfaction이 없거나 파싱 불가면 `decisionAgain`(yes/maybe/no)으로 동일 3단 톤 폴백.
 */
function sentimentFromDecision(review: Review): ReviewSentiment {
  const s = normalizeReviewSatisfaction(review.satisfaction);
  if (Number.isFinite(s) && s >= 1 && s <= 5) {
    if (s >= 4) return 'positive';
    if (s === 3) return 'neutral';
    return 'negative';
  }
  switch (review.decisionAgain) {
    case 'yes':
      return 'positive';
    case 'no':
      return 'negative';
    case 'maybe':
      return 'neutral';
    default:
      return 'neutral';
  }
}

/** 모달·목록에서 감성 점(만족/보통/불만족) 표시용 — 캘린더 pill과 동일 기준 */
function sentimentMarkerColor(review: Review, isDark: boolean): string {
  const tone = sentimentFromDecision(review);
  if (isDark) {
    if (tone === 'positive') return '#4ade80';
    if (tone === 'negative') return '#fb7185';
    return '#facc15';
  }
  if (tone === 'positive') return '#16a34a';
  if (tone === 'negative') return '#dc2626';
  return '#ca8a04';
}

const REVIEW_CALENDAR_TEXT_ON_DARK_PILL = '#f8fafc';

/** 리뷰 완료 항목: 긍정·부정·보통은 배경만 구분 (다크는 불투명 배경으로 빨강도 확실히) */
function reviewSentimentColors(review: Review, isDark: boolean): { bg: string; text: string } {
  const tone = sentimentFromDecision(review);
  if (isDark) {
    switch (tone) {
      case 'positive':
        return { bg: '#14532d', text: REVIEW_CALENDAR_TEXT_ON_DARK_PILL };
      case 'negative':
        return { bg: '#9f1239', text: '#fecdd3' };
      case 'neutral':
      default:
        return { bg: '#713f12', text: '#fef9c3' };
    }
  }
  switch (tone) {
    case 'positive':
      return { bg: '#E3F4EA', text: '#166534' };
    case 'negative':
      return { bg: '#FDE8E8', text: '#b91c1c' };
    case 'neutral':
    default:
      return { bg: '#FEF6D8', text: '#92400e' };
  }
}

function reviewSentimentSurface(review: Review, isDark: boolean): {
  bg: string;
  text: string;
  dot: string;
  border: string;
} {
  const base = reviewSentimentColors(review, isDark);
  const dot = sentimentMarkerColor(review, isDark);
  const border = isDark ? 'rgba(248, 250, 252, 0.22)' : 'rgba(15, 23, 42, 0.12)';
  return { bg: base.bg, text: base.text, dot, border };
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
    paddingTop: 10,
    paddingBottom: 4,
  },
  spendingHeaderTitle: { fontSize: 14, fontWeight: '700', letterSpacing: -0.2 },
  patternSection: {
    marginTop: 12,
    marginHorizontal: 16,
    marginBottom: 4,
  },
  patternCardOuter: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  patternIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  patternTextWrap: { flex: 1, gap: 4 },
  patternTitle: { fontSize: 15, fontWeight: '800', letterSpacing: -0.2 },
  patternHeadline: { fontSize: 14, fontWeight: '600', lineHeight: 20 },
  patternMeta: { fontSize: 12, fontWeight: '600', lineHeight: 18, marginTop: 2 },
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
    paddingVertical: 6,
  },
  dayCellCompact: {
    paddingHorizontal: 1,
    paddingVertical: 4,
  },
  dayNumCircle: {
    minWidth: 32,
    minHeight: 32,
    paddingHorizontal: 6,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayNum: { fontSize: 13, fontWeight: '800' },
  dayNumCompact: { fontSize: 12 },
  dayEvents: { gap: 3, width: '100%', alignItems: 'center', marginTop: 4 },
  eventPill: {
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
    maxWidth: '100%',
  },
  eventPillText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  morePillText: {
    fontSize: 10,
    fontWeight: '700',
    paddingLeft: 2,
  },
  breakdownCard: {
    borderWidth: StyleSheet.hairlineWidth,
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
  breakdownCollapsedBlock: {
    marginTop: 10,
    gap: 8,
  },
  breakdownCollapsedTotalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  breakdownCollapsedTotalLabel: {
    fontSize: 13,
    fontWeight: '800',
  },
  breakdownCollapsedTotalAmount: {
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: -0.3,
    flexShrink: 0,
    ...Platform.select({ ios: { fontVariant: ['tabular-nums' as const] }, default: {} }),
  },
  breakdownCollapsedCatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  breakdownCollapsedCatCell: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  breakdownCollapsedCatText: {
    flex: 1,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: -0.2,
    ...Platform.select({ ios: { fontVariant: ['tabular-nums' as const] }, default: {} }),
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
  quickSection: {
    marginTop: 4, marginBottom: 4,
    borderRadius: 16, borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14, paddingVertical: 12, gap: 10,
  },
  quickHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  quickTitle: { fontSize: 14, fontWeight: '700' },
  quickAddBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 10, borderWidth: StyleSheet.hairlineWidth,
  },
  quickAddBtnText: { fontSize: 12, fontWeight: '700' },
  quickEmpty: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, paddingHorizontal: 12,
    borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed',
  },
  quickEmptyText: { fontSize: 12, fontWeight: '600' },
  quickPresetRow: { flexDirection: 'row', gap: 12, paddingVertical: 2, alignItems: 'flex-start' },
  quickPresetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingVertical: 2,
  },
  quickPresetWrap: { alignItems: 'center', gap: 6 },
  quickPresetBtn: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
  },
  quickPresetLabel: { fontSize: 12, fontWeight: '700', textAlign: 'center' },
  quickPresetAmount: { fontSize: 10, fontWeight: '600', color: 'rgba(255,255,255,0.85)' },
  quickPresetActions: { flexDirection: 'row', gap: 4 },
  quickActionBtn: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
  },
  breakdownBudgetHint: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
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
  modalExpenseBlock: {
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 8,
  },
  modalEventTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  modalEventTitlePress: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    minWidth: 0,
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
  modalReviewBtn: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    flexShrink: 0,
  },
  modalReviewBtnText: {
    fontSize: 12,
    fontWeight: '800',
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
