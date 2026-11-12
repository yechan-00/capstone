import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import type { Account, Insights, InsightsWindow } from '@/lib/types';
import { isCurrentInsightsWindow } from '@/lib/budgetPeriod';
import { hasDisplayableRegretTrend } from '@/lib/insightsPeriodNav';
import {
  formatRegretDeltaCaption,
  regretCardTitle,
  regretComparisonEmptyMessage,
} from '@/lib/regretSummaryInsight';
import { insightsCardShadow, useInsightsPalette } from '@/theme/insightsTheme';
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
  const t = useInsightsPalette();
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
    <View style={[styles.outer, insightsCardShadow(t.isDark)]}>
      <LinearGradient
        colors={[t.mintHero, t.surface, t.surface]}
        locations={[0, 0.45, 1]}
        start={{ x: 1, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={[styles.card, { borderColor: t.heroBorder }]}
      >
        <View style={styles.headerRow}>
          <Text style={[styles.cardLabel, { color: t.text }]}>{title}</Text>
          {onHelpPress ? (
            <Pressable
              onPress={onHelpPress}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="후회율 설명 보기"
            >
              <MaterialIcons name="help-outline" size={18} color={t.textMuted} />
            </Pressable>
          ) : null}
        </View>

        <View style={showTrendArea ? styles.metricRow : styles.metricBlock}>
          <View style={styles.metricMain}>
            {!hasExpenses ? (
              <>
                <Text style={[styles.metricDash, { color: t.textMuted }]}>—</Text>
                <Text style={[styles.metricHint, { color: t.textMuted }]}>이 기간에 기록된 소비가 없어요.</Text>
              </>
            ) : !hasReviews ? (
              <>
                <Text style={[styles.metricDash, { color: t.textMuted }]}>—</Text>
                <Text style={[styles.metricHint, { color: t.textMuted }]}>리뷰가 쌓이면 변화가 표시돼요.</Text>
              </>
            ) : (
              <>
                <Text style={[styles.metricValue, { color: t.heroNumber }]}>{insights.overallRegretRate.toFixed(0)}%</Text>
                {canCompare && deltaPp !== null ? (
                  <Text
                    style={[
                      styles.comparison,
                      { color: t.textSecondary },
                      improved && { color: t.positive },
                      worsened && { color: t.negative },
                    ]}
                    numberOfLines={2}
                  >
                    {formatRegretDeltaCaption(insightsWindow, deltaPp)}
                  </Text>
                ) : (
                  <Text style={[styles.comparisonMuted, { color: t.textMuted }]}>
                    {regretComparisonEmptyMessage(insightsWindow)}
                  </Text>
                )}
              </>
            )}
          </View>

          {showTrendArea ? (
            <MiniRegretTrendChart
              rates={showRealChart ? insights.regretTrendRates : null}
              emptyMessage={!showRealChart ? '추이를 표시할 데이터가 부족해요' : undefined}
              width={140}
              height={72}
              strokeColor={t.primary}
              emptyMessageColor={t.textMuted}
            />
          ) : null}
        </View>

        {hasReviews ? (
          <>
            <View style={[styles.divider, { backgroundColor: t.border }]} />
            <View style={styles.secondaryRow}>
              <View style={styles.secondaryCol}>
                <Text style={[styles.secondaryLabel, { color: t.textMuted }]}>후회한 소비</Text>
                <Text style={[styles.secondaryValue, { color: t.text }]}>{insights.totalRegrets}건</Text>
              </View>
              <View style={styles.secondaryCol}>
                <Text style={[styles.secondaryLabel, { color: t.textMuted }]}>후회 금액</Text>
                <Text style={[styles.secondaryValue, { color: t.text }]}>{formatKrw(insights.regretAmountKrw)}</Text>
              </View>
            </View>
            <Text style={[styles.reviewMeta, { color: t.textMuted }]}>리뷰 {insights.totalReviews}건 기준</Text>
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
    letterSpacing: -2,
    lineHeight: 52,
    ...Platform.select({ ios: { fontVariant: ['tabular-nums' as const] }, default: {} }),
  },
  metricDash: {
    fontSize: 40,
    fontWeight: '700',
    lineHeight: 44,
  },
  metricHint: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  comparison: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  comparisonMuted: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  divider: {
    height: 1,
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
  },
  secondaryValue: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.3,
    ...Platform.select({ ios: { fontVariant: ['tabular-nums' as const] }, default: {} }),
  },
  reviewMeta: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: -4,
  },
});
