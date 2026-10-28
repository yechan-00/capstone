import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import {
  INSIGHTS_CATEGORY_COLORS,
  INSIGHTS_CATEGORY_LABELS,
} from '@/lib/categoryColors';
import { INSIGHTS_THEME, insightsCardShadow } from '@/theme/insightsTheme';

const WD_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
const WD_LABELS = ['월', '화', '수', '목', '금', '토', '일'];
const CAT_ORDER = ['takeout', 'delivery', 'cafe'] as const;

type Props = {
  weekdayExpenseCounts: number[];
  weekdayCategoryCounts: Array<Record<string, number>>;
  embedded?: boolean;
};

export function WeekdaySpendFrequencyCard({
  weekdayExpenseCounts,
  weekdayCategoryCounts,
  embedded = false,
}: Props) {
  const wd = weekdayExpenseCounts ?? [0, 0, 0, 0, 0, 0, 0];
  const wdCat = weekdayCategoryCounts ?? Array.from({ length: 7 }, () => ({}));
  const wdMax = useMemo(() => Math.max(1, ...WD_ORDER.map((d) => wd[d] ?? 0)), [wd]);

  const hasData = WD_ORDER.some((d) => (wd[d] ?? 0) > 0);

  return (
    <View style={[styles.card, embedded && styles.embedded]}>
      {!embedded ? (
        <>
          <Text style={styles.title}>요일별 소비</Text>
          <Text style={styles.subtitle}>기록 건수 기준 · 요일별 소비 빈도</Text>
        </>
      ) : null}

      {hasData ? (
        <>
          <View style={styles.barRow}>
            {WD_ORDER.map((dayIdx, i) => {
              const total = wd[dayIdx] ?? 0;
              const barMax = 72;
              const totalH = total === 0 ? 0 : Math.max(4, (total / wdMax) * barMax);
              const catData = wdCat[dayIdx] ?? {};
              const segments = CAT_ORDER.filter((c) => (catData[c] ?? 0) > 0).map((c) => ({
                key: c,
                color: INSIGHTS_CATEGORY_COLORS[c],
                h: total > 0 ? Math.max(2, ((catData[c] ?? 0) / total) * totalH) : 0,
              }));

              return (
                <View key={dayIdx} style={styles.barCol}>
                  <View style={styles.barTrack}>
                    <View style={{ width: '100%', height: totalH, justifyContent: 'flex-end' }}>
                      {segments.map((seg) => (
                        <View
                          key={seg.key}
                          style={[styles.barFill, { height: seg.h, backgroundColor: seg.color }]}
                        />
                      ))}
                    </View>
                  </View>
                  <Text style={styles.barLabel}>{WD_LABELS[i]}</Text>
                </View>
              );
            })}
          </View>

          <View style={styles.legendRow}>
            {CAT_ORDER.map((c) => (
              <View key={c} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: INSIGHTS_CATEGORY_COLORS[c] }]} />
                <Text style={styles.legendText}>{INSIGHTS_CATEGORY_LABELS[c]}</Text>
              </View>
            ))}
          </View>
        </>
      ) : (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>소비 기록이 쌓이면 요일별 빈도를 확인할 수 있어요.</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: INSIGHTS_THEME.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: INSIGHTS_THEME.border,
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 12,
    ...insightsCardShadow(),
  },
  embedded: {
    shadowOpacity: 0,
    elevation: 0,
    borderWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: INSIGHTS_THEME.text,
    letterSpacing: -0.2,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '500',
    color: INSIGHTS_THEME.textMuted,
    marginTop: -4,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 6,
    paddingTop: 4,
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  barTrack: {
    width: '100%',
    maxWidth: 22,
    height: 72,
    justifyContent: 'flex-end',
    borderRadius: 6,
    backgroundColor: INSIGHTS_THEME.chartGrid,
    overflow: 'hidden',
  },
  barFill: {
    width: '100%',
  },
  barLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: INSIGHTS_THEME.textMuted,
  },
  legendRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '600',
    color: INSIGHTS_THEME.textMuted,
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
