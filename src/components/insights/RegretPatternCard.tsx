import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { RegretPatternHeatmap } from '@/components/insights/RegretPatternHeatmap';
import { RegretPatternDetailSheet } from '@/components/insights/RegretPatternDetailSheet';
import { HeatmapCellDetailSheet } from '@/components/insights/HeatmapCellDetailSheet';
import type { Account, TimeOfDayInsight, WeekdayInsight, WeekdayTimeCell } from '@/lib/types';
import {
  buildPatternHero,
  buildRegretAlertStatus,
  findPeakHeatmapCell,
  hasAnyHeatmapData,
} from '@/lib/regretHeatmap';
import { INSIGHTS_THEME } from '@/theme/insightsTheme';

type Props = {
  weekdayTimeInsights: WeekdayTimeCell[];
  weekdayInsights: WeekdayInsight[];
  timeOfDayInsights: TimeOfDayInsight[];
  account: Account | null | undefined;
  onHelpPress?: () => void;
};

export function RegretPatternCard({
  weekdayTimeInsights,
  weekdayInsights,
  timeOfDayInsights,
  account,
  onHelpPress,
}: Props) {
  const [detailOpen, setDetailOpen] = useState(false);
  const [cellDetail, setCellDetail] = useState<WeekdayTimeCell | null>(null);

  const peak = useMemo(() => findPeakHeatmapCell(weekdayTimeInsights), [weekdayTimeInsights]);
  const patternHero = useMemo(() => buildPatternHero(peak), [peak]);
  const alertStatus = useMemo(() => buildRegretAlertStatus(account, peak), [account, peak]);
  const hasData = hasAnyHeatmapData(weekdayTimeInsights);

  return (
    <>
      <View style={styles.card}>
        <View style={styles.header}>
          {onHelpPress ? (
            <Pressable onPress={onHelpPress} hitSlop={8} style={styles.helpBtn} accessibilityLabel="설명">
              <MaterialIcons name="help-outline" size={18} color={INSIGHTS_THEME.textMuted} />
            </Pressable>
          ) : null}
        </View>

        {hasData && patternHero ? (
          <View style={styles.hero}>
            <Text style={styles.heroDayTime}>{patternHero.dayTime}</Text>
            <Text style={styles.heroSubtitle}>{patternHero.subtitle}</Text>
            <Text style={styles.heroRate}>후회율 {patternHero.rate.toFixed(0)}%</Text>
          </View>
        ) : null}

        {hasData ? (
          <>
            <RegretPatternHeatmap
              cells={weekdayTimeInsights}
              onCellPress={(cell) => setCellDetail(cell)}
            />

            {alertStatus ? (
              <Text style={styles.alertHint}>사전 알림 사용 중</Text>
            ) : null}

            <Pressable
              onPress={() => setDetailOpen(true)}
              style={styles.linkBtn}
              accessibilityRole="button"
            >
              <Text style={styles.linkText}>패턴 자세히 보기</Text>
              <MaterialIcons name="chevron-right" size={18} color={INSIGHTS_THEME.link} />
            </Pressable>
          </>
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>리뷰가 더 쌓이면 반복 패턴을 확인할 수 있어요.</Text>
          </View>
        )}
      </View>

      <RegretPatternDetailSheet
        visible={detailOpen}
        onClose={() => setDetailOpen(false)}
        cells={weekdayTimeInsights}
        weekdayInsights={weekdayInsights}
        timeOfDayInsights={timeOfDayInsights}
      />

      <HeatmapCellDetailSheet
        visible={cellDetail !== null}
        cell={cellDetail}
        onClose={() => setCellDetail(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: INSIGHTS_THEME.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: INSIGHTS_THEME.border,
    paddingHorizontal: 20,
    paddingVertical: 20,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: -8,
    marginBottom: -8,
  },
  helpBtn: { padding: 2 },
  hero: {
    gap: 4,
  },
  heroDayTime: {
    fontSize: 22,
    fontWeight: '800',
    color: INSIGHTS_THEME.heroNumber,
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: INSIGHTS_THEME.textSecondary,
    lineHeight: 20,
  },
  heroRate: {
    fontSize: 16,
    fontWeight: '700',
    color: INSIGHTS_THEME.primaryDeep,
    marginTop: 4,
  },
  alertHint: {
    fontSize: 12,
    fontWeight: '600',
    color: INSIGHTS_THEME.mutedGreen,
    textAlign: 'center',
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingTop: 2,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
    color: INSIGHTS_THEME.link,
  },
  empty: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '500',
    color: INSIGHTS_THEME.textMuted,
    textAlign: 'center',
    lineHeight: 19,
  },
});
