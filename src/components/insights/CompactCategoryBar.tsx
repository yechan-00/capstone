import React from 'react';
import { StyleSheet, View } from 'react-native';
import { INSIGHTS_CATEGORY_COLORS, INSIGHTS_CATEGORY_ORDER } from '@/lib/categoryColors';
import type { CategorySpendRow } from '@/lib/categorySpendBreakdown';
import { INSIGHTS_THEME } from '@/theme/insightsTheme';

type Props = {
  rows: CategorySpendRow[];
};

export function CompactCategoryBar({ rows }: Props) {
  const active = rows.filter((r) => r.amountKrw > 0);
  if (active.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <View style={styles.track}>
        {active.map((row) => (
          <View
            key={row.key}
            style={[styles.segment, { flex: row.pct || 0.001, backgroundColor: row.color }]}
          />
        ))}
      </View>
      <View style={styles.labels}>
        {INSIGHTS_CATEGORY_ORDER.map((key) => {
          const row = rows.find((r) => r.key === key);
          if (!row || row.amountKrw <= 0) return null;
          return (
            <View key={key} style={styles.labelItem}>
              <View style={[styles.dot, { backgroundColor: INSIGHTS_CATEGORY_COLORS[key] }]} />
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  track: {
    flexDirection: 'row',
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: INSIGHTS_THEME.chartGrid,
  },
  segment: {
    height: '100%',
    minWidth: 4,
  },
  labels: {
    flexDirection: 'row',
    gap: 8,
  },
  labelItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
