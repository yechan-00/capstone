import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AnimatedBarFill } from '@/components/AnimatedBarFill';
import type { MoodInsightSummaryRow } from '@/lib/moodInsightDetail';
import { moodSummaryTint, regretBarColor } from '@/lib/moodInsightDetail';
import type { ExpenseMoodKey } from '@/lib/expenseMood';
import { useTheme } from '@/theme/ThemeContext';

type Props = {
  rows: MoodInsightSummaryRow[];
  selectedKey: ExpenseMoodKey | null;
  onSelect: (moodKey: ExpenseMoodKey) => void;
};

export function MoodInsightPatternOverview({ rows, selectedKey, onSelect }: Props) {
  const { colors, isDark } = useTheme();
  const [replay, setReplay] = useState(0);

  return (
    <View style={[styles.wrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
        기분별 후회 패턴
      </Text>

      <View style={styles.list}>
        {rows.map((row, i) => {
          const tint = moodSummaryTint(row.moodKey, isDark);
          const barColor =
            row.totalCount === 0 ? colors.textMuted : regretBarColor(row.regretRate, colors);
          const barPct = row.totalCount === 0 ? 0 : Math.min(100, Math.max(0, row.regretRate));
          const selected = selectedKey === row.moodKey;

          return (
            <Pressable
              key={row.moodKey}
              onPress={() => {
                setReplay((r) => r + 1);
                onSelect(row.moodKey);
              }}
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: selected ? tint.bg : 'transparent',
                  borderColor: selected ? tint.badgeBg : 'transparent',
                  opacity: row.totalCount === 0 ? 0.55 : pressed ? 0.9 : 1,
                },
                selected ? styles.rowSelected : null,
              ]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={`${row.label} 후회 ${row.regretRate.toFixed(0)}%`}
            >
              <View style={[styles.icon, { backgroundColor: tint.iconBg }]}>
                <Text style={styles.emoji}>{row.emoji}</Text>
              </View>

              <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
                {row.label}
              </Text>

              <View style={[styles.barTrack, { backgroundColor: colors.surfaceMuted }]}>
                <AnimatedBarFill
                  pct={barPct}
                  delay={i * 45}
                  replay={replay}
                  style={[styles.barFill, { backgroundColor: barColor }]}
                />
              </View>

              <Text style={[styles.pct, { color: barColor }]} numberOfLines={1}>
                {row.regretRate.toFixed(0)}%
              </Text>

              <Text style={[styles.stats, { color: colors.textSec }]} numberOfLines={1}>
                {row.totalCount}건·{row.totalSpendKrw.toLocaleString()}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  title: { fontSize: 14, fontWeight: '900' },
  list: { gap: 4 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 6,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowSelected: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  icon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  emoji: { fontSize: 14 },
  label: { width: 52, fontSize: 12, fontWeight: '800', flexShrink: 0 },
  barTrack: {
    flex: 1,
    minWidth: 36,
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 999 },
  pct: { width: 34, fontSize: 12, fontWeight: '900', textAlign: 'right', flexShrink: 0 },
  stats: { width: 72, fontSize: 10, fontWeight: '700', textAlign: 'right', flexShrink: 0 },
});
