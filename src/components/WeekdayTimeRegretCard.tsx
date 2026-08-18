import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { AnimatedBarFill } from '@/components/AnimatedBarFill';
import {
  buildTimePatternHeadline,
  TIME_OF_DAY_LABELS,
  TIME_OF_DAY_ORDER,
  TIME_OF_DAY_RANGES,
  WEEKDAY_DISPLAY_ORDER,
  weekdayLabel,
} from '@/lib/timePatternInsight';
import type { TimeOfDayInsight, WeekdayInsight } from '@/lib/types';
import { useTheme } from '@/theme/ThemeContext';

const CHART_DARK_BG = '#121816';
const CHART_DARK_BORDER = '#24302B';
const CHART_BAR_IDLE = '#2A3430';
const CHART_NEON = '#BFFF00';

type Props = {
  weekdayInsights: WeekdayInsight[];
  timeOfDayInsights: TimeOfDayInsight[];
  onHelpPress?: (e: GestureResponderEvent) => void;
};

function WeekdayBarChart({
  weekdayInsights,
}: {
  weekdayInsights: WeekdayInsight[];
}) {
  const byWeekday = useMemo(
    () => new Map(weekdayInsights.map((row) => [row.weekday, row])),
    [weekdayInsights],
  );

  const rows = WEEKDAY_DISPLAY_ORDER.map((weekday) => {
    const row = byWeekday.get(weekday) ?? {
      weekday,
      totalCount: 0,
      regretCount: 0,
      regretRate: 0,
    };
    return row;
  });

  const peak = rows.reduce((best, row) => (row.regretRate > best.regretRate ? row : best), rows[0]);

  return (
    <View style={styles.chartCard}>
      <View style={styles.chartHeader}>
        <View style={styles.chartTitleRow}>
          <Text style={styles.chartTitle}>요일별 후회율</Text>
          <MaterialIcons name="info-outline" size={16} color="#7A8A82" />
        </View>
        <View style={styles.chartFilter}>
          <Text style={styles.chartFilterText}>최근 4주</Text>
          <MaterialIcons name="expand-more" size={16} color="#A8B5B0" />
        </View>
      </View>

      <Text style={styles.chartSub}>후회한 소비의 비율(%)</Text>

      <View style={styles.chartPlot}>
        <View style={styles.yAxis}>
          {[100, 75, 50, 25, 0].map((tick) => (
            <Text key={tick} style={styles.yTick}>
              {tick}%
            </Text>
          ))}
        </View>

        <View style={styles.barsArea}>
          {[25, 50, 75].map((tick) => (
            <View key={tick} style={[styles.gridLine, { bottom: `${tick}%` }]} />
          ))}

          <View style={styles.barsRow}>
            {rows.map((row) => {
              const isPeak = row.weekday === peak.weekday && row.regretRate > 0;
              const barPct = Math.min(100, Math.max(0, row.regretRate));
              return (
                <View key={row.weekday} style={styles.barCol}>
                  {isPeak ? (
                    <View style={styles.tooltip}>
                      <Text style={styles.tooltipText}>{row.regretRate.toFixed(0)}%</Text>
                      <View style={styles.tooltipArrow} />
                    </View>
                  ) : (
                    <View style={styles.tooltipSpacer} />
                  )}
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.barFill,
                        {
                          height: `${barPct}%`,
                          backgroundColor: isPeak ? CHART_NEON : CHART_BAR_IDLE,
                        },
                      ]}
                    />
                  </View>
                  <Text style={[styles.barLabel, isPeak && styles.barLabelActive]}>
                    {weekdayLabel(row.weekday).slice(0, 1)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      </View>

      {peak.regretRate > 0 ? (
        <View style={styles.insightBox}>
          <MaterialIcons name="show-chart" size={18} color={CHART_NEON} />
          <Text style={styles.insightText}>
            <Text style={styles.insightAccent}>{weekdayLabel(peak.weekday)}요일</Text>
            의 후회율이 가장 높아요
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function RegretRateRow({
  label,
  subLabel,
  totalCount,
  regretCount,
  regretRate,
  colors,
  delay = 0,
  replay = 0,
}: {
  label: string;
  subLabel?: string;
  totalCount: number;
  regretCount: number;
  regretRate: number;
  colors: ReturnType<typeof useTheme>['colors'];
  delay?: number;
  replay?: number;
}) {
  const barColor = totalCount === 0 ? colors.textMuted : colors.primary;
  const barPct = totalCount === 0 ? 0 : Math.min(100, Math.max(0, regretRate));

  return (
    <View style={[styles.row, { opacity: totalCount === 0 ? 0.5 : 1 }]}>
      <View style={styles.labelCol}>
        <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
          {label}
        </Text>
        {subLabel ? (
          <Text style={[styles.subLabel, { color: colors.textMuted }]} numberOfLines={1}>
            {subLabel}
          </Text>
        ) : null}
      </View>
      <View style={[styles.barTrackLight, { backgroundColor: colors.surfaceMuted }]}>
        <AnimatedBarFill
          pct={barPct}
          delay={delay}
          replay={replay}
          style={[styles.barFillLight, { backgroundColor: barColor }]}
        />
      </View>
      <Text style={[styles.pct, { color: barColor }]} numberOfLines={1}>
        {regretRate.toFixed(0)}%
      </Text>
      <Text style={[styles.meta, { color: colors.textSec }]} numberOfLines={1}>
        {totalCount}건·후회{regretCount}
      </Text>
    </View>
  );
}

export function WeekdayTimeRegretCard({ weekdayInsights, timeOfDayInsights, onHelpPress }: Props) {
  const { colors } = useTheme();
  const [replay, setReplay] = useState(0);
  const headline = buildTimePatternHeadline(weekdayInsights, timeOfDayInsights);
  const byTime = new Map(timeOfDayInsights.map((row) => [row.timeOfDay, row]));

  return (
    <Pressable
      onPress={() => setReplay((r) => r + 1)}
      style={[styles.wrap, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityRole="button"
      accessibilityLabel="탭하면 그래프 애니메이션 다시 보기"
    >
      <View style={styles.headerRow}>
        <View style={styles.headerMain}>
          <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
            요일·시간대 후회 패턴
          </Text>
          <Text style={[styles.sub, { color: colors.textMuted }]} numberOfLines={1}>
            후회가 많은 시간을 파악해 알림에 활용해요
          </Text>
        </View>
        {onHelpPress ? (
          <Pressable
            onPress={onHelpPress}
            hitSlop={8}
            style={styles.helpBtn}
            accessibilityRole="button"
            accessibilityLabel="카드 설명 보기"
          >
            <MaterialIcons name="help-outline" size={20} color={colors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      {headline ? (
        <Text style={[styles.headline, { color: colors.textSec }]} numberOfLines={1} ellipsizeMode="tail">
          {headline}
        </Text>
      ) : null}

      <WeekdayBarChart weekdayInsights={weekdayInsights} />

      <Text style={[styles.sectionLabel, { color: colors.textMuted, marginTop: 4 }]}>시간</Text>
      <View style={styles.list}>
        {TIME_OF_DAY_ORDER.map((slot, i) => {
          const row = byTime.get(slot) ?? {
            timeOfDay: slot,
            totalCount: 0,
            regretCount: 0,
            regretRate: 0,
          };
          return (
            <RegretRateRow
              key={`tod-${slot}`}
              label={TIME_OF_DAY_LABELS[slot]}
              subLabel={TIME_OF_DAY_RANGES[slot]}
              totalCount={row.totalCount}
              regretCount={row.regretCount}
              regretRate={row.regretRate}
              colors={colors}
              delay={i * 45}
              replay={replay}
            />
          );
        })}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 10,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  headerMain: { flex: 1, minWidth: 0, gap: 2 },
  helpBtn: { padding: 2, marginTop: 1 },
  title: { fontSize: 17, fontWeight: '900', letterSpacing: -0.3 },
  sub: { fontSize: 12, fontWeight: '600' },
  headline: { fontSize: 13, fontWeight: '700' },
  sectionLabel: { fontSize: 11, fontWeight: '800' },
  list: { gap: 4 },
  chartCard: {
    backgroundColor: CHART_DARK_BG,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: CHART_DARK_BORDER,
    padding: 14,
    gap: 10,
  },
  chartHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  chartTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chartTitle: { color: '#F1F5F4', fontSize: 16, fontWeight: '800' },
  chartFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: '#1A211E',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: CHART_DARK_BORDER,
  },
  chartFilterText: { color: '#A8B5B0', fontSize: 11, fontWeight: '700' },
  chartSub: { color: '#7A8A82', fontSize: 11, fontWeight: '600' },
  chartPlot: { flexDirection: 'row', gap: 8, height: 168 },
  yAxis: { width: 34, justifyContent: 'space-between', paddingVertical: 18 },
  yTick: { color: '#6B7A74', fontSize: 10, fontWeight: '600', textAlign: 'right' },
  barsArea: { flex: 1, position: 'relative', justifyContent: 'flex-end' },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderTopWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.08)',
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 6,
    height: '100%',
    paddingTop: 24,
    paddingBottom: 18,
  },
  barCol: { flex: 1, alignItems: 'center', height: '100%', justifyContent: 'flex-end' },
  tooltip: {
    backgroundColor: '#1A211E',
    borderWidth: 1,
    borderColor: CHART_NEON,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginBottom: 6,
    alignItems: 'center',
  },
  tooltipText: { color: CHART_NEON, fontSize: 11, fontWeight: '800' },
  tooltipArrow: {
    position: 'absolute',
    bottom: -5,
    width: 8,
    height: 8,
    backgroundColor: '#1A211E',
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: CHART_NEON,
    transform: [{ rotate: '45deg' }],
  },
  tooltipSpacer: { height: 28 },
  barTrack: {
    width: '100%',
    maxWidth: 28,
    flex: 1,
    justifyContent: 'flex-end',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  barFill: {
    width: '100%',
    borderRadius: 8,
    minHeight: 4,
  },
  barLabel: { marginTop: 8, color: '#7A8A82', fontSize: 11, fontWeight: '700' },
  barLabelActive: { color: CHART_NEON },
  insightBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#1A211E',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: CHART_DARK_BORDER,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  insightText: { flex: 1, color: '#F1F5F4', fontSize: 13, fontWeight: '700' },
  insightAccent: { color: CHART_NEON, fontWeight: '800' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  labelCol: { width: 54, flexShrink: 0 },
  label: { fontSize: 12, fontWeight: '800' },
  subLabel: { fontSize: 9, fontWeight: '600' },
  barTrackLight: {
    flex: 1,
    minWidth: 28,
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  barFillLight: { height: '100%', borderRadius: 999 },
  pct: { width: 32, fontSize: 11, fontWeight: '900', textAlign: 'right' },
  meta: { width: 68, fontSize: 10, fontWeight: '700', textAlign: 'right' },
});
