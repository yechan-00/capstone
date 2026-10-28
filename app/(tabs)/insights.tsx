// @refresh reset
import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RegretHeroCard } from '@/components/insights/RegretHeroCard';
import { InsightsPeriodHeader } from '@/components/insights/InsightsPeriodHeader';
import { InsightsSection } from '@/components/insights/InsightsSection';
import { SpendingSummaryCard } from '@/components/insights/SpendingSummaryCard';
import { RegretPatternCard } from '@/components/insights/RegretPatternCard';
import { ExploreMoreRow, ExploreMoreSection } from '@/components/insights/ExploreMoreSection';
import { CategorySpendDetailSheet } from '@/components/insights/CategorySpendDetailSheet';
import { RegretPatternDetailSheet } from '@/components/insights/RegretPatternDetailSheet';
import { SpendFrequencyDetailSheet } from '@/components/insights/SpendFrequencyDetailSheet';
import { InsightHelpModal } from '@/components/InsightHelpModal';
import { toMonthlyIncomeKrw } from '@/lib/accountSettings';
import { currentInsightsMonthWindow, isCurrentInsightsWindow, resolveBudgetPeriodMode, toFoodBudgetKrw } from '@/lib/budgetPeriod';
import { buildCategorySpendBreakdown } from '@/lib/categorySpendBreakdown';
import { getInsightHelpContent, type InsightHelpId } from '@/lib/insightCardHelp';
import { currentInsightsWindow, useInsights } from '@/hooks/useInsights';
import { useRegretPatternAlertSync } from '@/hooks/useRegretPatternAlertSync';
import { useAuth } from '@/hooks/useAuth';
import { ErrorRetryCard } from '@/components/ErrorRetryCard';
import { toUserMessage } from '@/utils/error';
import { useTheme } from '@/theme/ThemeContext';
import { INSIGHTS_THEME } from '@/theme/insightsTheme';

const TAB_BAR_HEIGHT = 76;

export default function InsightsScreen() {
  const insets = useSafeAreaInsets();
  const { account } = useAuth();
  const { colors } = useTheme();
  const [insightsWindow, setInsightsWindow] = useState(() => currentInsightsWindow('month'));
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const [helpId, setHelpId] = useState<InsightHelpId | null>(null);
  const [helpOrigin, setHelpOrigin] = useState<{ x: number; y: number } | null>(null);
  const [categoryExploreOpen, setCategoryExploreOpen] = useState(false);
  const [frequencyOpen, setFrequencyOpen] = useState(false);
  const [patternExploreOpen, setPatternExploreOpen] = useState(false);

  const openHelp = useCallback((id: InsightHelpId) => {
    setHelpOrigin(null);
    setHelpId(id);
  }, []);

  const { insights, loading, error, refresh } = useInsights(insightsWindow);
  useRegretPatternAlertSync(
    account,
    insights
      ? `${insights.weekdayInsights.reduce((sum, row) => sum + row.totalCount, 0)}:${insights.timeOfDayInsights.reduce((sum, row) => sum + row.totalCount, 0)}`
      : '',
  );

  const isPaydayInsights = resolveBudgetPeriodMode(account) === 'payday';
  const hasMonthlyIncome = account ? toMonthlyIncomeKrw(account) > 0 : false;
  const hasFoodBudget = account ? toFoodBudgetKrw(account) > 0 : false;

  useEffect(() => {
    if (!account) return;
    setInsightsWindow(currentInsightsMonthWindow(account));
  }, [account?.id]);

  useEffect(() => {
    if (!account) return;
    setInsightsWindow((prev) =>
      isCurrentInsightsWindow(prev, account) ? currentInsightsMonthWindow(account) : prev,
    );
  }, [account?.budgetPeriodMode, account?.paydayDayOfMonth]);

  const categoryBreakdown = useMemo(
    () =>
      insights
        ? buildCategorySpendBreakdown(insights.categoryInsights, insights.totalSpendKrw)
        : null,
    [insights],
  );

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: INSIGHTS_THEME.bg },
        center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
        content: {
          paddingHorizontal: 20,
          paddingTop: 4,
          paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 24,
        },
        heroWrap: {
          backgroundColor: INSIGHTS_THEME.mintSection,
          marginHorizontal: -20,
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: 24,
        },
        emptyText: { color: colors.textMuted, fontSize: 15, textAlign: 'center', paddingVertical: 8 },
      }),
    [colors.textMuted, insets.bottom],
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

  return (
    <>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        refreshControl={scrollRefreshControl}
      >
        <InsightsPeriodHeader
          insightsWindow={insightsWindow}
          account={account}
          isPaydayInsights={isPaydayInsights}
          periodStart={insights.period.start}
          periodEnd={insights.period.end}
          onChangeWindow={setInsightsWindow}
        />

        <View style={styles.heroWrap}>
          <RegretHeroCard
            insights={insights}
            insightsWindow={insightsWindow}
            account={account}
            onHelpPress={() => openHelp('overallRegret')}
          />
        </View>

        <InsightsSection title="소비 요약" backgroundTint={INSIGHTS_THEME.mintSection}>
          <SpendingSummaryCard
            totalSpendKrw={insights.totalSpendKrw}
            categoryInsights={insights.categoryInsights}
            foodBudget={insights.foodBudgetInsight}
            income={insights.incomeInsight}
            hasFoodBudget={hasFoodBudget}
            hasMonthlyIncome={hasMonthlyIncome}
            periodStart={insights.period.start}
            periodEnd={insights.period.end}
            periodMode={insightsWindow.mode}
          />
        </InsightsSection>

        <InsightsSection
          title="반복되는 후회"
          subtitle="언제 후회가 반복되는지 확인해보세요."
        >
          <RegretPatternCard
            weekdayTimeInsights={insights.weekdayTimeInsights}
            weekdayInsights={insights.weekdayInsights}
            timeOfDayInsights={insights.timeOfDayInsights}
            account={account}
            onHelpPress={() => openHelp('timeWeekdayRegret')}
          />
        </InsightsSection>

        <InsightsSection title="더 알아보기" backgroundTint={INSIGHTS_THEME.bg}>
          <ExploreMoreSection>
            <ExploreMoreRow
              icon="pie-chart"
              title="카테고리 분석"
              description="어디에 가장 많이 썼는지 확인"
              onPress={() => setCategoryExploreOpen(true)}
            />
            <ExploreMoreRow
              icon="bar-chart"
              title="소비 빈도"
              description="어떤 요일에 자주 소비하는지 확인"
              onPress={() => setFrequencyOpen(true)}
            />
            <ExploreMoreRow
              icon="grid-view"
              title="후회 패턴 상세"
              description="시간대별 반복 패턴 확인"
              onPress={() => setPatternExploreOpen(true)}
            />
          </ExploreMoreSection>
        </InsightsSection>
      </ScrollView>

      {categoryBreakdown ? (
        <CategorySpendDetailSheet
          visible={categoryExploreOpen}
          onClose={() => setCategoryExploreOpen(false)}
          rows={categoryBreakdown.rows}
          totalAmountKrw={categoryBreakdown.totalAmountKrw}
        />
      ) : null}

      <SpendFrequencyDetailSheet
        visible={frequencyOpen}
        onClose={() => setFrequencyOpen(false)}
        weekdayExpenseCounts={insights.weekdayExpenseCounts}
        weekdayCategoryCounts={insights.weekdayCategoryCounts}
      />

      <RegretPatternDetailSheet
        visible={patternExploreOpen}
        onClose={() => setPatternExploreOpen(false)}
        cells={insights.weekdayTimeInsights}
        weekdayInsights={insights.weekdayInsights}
        timeOfDayInsights={insights.timeOfDayInsights}
      />

      <InsightHelpModal
        visible={helpId !== null}
        content={helpId ? getInsightHelpContent(helpId) : null}
        origin={helpOrigin}
        onClose={() => setHelpId(null)}
      />
    </>
  );
}
