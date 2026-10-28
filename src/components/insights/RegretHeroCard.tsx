import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import type { Account, Insights, InsightsWindow } from '@/lib/types';
import { isCurrentInsightsWindow } from '@/lib/budgetPeriod';
import { hasDisplayableRegretTrend } from '@/lib/insightsPeriodNav';
import {
  formatRegretDeltaPp,
  regretCardTitle,
  regretComparisonSentence,
} from '@/lib/regretSummaryInsight';
import { INSIGHTS_THEME, insightsCardShadow } from '@/theme/insightsTheme';
import { MiniRegretTrendChart } from '@/components/insights/MiniRegretTrendChart';

type Props = {
  insights: Insights;
  insightsWindow: InsightsWindow;
  account: Account | null | undefined;
  onHelpPress?: () => void;
};

function formatKrw(n: number): string {
  return `${Math.round(Math.abs(n)).toLocaleString()}원`;
}

export function RegretHeroCard({ insights, insightsWindow, account, onHelpPress }: Props) {
  const isCurrent = isCurrentInsightsWindow(insightsWindow, account);
  const title = regretCardTitle(insightsWindow, isCurrent);
  const hasReviews = insights.totalReviews > 0;
  const hasExpenses = insights.totalExpenses > 0;
  const showRealChart = hasReviews && hasDisplayableRegretTrend(insights.regretTrendRates);
  const showTrendArea = hasReviews;

  const prev = insights.previousPeriod;
  const canCompare =
    prev !== null && prev.totalExpenses > 0 && hasExpenses && hasReviews && prev.totalReviews > 0;
  const deltaPp = canCompare ? insights.overallRegretRate - prev!.overallRegretRate : null;
  const improved = deltaPp !== null && deltaPp < 0;
  const worsened = deltaPp !== null && deltaPp > 0;

  return (
    <View style={[styles.outer, insightsCardShadow()]}>
      <LinearGradient
        colors={[INSIGHTS_THEME.mintHero, INSIGHTS_THEME.surface, INSIGHTS_THEME.surface]}
        locations={[0, 0.45, 1]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.card}
      >
        <View style={styles.headerRow}>
          <Text style={styles.cardLabel}>{title}</Text>
          {onHelpPress ? (
            <Pressable
              onPress={onHelpPress}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="후회율 설명 보기"
            >
              <MaterialIcons name="help-outline" size={18} color={INSIGHTS_THEME.textMuted} />
            </Pressable>
          ) : null}
        </View>

        <View style={showTrendArea ? styles.metricRow : styles.metricBlock}>
          <View style={styles.metricMain}>
            {!hasExpenses ? (
              <>
                <Text style={styles.metricDash}>—</Text>
                <Text style={styles.metricHint}>이 기간에 기록된 소비가 없어요.</Text>
              </>
            ) : !hasReviews ? (
              <>
                <Text style={styles.metricDash}>—</Text>
                <Text style={styles.metricHint}>리뷰가 쌓이면 변화가 표시돼요.</Text>
              </>
            ) : (
              <>
                <Text style={styles.metricValue}>{insights.overallRegretRate.toFixed(0)}%</Text>
                {canCompare && deltaPp !== null ? (
                  <Text
                    style={[
                      styles.comparison,
                      improved && styles.comparisonGood,
                      worsened && styles.comparisonBad,
                    ]}
                  >
                    {formatRegretDeltaPp(deltaPp)} · {regretComparisonSentence(insightsWindow, deltaPp)}
                  </Text>
                ) : (
                  <Text style={styles.comparisonMuted}>비교할 이전 기록이 없어요</Text>
                )}
              </>
            )}
          </View>

          {showTrendArea ? (
            <MiniRegretTrendChart
              rates={showRealChart ? insights.regretTrendRates : null}
              showEmptyPlaceholder={!showRealChart}
              width={140}
              height={72}
            />
          ) : null}
        </View>

        {hasReviews ? (
          <>
            <View style={styles.divider} />
            <View style={styles.secondaryRow}>
              <View style={styles.secondaryCol}>
                <Text style={styles.secondaryLabel}>후회한 소비</Text>
                <Text style={styles.secondaryValue}>{insights.totalRegrets}건</Text>
              </View>
              <View style={styles.secondaryCol}>
                <Text style={styles.secondaryLabel}>후회 금액</Text>
                <Text style={styles.secondaryValue}>{formatKrw(insights.regretAmountKrw)}</Text>
              </View>
            </View>
            <Text style={styles.reviewMeta}>리뷰 {insights.totalReviews}건 기준</Text>
          </>
        ) : null}
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: {
    borderRadius: 24,
    overflow: 'hidden',
  },
  card: {
    borderRadius: 24,
    borderWidth: 1,
    borderColor: INSIGHTS_THEME.heroBorder,
    paddingHorizontal: 22,
    paddingVertical: 22,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: INSIGHTS_THEME.text,
    letterSpacing: -0.2,
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  metricBlock: {
    gap: 6,
  },
  metricMain: {
    flex: 1,
    gap: 8,
    minWidth: 0,
  },
  metricValue: {
    fontSize: 48,
    fontWeight: '800',
    color: INSIGHTS_THEME.heroNumber,
    letterSpacing: -2,
    lineHeight: 52,
    ...Platform.select({ ios: { fontVariant: ['tabular-nums' as const] }, default: {} }),
  },
  metricDash: {
    fontSize: 40,
    fontWeight: '700',
    color: INSIGHTS_THEME.textMuted,
    lineHeight: 44,
  },
  metricHint: {
    fontSize: 13,
    fontWeight: '500',
    color: INSIGHTS_THEME.textMuted,
    lineHeight: 18,
  },
  comparison: {
    fontSize: 14,
    fontWeight: '600',
    color: INSIGHTS_THEME.textSecondary,
    lineHeight: 20,
  },
  comparisonGood: {
    color: INSIGHTS_THEME.positive,
  },
  comparisonBad: {
    color: INSIGHTS_THEME.negative,
  },
  comparisonMuted: {
    fontSize: 13,
    fontWeight: '500',
    color: INSIGHTS_THEME.textMuted,
    lineHeight: 18,
  },
  divider: {
    height: 1,
    backgroundColor: INSIGHTS_THEME.border,
    opacity: 0.7,
  },
  secondaryRow: {
    flexDirection: 'row',
    gap: 20,
  },
  secondaryCol: {
    flex: 1,
    gap: 4,
  },
  secondaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: INSIGHTS_THEME.textMuted,
  },
  secondaryValue: {
    fontSize: 18,
    fontWeight: '700',
    color: INSIGHTS_THEME.text,
    letterSpacing: -0.3,
    ...Platform.select({ ios: { fontVariant: ['tabular-nums' as const] }, default: {} }),
  },
  reviewMeta: {
    fontSize: 12,
    fontWeight: '500',
    color: INSIGHTS_THEME.textMuted,
    marginTop: -4,
  },
});
