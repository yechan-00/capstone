// @refresh reset
import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FlipInEasyX, FlipOutEasyX } from 'react-native-reanimated';
import { AnimatedBarFill } from '@/components/AnimatedBarFill';
import { CategoryDonutChart } from '@/components/CategoryDonutChart';
import { InsightHelpModal } from '@/components/InsightHelpModal';
import { WeekdayTimeRegretCard } from '@/components/WeekdayTimeRegretCard';
import { toMonthlyIncomeKrw } from '@/lib/accountSettings';
import {
  budgetPeriodForMonth,
  currentInsightsMonthWindow,
  formatBudgetPeriodRange,
  formatShortBudgetPeriodRange,
  isCurrentInsightsWindow,
  resolveBudgetPeriodMode,
  toFoodBudgetKrw,
} from '@/lib/budgetPeriod';
import { aggregateMoodInsightsByBucket, buildMoodInsightHeadline } from '@/lib/moodInsightDetail';
import { getInsightHelpContent, type InsightHelpId } from '@/lib/insightCardHelp';
import { currentInsightsWindow, useInsights } from '@/hooks/useInsights';
import { useRegretPatternAlertSync } from '@/hooks/useRegretPatternAlertSync';
import { useAuth } from '@/hooks/useAuth';
import { ErrorRetryCard } from '@/components/ErrorRetryCard';
import { toUserMessage } from '@/utils/error';
import { useTheme } from '@/theme/ThemeContext';
import type { CategoryInsight, InsightsWindow } from '@/lib/types';
import { CATEGORY_DOT_COLORS, canonicalFoodCategory } from '@/lib/categoryColors';

/** 드롭다운에 보이는 기간 옵션 수 (나머지는 스크롤) */
const PERIOD_DROPDOWN_VISIBLE_ROWS = 3;
const PERIOD_DROPDOWN_ROW_HEIGHT = 44;

/** 막대 그래프: 월→일 순 (getDay 1=월 … 0=일) */
const WD_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
const WD_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

function formatWindowLabel(window: InsightsWindow): string {
  if (window.mode === 'year') return `${window.year}년`;
  return `${window.year}년 ${window.monthIndex + 1}월`;
}

function formatPeriodSummaryLabel(
  window: InsightsWindow,
  period: { start: Date; end: Date },
  account: { budgetPeriodMode?: 'calendar' | 'payday' } | null | undefined,
): string {
  if (window.mode === 'year') return formatWindowLabel(window);
  if (account?.budgetPeriodMode === 'payday') {
    return `${formatWindowLabel(window)} (${formatBudgetPeriodRange(period.start, period.end)})`;
  }
  return formatWindowLabel(window);
}

function formatMonthOptionLabel(
  year: number,
  monthIndex: number,
  account: ReturnType<typeof useAuth>['account'],
): string {
  const monthLabel = `${monthIndex + 1}월`;
  if (resolveBudgetPeriodMode(account) !== 'payday') return monthLabel;
  const period = budgetPeriodForMonth(year, monthIndex, account);
  return `${monthLabel} · ${formatShortBudgetPeriodRange(period.start, period.end)}`;
}

function currentPeriodShortLabel(account: ReturnType<typeof useAuth>['account']): string {
  return resolveBudgetPeriodMode(account) === 'payday' ? '이번 주기' : '이번 달';
}

function regretBarColor(pct: number, colors: { success: string; logoutText: string }) {
  if (pct >= 50) return colors.logoutText;
  if (pct >= 25) return '#CA8A04';
  return colors.success;
}

function overallRegretSummary(rate: number, totalExpenses: number, totalRegrets: number): string {
  if (totalExpenses === 0) return '기록이 생기면 후회율을 확인할 수 있어요.';
  if (totalRegrets === 0) return '아직 후회한 소비가 없어요.';
  if (rate >= 50) return '후회 비율이 높은 편이에요. 아래 카드에서 패턴을 살펴보세요.';
  if (rate >= 25) return '일부 후회가 있어요. 원인을 찾아보면 도움이 돼요.';
  return '후회 비율이 낮아요. 잘 관리하고 있어요.';
}

function buildMoodRows(moodInsights: Parameters<typeof aggregateMoodInsightsByBucket>[0]) {
  return aggregateMoodInsightsByBucket(moodInsights).map((row) => ({
    ...row,
    regretBarPct: Math.min(100, Math.max(0, row.regretRate)),
  }));
}

function mergedCategoryShares(categoryInsights: CategoryInsight[]) {
  type Row = { key: string; label: string; color: string; count: number; pct: number };
  const acc = new Map<string, { label: string; color: string; count: number }>();
  for (const c of categoryInsights) {
    const canonical = canonicalFoodCategory(c.category);
    const label =
      canonical === 'delivery' ? '외식(배달)' : canonical === 'cafe' ? '외식(카페)' : '외식(포장)';
    const color = CATEGORY_DOT_COLORS[canonical];
    const cur = acc.get(canonical) ?? { label, color, count: 0 };
    cur.count += c.totalCount;
    acc.set(canonical, cur);
  }
  const total = [...acc.values()].reduce((s, v) => s + v.count, 0);
  const rows: Row[] = [...acc.entries()].map(([key, v]) => ({
    key,
    label: v.label,
    color: v.color,
    count: v.count,
    pct: total > 0 ? (v.count / total) * 100 : 0,
  }));
  return { rows: rows.filter((r) => r.count > 0).sort((a, b) => b.count - a.count), total };
}

function formatKrw(n: number) {
  return `₩${Math.round(Math.abs(n)).toLocaleString()}`;
}

function spendRatioBarColor(pct: number, colors: { success: string; logoutText: string }) {
  if (pct >= 100) return colors.logoutText;
  if (pct >= 75) return '#CA8A04';
  return colors.success;
}

function CollapsedBudgetHeader({
  title,
  spendRatioPercent,
  barPct,
  barColor,
  onToggle,
  styles,
  colors,
}: {
  title: string;
  spendRatioPercent: number;
  barPct: number;
  barColor: string;
  onToggle: () => void;
  styles: {
    budgetCollapsedRow: object;
    budgetCollapsedTitle: object;
    budgetCollapsedMetrics: object;
    budgetCollapsedBarTrack: object;
    budgetCollapsedBarFill: object;
    budgetCollapsedPct: object;
    budgetCollapsedToggle: object;
    budgetToggleInline: object;
  };
  colors: { primary: string };
}) {
  return (
    <Pressable
      onPress={onToggle}
      style={styles.budgetCollapsedRow}
      accessibilityRole="button"
      accessibilityLabel={`${title} ${spendRatioPercent.toFixed(0)}% 펼치기`}
    >
      <Text style={styles.budgetCollapsedTitle} numberOfLines={1}>
        {title}
      </Text>
      <View style={styles.budgetCollapsedMetrics}>
        <View style={styles.budgetCollapsedBarTrack}>
          <View style={[styles.budgetCollapsedBarFill, { width: `${barPct}%`, backgroundColor: barColor }]} />
        </View>
        <Text style={styles.budgetCollapsedPct}>{spendRatioPercent.toFixed(0)}%</Text>
        <View style={styles.budgetCollapsedToggle}>
          <Text style={styles.budgetToggleInline}>펼치기</Text>
          <MaterialIcons name="expand-more" size={18} color={colors.primary} />
        </View>
      </View>
    </Pressable>
  );
}

export default function InsightsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { account } = useAuth();
  const { colors, isDark, animationsEnabled } = useTheme();
  const [insightsWindow, setInsightsWindow] = useState<InsightsWindow>(() => currentInsightsWindow('month'));
  const [yearMenuOpen, setYearMenuOpen] = useState(false);
  const [monthMenuOpen, setMonthMenuOpen] = useState(false);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const [foodBudgetCollapsed, setFoodBudgetCollapsed] = useState(false);
  const [incomeCollapsed, setIncomeCollapsed] = useState(false);
  const [helpId, setHelpId] = useState<InsightHelpId | null>(null);
  const [helpOrigin, setHelpOrigin] = useState<{ x: number; y: number } | null>(null);
  const openHelp = useCallback((id: InsightHelpId, e?: { nativeEvent?: { pageX?: number; pageY?: number } }) => {
    const ne = e?.nativeEvent;
    if (ne && typeof ne.pageX === 'number' && typeof ne.pageY === 'number') {
      setHelpOrigin({ x: ne.pageX, y: ne.pageY });
    } else {
      setHelpOrigin(null);
    }
    setHelpId(id);
  }, []);
  const [chartReplay, setChartReplay] = useState(0);
  const replayCharts = useCallback(() => setChartReplay((r) => r + 1), []);
  const { insights, loading, error, refresh } = useInsights(insightsWindow);
  useRegretPatternAlertSync(
    account,
    insights
      ? `${insights.weekdayInsights.reduce((sum, row) => sum + row.totalCount, 0)}:${insights.timeOfDayInsights.reduce((sum, row) => sum + row.totalCount, 0)}`
      : '',
  );
  const periodMode = insightsWindow.mode;
  const isPaydayInsights = resolveBudgetPeriodMode(account) === 'payday';
  const hasMonthlyIncome = account ? toMonthlyIncomeKrw(account) > 0 : false;
  const hasFoodBudget = account ? toFoodBudgetKrw(account) > 0 : false;

  // 계정 로드 시 월급날/달력 기준 '현재 주기'로 맞춤
  useEffect(() => {
    if (!account) return;
    setInsightsWindow(currentInsightsMonthWindow(account));
  }, [account?.id]);

  // 월급날 설정 변경 시, 현재 주기를 보고 있으면 새 주기로 갱신
  useEffect(() => {
    if (!account) return;
    setInsightsWindow((prev) =>
      isCurrentInsightsWindow(prev, account) ? currentInsightsMonthWindow(account) : prev,
    );
  }, [account?.budgetPeriodMode, account?.paydayDayOfMonth]);

  const cardElev =
    !isDark && Platform.OS !== 'web'
      ? {
          shadowColor: '#1a2d4a',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.07,
          shadowRadius: 12,
          elevation: 3,
        }
      : {};

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.bg },
        center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
        content: {
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: insets.bottom + 24,
          gap: 12,
        },
        periodRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap', zIndex: 20 },
        periodSelectCol: { position: 'relative', zIndex: 30 },
        periodSelectColRaised: { zIndex: 40 },
        periodDropdown: {
          position: 'absolute',
          top: '100%',
          left: 0,
          marginTop: 6,
          minWidth: 112,
          borderRadius: 12,
          borderWidth: 1.5,
          borderColor: colors.border,
          backgroundColor: colors.surface,
          overflow: 'hidden',
          ...Platform.select({
            ios: {
              shadowColor: '#1a2d4a',
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.12,
              shadowRadius: 14,
            },
            android: { elevation: 6 },
            default: {},
          }),
        },
        periodDropdownWide: { minWidth: 148 },
        periodDropdownScroll: {
          maxHeight: PERIOD_DROPDOWN_VISIBLE_ROWS * PERIOD_DROPDOWN_ROW_HEIGHT,
        },
        periodDropdownItem: {
          minHeight: PERIOD_DROPDOWN_ROW_HEIGHT,
          paddingHorizontal: 14,
          paddingVertical: 12,
          borderBottomWidth: 1.5,
          borderBottomColor: colors.border,
          justifyContent: 'center',
        },
        periodDropdownItemLast: { borderBottomWidth: 0 },
        periodDropdownText: { fontSize: 14, fontWeight: '700', color: colors.text },
        periodDropdownTextActive: { color: colors.accentCta, fontWeight: '900' },
        periodSelect: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 1,
          paddingVertical: 8,
          paddingHorizontal: 10,
          borderRadius: 10,
          borderWidth: 1.5,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },
        periodSelectText: { fontSize: 15, fontWeight: '800', color: colors.text, letterSpacing: -0.2 },
        periodSelectBracket: { fontSize: 15, fontWeight: '700', color: colors.textMuted },
        card: {
          backgroundColor: colors.surface,
          borderRadius: 16,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          padding: 16,
          gap: 12,
        },
        cardTitle: { fontSize: 17, fontWeight: '900', color: colors.text, letterSpacing: -0.3 },
        cardHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
        cardHelpBtn: { padding: 2, marginTop: 1 },
        cardSub: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: 2, lineHeight: 17 },
        incomeCardHeader: { gap: 6, marginBottom: 2 },
        donutBlock: { alignItems: 'center', gap: 10, marginTop: 4 },
        legendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
        legendLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
        dot: { width: 8, height: 8, borderRadius: 4 },
        legendLabel: { fontSize: 13, fontWeight: '700', color: colors.text },
        legendPct: { fontSize: 13, fontWeight: '800', color: colors.textSec },
        barRow: {
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 6,
          marginTop: 4,
        },
        barCol: { flex: 1, alignItems: 'center', gap: 4 },
        barTrack: {
          width: 18,
          height: 100,
          justifyContent: 'flex-end',
          borderRadius: 6,
          backgroundColor: colors.surfaceMuted,
          overflow: 'hidden',
        },
        barFill: { width: '100%', minHeight: 3 },
        barLabel: { fontSize: 11, fontWeight: '800', color: colors.textSec },
        barLegendRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
        barLegendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
        barLegendDot: { width: 8, height: 8, borderRadius: 4 },
        barLegendText: { fontSize: 11, fontWeight: '600', color: colors.textSec },
        moodRow: { gap: 6 },
        moodPressRow: { paddingVertical: 6, gap: 6 },
        moodTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
        moodHeadline: {
          fontSize: 13,
          fontWeight: '700',
          color: colors.textSec,
          lineHeight: 19,
          marginBottom: 4,
        },
        moodBarTrack: {
          height: 8,
          borderRadius: 4,
          overflow: 'hidden',
          backgroundColor: colors.surfaceMuted,
        },
        moodBarFill: { height: '100%', borderRadius: 4 },
        moodSeeAllBtn: {
          marginTop: 10,
          paddingVertical: 12,
          paddingHorizontal: 14,
          borderRadius: 12,
          borderWidth: StyleSheet.hairlineWidth,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        moodSeeAllText: { fontSize: 14, fontWeight: '800' },
        insightCard: {
          borderRadius: 14,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.accentCta,
          backgroundColor: colors.surface,
          padding: 14,
          flexDirection: 'row',
          gap: 12,
          alignItems: 'flex-start',
        },
        insightBody: { flex: 1, gap: 4 },
        insightText: { fontSize: 14, fontWeight: '600', color: colors.textSec, lineHeight: 21 },
        emptyText: { color: colors.textMuted, fontSize: 15, textAlign: 'center', paddingVertical: 8 },
        insightStack: { gap: 10 },
        incomeHero: { gap: 12 },
        cardCollapsed: { gap: 0, paddingVertical: 12, paddingHorizontal: 14 },
        budgetCardHeader: { width: '100%' },
        budgetCollapsedRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          width: '100%',
        },
        budgetCollapsedTitle: {
          width: 102,
          flexShrink: 0,
          fontSize: 14,
          fontWeight: '900',
          color: colors.text,
          letterSpacing: -0.3,
        },
        budgetCollapsedMetrics: {
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          minWidth: 0,
        },
        budgetCollapsedBarTrack: {
          flex: 1,
          minWidth: 0,
          height: 8,
          borderRadius: 999,
          backgroundColor: colors.surfaceMuted,
          overflow: 'hidden',
        },
        budgetCollapsedBarFill: { height: '100%', borderRadius: 999 },
        budgetCollapsedPct: {
          width: 36,
          fontSize: 15,
          fontWeight: '900',
          color: colors.text,
          letterSpacing: -0.3,
          textAlign: 'right',
          flexShrink: 0,
          ...Platform.select({ ios: { fontVariant: ['tabular-nums' as const] }, default: {} }),
        },
        budgetCollapsedToggle: {
          flexDirection: 'row',
          alignItems: 'center',
          flexShrink: 0,
          gap: 0,
        },
        budgetToggleInline: { fontSize: 12, fontWeight: '800', color: colors.primary },
        budgetExpandedHeaderRow: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 8,
        },
        budgetExpandedBody: { gap: 12, marginTop: 12 },
        incomePctRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
        incomePct: { fontSize: 32, fontWeight: '900', color: colors.text, letterSpacing: -1 },
        incomePctLabel: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: 6 },
        incomeBarTrack: {
          height: 10,
          borderRadius: 999,
          backgroundColor: colors.surfaceMuted,
          overflow: 'hidden',
        },
        incomeBarFill: { height: '100%', borderRadius: 999 },
        incomeStatRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
        incomeStat: { flex: 1, gap: 4 },
        incomeStatKey: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
        incomeStatVal: { fontSize: 15, fontWeight: '800', color: colors.text },
        incomeRemain: { fontSize: 14, fontWeight: '800' },
        regretHeroCard: { gap: 10, paddingVertical: 18 },
        regretHeroBody: { gap: 10 },
        regretHeroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
        regretHeroSub: { fontSize: 12, fontWeight: '700', color: colors.textMuted, lineHeight: 17 },
        regretHeroMain: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
        regretHeroPct: {
          fontSize: 44,
          fontWeight: '900',
          letterSpacing: -2,
          lineHeight: 48,
          ...Platform.select({ ios: { fontVariant: ['tabular-nums' as const] }, default: {} }),
        },
        regretHeroPctLabel: { fontSize: 14, fontWeight: '800', color: colors.textMuted, marginBottom: 8 },
        regretHeroBarTrack: {
          height: 10,
          borderRadius: 999,
          backgroundColor: colors.surfaceMuted,
          overflow: 'hidden',
        },
        regretHeroBarFill: { height: '100%', borderRadius: 999 },
        regretHeroStats: { flexDirection: 'row', gap: 10 },
        regretHeroStat: {
          flex: 1,
          paddingVertical: 10,
          paddingHorizontal: 12,
          borderRadius: 12,
          backgroundColor: colors.surfaceMuted,
          gap: 4,
        },
        regretHeroStatKey: { fontSize: 11, fontWeight: '700', color: colors.textMuted },
        regretHeroStatVal: { fontSize: 16, fontWeight: '900', color: colors.text, letterSpacing: -0.3 },
        regretHeroSummary: { fontSize: 13, fontWeight: '700', color: colors.textSec, lineHeight: 19 },
        incomeCta: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          padding: 14,
          borderRadius: 14,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },
        incomeCtaText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textSec, lineHeight: 20 },
      }),
    [colors, insets.bottom],
  );

  useFocusEffect(
    React.useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const onPullRefresh = useCallback(async () => {
    setPullRefreshing(true);
    try {
      await refresh();
    } finally {
      setPullRefreshing(false);
    }
  }, [refresh]);

  const scrollRefreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={pullRefreshing}
        onRefresh={onPullRefresh}
        tintColor={colors.primary}
        colors={[colors.primary]}
      />
    ),
    [pullRefreshing, onPullRefresh, colors.primary],
  );

  // 연도 옵션: 올해부터 과거 6년
  const yearOptions = useMemo(() => {
    const cy = new Date().getFullYear();
    return Array.from({ length: 6 }, (_, i) => cy - i);
  }, []);

  const selectYear = (year: number) => {
    setYearMenuOpen(false);
    setMonthMenuOpen(false);
    if (year === insightsWindow.year) return;
    setInsightsWindow(
      insightsWindow.mode === 'month'
        ? { mode: 'month', year, monthIndex: insightsWindow.monthIndex }
        : { mode: 'year', year },
    );
  };

  // 월 선택(1~12) 또는 연간 전체
  const selectMonth = (monthIndex: number | 'year') => {
    setYearMenuOpen(false);
    setMonthMenuOpen(false);
    if (monthIndex === 'year') {
      setInsightsWindow({ mode: 'year', year: insightsWindow.year });
    } else {
      setInsightsWindow({ mode: 'month', year: insightsWindow.year, monthIndex });
    }
  };

  if (loading && !insights) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <ErrorRetryCard title="인사이트를 불러오지 못했어요" desc={toUserMessage(error)} onRetry={refresh} />
      </View>
    );
  }

  if (!insights) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>데이터가 없습니다</Text>
      </View>
    );
  }

  const { rows: shareRows, total: shareTotal } = mergedCategoryShares(insights.categoryInsights);
  const donutSlices = shareRows.map((r) => ({ key: r.key, color: r.color, pct: r.pct }));
  const wd = insights.weekdayExpenseCounts ?? [0, 0, 0, 0, 0, 0, 0];
  const wdMax = Math.max(1, ...WD_ORDER.map((d) => wd[d] ?? 0));
  const wdCat = insights.weekdayCategoryCounts ?? Array.from({ length: 7 }, () => ({}));
  const CAT_COLORS: Record<string, string> = { ...CATEGORY_DOT_COLORS };
  const CAT_LABELS: Record<string, string> = {
    delivery: '배달',
    cafe: '카페',
    takeout: '포장',
  };
  const CAT_ORDER = ['delivery', 'cafe', 'takeout'] as const;
  const moodRows = buildMoodRows(insights.moodInsights);
  const moodHeadline = buildMoodInsightHeadline(insights.moodInsights);
  const moodPeriodLabel =
    account?.budgetPeriodMode === 'payday' && insightsWindow.mode === 'month'
      ? `${formatWindowLabel(insightsWindow)} · ${formatBudgetPeriodRange(insights.period.start, insights.period.end)}`
      : formatWindowLabel(insightsWindow);

  const income = insights.incomeInsight;
  const foodBudget = insights.foodBudgetInsight;
  const spendBarPct = income ? Math.min(100, Math.max(0, income.spendRatioPercent)) : 0;
  const foodBarPct = foodBudget ? Math.min(100, Math.max(0, foodBudget.spendRatioPercent)) : 0;
  const overallRegretRate = insights.overallRegretRate;
  const regretBarPct = Math.min(100, Math.max(0, overallRegretRate));
  const regretColor = regretBarColor(overallRegretRate, colors);
  const regretPeriodLabel =
    account?.budgetPeriodMode === 'payday' && insightsWindow.mode === 'month'
      ? `${formatWindowLabel(insightsWindow)} · ${formatBudgetPeriodRange(insights.period.start, insights.period.end)}`
      : formatWindowLabel(insightsWindow);
  const regretSummary = overallRegretSummary(
    overallRegretRate,
    insights.totalExpenses,
    insights.totalRegrets,
  );

  const regretHeroSection = (
    <Pressable onPress={replayCharts} style={[styles.card, cardElev, styles.regretHeroCard]}>
      <View style={styles.regretHeroBody}>
        <View style={styles.regretHeroTop}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.cardTitle}>총 후회율</Text>
            <Text style={styles.regretHeroSub}>
              {regretPeriodLabel} · 기록 {insights.totalExpenses}건
            </Text>
          </View>
          <Pressable
            onPress={(e) => openHelp('overallRegret', e)}
            hitSlop={8}
            style={styles.cardHelpBtn}
            accessibilityRole="button"
            accessibilityLabel="총 후회율 설명 보기"
          >
            <MaterialIcons name="help-outline" size={20} color={colors.textMuted} />
          </Pressable>
        </View>

        <View style={styles.regretHeroMain}>
          <Text style={[styles.regretHeroPct, { color: regretColor }]}>
            {overallRegretRate.toFixed(0)}%
          </Text>
          <Text style={styles.regretHeroPctLabel}>후회율</Text>
        </View>

        <View style={styles.regretHeroBarTrack}>
          <AnimatedBarFill
            pct={regretBarPct}
            duration={750}
            replay={chartReplay}
            style={[styles.regretHeroBarFill, { backgroundColor: regretColor }]}
          />
        </View>

        <View style={styles.regretHeroStats}>
          <View style={styles.regretHeroStat}>
            <Text style={styles.regretHeroStatKey}>후회</Text>
            <Text style={styles.regretHeroStatVal}>{insights.totalRegrets}건</Text>
          </View>
          <View style={styles.regretHeroStat}>
            <Text style={styles.regretHeroStatKey}>기록</Text>
            <Text style={styles.regretHeroStatVal}>{insights.totalExpenses}건</Text>
          </View>
        </View>

        <Text style={styles.regretHeroSummary}>{regretSummary}</Text>
      </View>
    </Pressable>
  );

  const foodBudgetSection = foodBudget ? (
    <View style={[styles.card, cardElev, styles.incomeHero, foodBudgetCollapsed && styles.cardCollapsed]}>
      {foodBudgetCollapsed ? (
        <Animated.View
          key="food-collapsed"
          entering={animationsEnabled ? FlipInEasyX.duration(340) : undefined}
          exiting={animationsEnabled ? FlipOutEasyX.duration(220) : undefined}
        >
          <CollapsedBudgetHeader
            title="식비 예산"
            spendRatioPercent={foodBudget.spendRatioPercent}
            barPct={foodBarPct}
            barColor={spendRatioBarColor(foodBudget.spendRatioPercent, colors)}
            onToggle={() => setFoodBudgetCollapsed(false)}
            styles={styles}
            colors={colors}
          />
        </Animated.View>
      ) : (
        <Animated.View
          key="food-expanded"
          entering={animationsEnabled ? FlipInEasyX.duration(340) : undefined}
          exiting={animationsEnabled ? FlipOutEasyX.duration(220) : undefined}
        >
          <Pressable
            onPress={() => setFoodBudgetCollapsed(true)}
            style={styles.budgetCardHeader}
            accessibilityRole="button"
            accessibilityLabel="식비 예산 접기"
          >
            <View style={styles.budgetExpandedHeaderRow}>
              <View style={styles.incomeCardHeader}>
                <Text style={styles.cardTitle}>식비 예산</Text>
                <Text style={[styles.cardSub, { marginTop: 0 }]}>
                  {foodBudget.periodMode === 'payday'
                    ? `${foodBudget.periodLabel} · ${formatBudgetPeriodRange(insights.period.start, insights.period.end)}`
                    : `${isCurrentInsightsWindow(insightsWindow, account) ? currentPeriodShortLabel(account) : formatWindowLabel(insightsWindow)} · 예산 ${formatKrw(foodBudget.budgetKrw)}`}
                </Text>
              </View>
              <View style={styles.budgetCollapsedToggle}>
                <Text style={styles.budgetToggleInline}>접기</Text>
                <MaterialIcons name="expand-less" size={20} color={colors.primary} />
              </View>
            </View>
          </Pressable>
          <View style={styles.budgetExpandedBody}>
          <View style={styles.incomePctRow}>
            <Text style={styles.incomePct}>{foodBudget.spendRatioPercent.toFixed(0)}%</Text>
            <Text style={styles.incomePctLabel}>소비율</Text>
          </View>
          <View style={styles.incomeBarTrack}>
            <View
              style={[
                styles.incomeBarFill,
                {
                  width: `${foodBarPct}%`,
                  backgroundColor: spendRatioBarColor(foodBudget.spendRatioPercent, colors),
                },
              ]}
            />
          </View>
          <View style={styles.incomeStatRow}>
            <View style={styles.incomeStat}>
              <Text style={styles.incomeStatKey}>식비 합계</Text>
              <Text style={styles.incomeStatVal}>{formatKrw(foodBudget.totalSpendKrw)}</Text>
            </View>
            <View style={[styles.incomeStat, { alignItems: 'flex-end' }]}>
              <Text style={styles.incomeStatKey}>{periodMode === 'year' ? '연 예산' : '월 예산'}</Text>
              <Text style={styles.incomeStatVal}>{formatKrw(foodBudget.budgetKrw)}</Text>
            </View>
          </View>
          <Text
            style={[
              styles.incomeRemain,
              { color: foodBudget.isOverBudget ? colors.logoutText : colors.success },
            ]}
          >
            {foodBudget.isOverBudget
              ? `예산 초과 ${formatKrw(-foodBudget.remainingKrw)}`
              : `예산 잔여 ${formatKrw(foodBudget.remainingKrw)}`}
          </Text>
          <Text style={[styles.cardSub, { marginTop: 4, marginBottom: 0 }]}>
            다른 사용자 평균·상위 % 비교는 데이터가 더 모이면 제공할 예정이에요.
          </Text>
          </View>
        </Animated.View>
      )}
    </View>
  ) : !hasFoodBudget ? (
    <Pressable
      style={[styles.incomeCta, cardElev]}
      onPress={() => router.push('/(tabs)/settings')}
      accessibilityRole="button"
    >
      <MaterialIcons name="restaurant" size={22} color={colors.accentBlue} />
      <Text style={styles.incomeCtaText}>
        설정에서 식비 예산만 입력해도 잔여 금액·초과 여부를 볼 수 있어요. 월 수입은 선택 사항이에요.
      </Text>
      <MaterialIcons name="chevron-right" size={22} color={colors.textMuted} />
    </Pressable>
  ) : null;

  const incomeSection = income ? (
    <View style={[styles.card, cardElev, styles.incomeHero, incomeCollapsed && styles.cardCollapsed]}>
      {incomeCollapsed ? (
        <Animated.View
          key="income-collapsed"
          entering={animationsEnabled ? FlipInEasyX.duration(340) : undefined}
          exiting={animationsEnabled ? FlipOutEasyX.duration(220) : undefined}
        >
          <CollapsedBudgetHeader
            title="월 수입 대비 소비"
            spendRatioPercent={income.spendRatioPercent}
            barPct={spendBarPct}
            barColor={spendRatioBarColor(income.spendRatioPercent, colors)}
            onToggle={() => setIncomeCollapsed(false)}
            styles={styles}
            colors={colors}
          />
        </Animated.View>
      ) : (
        <Animated.View
          key="income-expanded"
          entering={animationsEnabled ? FlipInEasyX.duration(340) : undefined}
          exiting={animationsEnabled ? FlipOutEasyX.duration(220) : undefined}
        >
          <Pressable
            onPress={() => setIncomeCollapsed(true)}
            style={styles.budgetCardHeader}
            accessibilityRole="button"
            accessibilityLabel="월 수입 대비 소비 접기"
          >
            <View style={styles.budgetExpandedHeaderRow}>
              <View style={styles.incomeCardHeader}>
                <Text style={styles.cardTitle}>월 수입 대비 소비</Text>
                <Text style={[styles.cardSub, { marginTop: 0 }]}>
                  {periodMode === 'year'
                    ? `${isCurrentInsightsWindow(insightsWindow, account) ? '올해' : formatWindowLabel(insightsWindow)} 총 소비 · 예산(월 수입×12) ${formatKrw(income.budgetKrw)}`
                    : `${isCurrentInsightsWindow(insightsWindow, account) ? currentPeriodShortLabel(account) : formatWindowLabel(insightsWindow)} · 월 수입 ${formatKrw(income.monthlyIncomeKrw)}`}
                </Text>
              </View>
              <View style={styles.budgetCollapsedToggle}>
                <Text style={styles.budgetToggleInline}>접기</Text>
                <MaterialIcons name="expand-less" size={20} color={colors.primary} />
              </View>
            </View>
          </Pressable>
          <View style={styles.budgetExpandedBody}>
          <View style={styles.incomePctRow}>
            <Text style={styles.incomePct}>{income.spendRatioPercent.toFixed(0)}%</Text>
            <Text style={styles.incomePctLabel}>소비율</Text>
          </View>
          <View style={styles.incomeBarTrack}>
            <View
              style={[
                styles.incomeBarFill,
                {
                  width: `${spendBarPct}%`,
                  backgroundColor: spendRatioBarColor(income.spendRatioPercent, colors),
                },
              ]}
            />
          </View>
          <View style={styles.incomeStatRow}>
            <View style={styles.incomeStat}>
              <Text style={styles.incomeStatKey}>소비 합계</Text>
              <Text style={styles.incomeStatVal}>{formatKrw(income.totalSpendKrw)}</Text>
            </View>
            <View style={[styles.incomeStat, { alignItems: 'flex-end' }]}>
              <Text style={styles.incomeStatKey}>{periodMode === 'year' ? '연 예산' : '월 예산'}</Text>
              <Text style={styles.incomeStatVal}>{formatKrw(income.budgetKrw)}</Text>
            </View>
          </View>
          <Text
            style={[
              styles.incomeRemain,
              { color: income.isOverBudget ? colors.logoutText : colors.success },
            ]}
          >
            {income.isOverBudget
              ? `예산 초과 ${formatKrw(-income.remainingKrw)}`
              : `예산 대비 잔여 ${formatKrw(income.remainingKrw)}`}
          </Text>
          </View>
        </Animated.View>
      )}
    </View>
  ) : !hasMonthlyIncome ? (
    <Pressable
      style={[styles.incomeCta, cardElev]}
      onPress={() => router.push('/(tabs)/settings')}
      accessibilityRole="button"
    >
      <MaterialIcons name="savings" size={22} color={colors.accentBlue} />
      <Text style={styles.incomeCtaText}>
        설정에서 월 수입을 입력하면 소비율·예산 대비 잔액을 볼 수 있어요.
      </Text>
      <MaterialIcons name="chevron-right" size={22} color={colors.textMuted} />
    </Pressable>
  ) : null;

  const insightSection = (
    <View style={styles.insightStack}>
      {insights.patterns.length > 0 ? (
        insights.patterns.map((line, idx) => (
          <View key={`${idx}-${line.slice(0, 12)}`} style={[styles.insightCard, cardElev]}>
            <MaterialIcons
              name={idx === 0 ? 'info-outline' : 'show-chart'}
              size={22}
              color={colors.accentBlue}
            />
            <View style={styles.insightBody}>
              <Text style={styles.insightText}>{line}</Text>
            </View>
          </View>
        ))
      ) : insights.totalExpenses === 0 ? (
        <Text style={styles.emptyText}>기록이 생기면 여기에 짧은 요약이 표시돼요.</Text>
      ) : (
        <View style={[styles.insightCard, cardElev]}>
          <MaterialIcons name="info-outline" size={22} color={colors.accentBlue} />
          <View style={styles.insightBody}>
            <Text style={styles.insightText}>지금은 두드러진 패턴이 없어요. 기록을 이어 가면 좋아요.</Text>
          </View>
        </View>
      )}
    </View>
  );

  return (
    <>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={scrollRefreshControl}
    >
      <View style={styles.periodRow}>
        {/* 연도 선택 */}
        <View style={[styles.periodSelectCol, yearMenuOpen && styles.periodSelectColRaised]}>
          <Pressable
            onPress={() => {
              setMonthMenuOpen(false);
              setYearMenuOpen((open) => !open);
            }}
            style={styles.periodSelect}
            accessibilityRole="button"
            accessibilityLabel="연도 선택"
            accessibilityState={{ expanded: yearMenuOpen }}
          >
            <Text style={styles.periodSelectBracket}>[</Text>
            <Text style={styles.periodSelectText}>{insightsWindow.year}년</Text>
            <MaterialIcons name="arrow-drop-down" size={18} color={colors.textMuted} />
            <Text style={styles.periodSelectBracket}>]</Text>
          </Pressable>
          {yearMenuOpen ? (
            <View style={styles.periodDropdown}>
              <ScrollView
                style={styles.periodDropdownScroll}
                nestedScrollEnabled
                showsVerticalScrollIndicator
                keyboardShouldPersistTaps="handled"
              >
                {yearOptions.map((year, index, arr) => {
                  const active = insightsWindow.year === year;
                  const isLast = index === arr.length - 1;
                  return (
                    <Pressable
                      key={year}
                      style={[styles.periodDropdownItem, isLast && styles.periodDropdownItemLast]}
                      onPress={() => selectYear(year)}
                    >
                      <Text style={[styles.periodDropdownText, active && styles.periodDropdownTextActive]}>
                        {year}년
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}
        </View>
        {/* 월 선택 */}
        <View style={[styles.periodSelectCol, monthMenuOpen && styles.periodSelectColRaised]}>
          <Pressable
            onPress={() => {
              setYearMenuOpen(false);
              setMonthMenuOpen((open) => !open);
            }}
            style={styles.periodSelect}
            accessibilityRole="button"
            accessibilityLabel="월 선택"
            accessibilityState={{ expanded: monthMenuOpen }}
          >
            <Text style={styles.periodSelectBracket}>[</Text>
            <Text style={styles.periodSelectText}>
              {insightsWindow.mode === 'year'
                ? '연간'
                : formatMonthOptionLabel(insightsWindow.year, insightsWindow.monthIndex, account)}
            </Text>
            <MaterialIcons name="arrow-drop-down" size={18} color={colors.textMuted} />
            <Text style={styles.periodSelectBracket}>]</Text>
          </Pressable>
          {monthMenuOpen ? (
            <View style={[styles.periodDropdown, styles.periodDropdownWide, isPaydayInsights && { minWidth: 196 }]}>
              <ScrollView
                style={styles.periodDropdownScroll}
                nestedScrollEnabled
                showsVerticalScrollIndicator
                keyboardShouldPersistTaps="handled"
              >
                {([
                  { key: 'year' as const, label: '연간', value: 'year' as const },
                  ...Array.from({ length: 12 }, (_, m) => ({
                    key: `m${m}`,
                    label: formatMonthOptionLabel(insightsWindow.year, m, account),
                    value: m,
                  })),
                ]).map((option, index, arr) => {
                  const active =
                    option.value === 'year'
                      ? insightsWindow.mode === 'year'
                      : insightsWindow.mode === 'month' && insightsWindow.monthIndex === option.value;
                  const isLast = index === arr.length - 1;
                  return (
                    <Pressable
                      key={option.key}
                      style={[styles.periodDropdownItem, isLast && styles.periodDropdownItemLast]}
                      onPress={() => selectMonth(option.value)}
                    >
                      <Text style={[styles.periodDropdownText, active && styles.periodDropdownTextActive]}>
                        {option.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}
        </View>
      </View>
      {isPaydayInsights && insightsWindow.mode === 'month' && insights?.period ? (
        <Text style={[styles.cardSub, { marginTop: -4, marginBottom: 0 }]}>
          {formatBudgetPeriodRange(insights.period.start, insights.period.end)}
        </Text>
      ) : null}

      {regretHeroSection}

      {incomeSection}

      {foodBudgetSection}

      {insightSection}

      <Pressable style={[styles.card, cardElev]} onPress={replayCharts}>
        <Text style={styles.cardTitle}>카테고리별 소비 비중</Text>
        <Text style={styles.cardSub}>기간 내 기록 건수 기준 비율이에요.</Text>
        {shareTotal > 0 ? (
          <>
            <View style={styles.donutBlock}>
              <CategoryDonutChart slices={donutSlices} centerLabel={`${shareTotal}건`} size={188} replay={chartReplay} />
            </View>
            {shareRows.map((r) => (
              <View key={r.key} style={styles.legendRow}>
                <View style={styles.legendLeft}>
                  <View style={[styles.dot, { backgroundColor: r.color }]} />
                  <Text style={styles.legendLabel}>{r.label}</Text>
                </View>
                <Text style={styles.legendPct}>{r.pct.toFixed(1)}%</Text>
              </View>
            ))}
          </>
        ) : (
          <Text style={[styles.cardSub, { marginTop: 4 }]}>이 기간에 기록된 소비가 없어요.</Text>
        )}
      </Pressable>

      <Pressable style={[styles.card, cardElev]} onPress={replayCharts}>
        <View style={styles.cardHeaderRow}>
          <Text style={[styles.cardTitle, { flex: 1 }]}>어떤 기분일 때 후회가 많았나요?</Text>
          <Pressable
            onPress={(e) => openHelp('moodRegret', e)}
            hitSlop={8}
            style={styles.cardHelpBtn}
            accessibilityRole="button"
            accessibilityLabel="카드 설명 보기"
          >
            <MaterialIcons name="help-outline" size={20} color={colors.textMuted} />
          </Pressable>
        </View>
        {moodHeadline ? <Text style={[styles.moodHeadline, { marginTop: 6 }]}>{moodHeadline}</Text> : null}
        {moodRows.map((m, i) => (
          <View key={m.bucket} style={styles.moodPressRow}>
            <View style={styles.moodTop}>
              <Text style={styles.legendLabel} numberOfLines={1}>
                {m.label}
              </Text>
              <Text style={styles.legendPct}>
                {m.totalCount}건 · 후회 {m.regretRate.toFixed(0)}%
              </Text>
            </View>
            <View style={styles.moodBarTrack}>
              <AnimatedBarFill
                pct={m.regretBarPct}
                delay={i * 45}
                replay={chartReplay}
                style={[styles.moodBarFill, { backgroundColor: regretBarColor(m.regretRate, colors) }]}
              />
            </View>
          </View>
        ))}
        <Pressable
          onPress={() => {
            router.push({
              pathname: '/mood-insights',
              params: {
                mode: insightsWindow.mode,
                year: String(insightsWindow.year),
                monthIndex: insightsWindow.mode === 'month' ? String(insightsWindow.monthIndex) : '',
                periodLabel: moodPeriodLabel,
              },
            });
          }}
          style={({ pressed }) => [
            styles.moodSeeAllBtn,
            {
              borderColor: colors.border,
              backgroundColor: colors.surfaceMuted,
              opacity: pressed ? 0.9 : 1,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="기분별 후회 분석 자세히 보기"
        >
          <Text style={[styles.moodSeeAllText, { color: colors.text }]}>기분별 분석 보기</Text>
          <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
        </Pressable>
      </Pressable>

      <WeekdayTimeRegretCard
        weekdayInsights={insights.weekdayInsights}
        timeOfDayInsights={insights.timeOfDayInsights}
        onHelpPress={(e) => openHelp('timeWeekdayRegret', e)}
      />

      <View style={[styles.card, cardElev]}>
        <Text style={styles.cardTitle}>요일별 소비 빈도</Text>
        <Text style={styles.cardSub}>어느 요일에 기록이 많은지예요.</Text>
        <View style={styles.barRow}>
          {WD_ORDER.map((dayIdx, i) => {
            const total = wd[dayIdx] ?? 0;
            const barMax = 100;
            const totalH = total === 0 ? 0 : Math.max(6, (total / wdMax) * barMax);
            const catData = wdCat[dayIdx] ?? {};
            // 카테고리별 높이 비례 계산
            const segments = CAT_ORDER
              .filter((c) => (catData[c] ?? 0) > 0)
              .map((c) => ({
                key: c,
                color: CAT_COLORS[c],
                h: total > 0 ? Math.max(2, (catData[c] / total) * totalH) : 0,
              }));
            return (
              <View key={dayIdx} style={styles.barCol}>
                <View style={styles.barTrack}>
                  <View style={{ width: '100%', height: totalH, justifyContent: 'flex-end' }}>
                    {segments.map((seg) => (
                      <View
                        key={seg.key}
                        style={[styles.barFill, { height: seg.h, backgroundColor: seg.color }]}
                      />
                    ))}
                  </View>
                </View>
                <Text style={styles.barLabel}>{WD_LABELS[i]}</Text>
              </View>
            );
          })}

        </View>
        <View style={[styles.barLegendRow, { justifyContent: 'center', gap: 16 }]}>
          {CAT_ORDER.map((c) => (
            <View key={c} style={styles.barLegendItem}>
              <View style={[styles.barLegendDot, { backgroundColor: CAT_COLORS[c] }]} />
              <Text style={styles.barLegendText}>{CAT_LABELS[c]}</Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>

    <InsightHelpModal
      visible={helpId !== null}
      content={helpId ? getInsightHelpContent(helpId) : null}
      origin={helpOrigin}
      onClose={() => setHelpId(null)}
    />
    </>
  );
}
