import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type GestureResponderEvent } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { AnimatedBarFill } from '@/components/AnimatedBarFill';
import { regretBarColor } from '@/lib/moodInsightDetail';
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

type Props = {
  weekdayInsights: WeekdayInsight[];
  timeOfDayInsights: TimeOfDayInsight[];
  onHelpPress?: (e: GestureResponderEvent) => void;
};

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
  const barColor = totalCount === 0 ? colors.textMuted : regretBarColor(regretRate, colors);
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
      <View style={[styles.barTrack, { backgroundColor: colors.surfaceMuted }]}>
        <AnimatedBarFill pct={barPct} delay={delay} replay={replay} style={[styles.barFill, { backgroundColor: barColor }]} />
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
  const byWeekday = new Map(weekdayInsights.map((row) => [row.weekday, row]));
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

      <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>요일</Text>
      <View style={styles.list}>
        {WEEKDAY_DISPLAY_ORDER.map((weekday, i) => {
          const row = byWeekday.get(weekday) ?? {
            weekday,
            totalCount: 0,
            regretCount: 0,
            regretRate: 0,
          };
          return (
            <RegretRateRow
              key={`wd-${weekday}`}
              label={`${weekdayLabel(weekday)}요일`}
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
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 8,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  headerMain: { flex: 1, minWidth: 0, gap: 2 },
  helpBtn: { padding: 2, marginTop: 1 },
  title: { fontSize: 17, fontWeight: '900', letterSpacing: -0.3 },
  sub: { fontSize: 12, fontWeight: '600' },
  headline: { fontSize: 13, fontWeight: '700' },
  sectionLabel: { fontSize: 11, fontWeight: '800' },
  list: { gap: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  labelCol: { width: 54, flexShrink: 0 },
  label: { fontSize: 12, fontWeight: '800' },
  subLabel: { fontSize: 9, fontWeight: '600' },
  barTrack: {
    flex: 1,
    minWidth: 28,
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 999 },
  pct: { width: 32, fontSize: 11, fontWeight: '900', textAlign: 'right' },
  meta: { width: 68, fontSize: 10, fontWeight: '700', textAlign: 'right' },
});
