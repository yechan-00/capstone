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
import { useInsightsPalette } from '@/theme/insightsTheme';

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
  const t = useInsightsPalette();
  const [detailOpen, setDetailOpen] = useState(false);
  const [cellDetail, setCellDetail] = useState<WeekdayTimeCell | null>(null);

  const peak = useMemo(() => findPeakHeatmapCell(weekdayTimeInsights), [weekdayTimeInsights]);
  const patternHero = useMemo(() => buildPatternHero(peak), [peak]);
  const alertStatus = useMemo(() => buildRegretAlertStatus(account, peak), [account, peak]);
  const hasData = hasAnyHeatmapData(weekdayTimeInsights);

  return (
    <>
      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
        <View style={styles.header}>
          {onHelpPress ? (
            <Pressable onPress={onHelpPress} hitSlop={8} style={styles.helpBtn} accessibilityLabel="설명">
              <MaterialIcons name="help-outline" size={18} color={t.textMuted} />
            </Pressable>
          ) : null}
        </View>

        {hasData && patternHero ? (
          <View style={styles.hero}>
            <Text style={[styles.heroDayTime, { color: t.heroNumber }]}>{patternHero.dayTime}</Text>
            <Text style={[styles.heroSubtitle, { color: t.textSecondary }]}>{patternHero.subtitle}</Text>
            <Text style={[styles.heroRate, { color: t.primaryDeep }]}>후회율 {patternHero.rate.toFixed(0)}%</Text>
          </View>
        ) : null}

        {hasData ? (
          <>
            <RegretPatternHeatmap
              cells={weekdayTimeInsights}
              onCellPress={(cell) => setCellDetail(cell)}
            />

            {alertStatus ? (
              <Text style={[styles.alertHint, { color: t.mutedGreen }]}>사전 알림 사용 중</Text>
            ) : null}

            <Pressable
              onPress={() => setDetailOpen(true)}
              style={styles.linkBtn}
              accessibilityRole="button"
            >
              <Text style={[styles.linkText, { color: t.link }]}>패턴 자세히 보기</Text>
              <MaterialIcons name="chevron-right" size={18} color={t.link} />
            </Pressable>
          </>
        ) : (
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: t.textMuted }]}>리뷰가 더 쌓이면 반복 패턴을 확인할 수 있어요.</Text>
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
    borderRadius: 22,
    borderWidth: 1,
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
    letterSpacing: -0.5,
  },
  heroSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  heroRate: {
    fontSize: 16,
    fontWeight: '700',
    marginTop: 4,
  },
  alertHint: {
    fontSize: 12,
    fontWeight: '600',
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
  },
  empty: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    fontWeight: '500',
    textAlign: 'center',
    lineHeight: 19,
  },
});
