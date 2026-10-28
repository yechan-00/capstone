import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { WeekdayTimeCell } from '@/lib/types';
import {
  buildHeatmapGrid,
  cellAccessibilityLabel,
  findPeakHeatmapCell,
  regretHeatmapCellColor,
} from '@/lib/regretHeatmap';
import {
  TIME_OF_DAY_LABELS,
  TIME_OF_DAY_ORDER,
  WEEKDAY_DISPLAY_ORDER,
  weekdayLabel,
} from '@/lib/timePatternInsight';
import { INSIGHTS_THEME } from '@/theme/insightsTheme';

type Props = {
  cells: WeekdayTimeCell[];
  onCellPress?: (cell: WeekdayTimeCell) => void;
};

export function RegretPatternHeatmap({ cells, onCellPress }: Props) {
  const grid = useMemo(() => buildHeatmapGrid(cells), [cells]);
  const peak = useMemo(() => findPeakHeatmapCell(cells), [cells]);

  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <View style={styles.timeCol} />
        {WEEKDAY_DISPLAY_ORDER.map((weekday) => (
          <Text key={weekday} style={styles.weekdayLabel}>
            {weekdayLabel(weekday)}
          </Text>
        ))}
      </View>

      {grid.map((row, rowIdx) => {
        const timeOfDay = TIME_OF_DAY_ORDER[rowIdx]!;
        return (
          <View key={timeOfDay} style={styles.row}>
            <Text style={styles.timeLabel}>{TIME_OF_DAY_LABELS[timeOfDay]}</Text>
            {row.map((cell) => {
              const key = `${cell.weekday}:${cell.timeOfDay}`;
              const isPeak =
                peak !== null &&
                peak.weekday === cell.weekday &&
                peak.timeOfDay === cell.timeOfDay &&
                cell.regretCount > 0;
              const color = regretHeatmapCellColor(cell, isPeak);

              return (
                <Pressable
                  key={key}
                  onPress={() => onCellPress?.(cell)}
                  style={[styles.cell, { backgroundColor: color }]}
                  accessibilityRole="button"
                  accessibilityLabel={cellAccessibilityLabel(cell)}
                />
              );
            })}
          </View>
        );
      })}

      <View style={styles.legendRow}>
        <Text style={styles.legendLabel}>적음</Text>
        <View style={styles.legendGradient}>
          <View style={[styles.legendStep, { backgroundColor: INSIGHTS_THEME.heatmapZero }]} />
          <View style={[styles.legendStep, { backgroundColor: INSIGHTS_THEME.heatmapLow }]} />
          <View style={[styles.legendStep, { backgroundColor: INSIGHTS_THEME.heatmapMid }]} />
          <View style={[styles.legendStep, { backgroundColor: INSIGHTS_THEME.heatmapHigh }]} />
          <View style={[styles.legendStep, { backgroundColor: INSIGHTS_THEME.heatmapPeak }]} />
        </View>
        <Text style={styles.legendLabel}>많음</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingLeft: 34,
  },
  timeCol: { width: 0 },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '700',
    color: INSIGHTS_THEME.textMuted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeLabel: {
    width: 30,
    fontSize: 11,
    fontWeight: '600',
    color: INSIGHTS_THEME.textMuted,
  },
  cell: {
    flex: 1,
    aspectRatio: 1,
    maxHeight: 28,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
  },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  legendLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: INSIGHTS_THEME.textMuted,
  },
  legendGradient: {
    flexDirection: 'row',
    gap: 3,
    flex: 1,
    maxWidth: 120,
  },
  legendStep: {
    flex: 1,
    height: 6,
    borderRadius: 3,
  },
});
