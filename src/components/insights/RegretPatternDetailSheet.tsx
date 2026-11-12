import React from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { TimeOfDayInsight, WeekdayInsight, WeekdayTimeCell } from '@/lib/types';
import {
  TIME_OF_DAY_LABELS,
  TIME_OF_DAY_ORDER,
  TIME_OF_DAY_RANGES,
  WEEKDAY_DISPLAY_ORDER,
  weekdayLabel,
} from '@/lib/timePatternInsight';
import { cellAccessibilityLabel, findPeakHeatmapCell } from '@/lib/regretHeatmap';
import { useInsightsPalette } from '@/theme/insightsTheme';

type Props = {
  visible: boolean;
  onClose: () => void;
  cells: WeekdayTimeCell[];
  weekdayInsights: WeekdayInsight[];
  timeOfDayInsights: TimeOfDayInsight[];
};

export function RegretPatternDetailSheet({
  visible,
  onClose,
  cells,
  weekdayInsights,
  timeOfDayInsights,
}: Props) {
  const t = useInsightsPalette();
  const insets = useSafeAreaInsets();
  const peak = findPeakHeatmapCell(cells);
  const byWeekday = new Map(weekdayInsights.map((r) => [r.weekday, r]));
  const byTime = new Map(timeOfDayInsights.map((r) => [r.timeOfDay, r]));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: t.overlay }]} onPress={onClose} accessibilityLabel="닫기" />
      <View style={[styles.sheet, { backgroundColor: t.surface, paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={[styles.handle, { backgroundColor: t.border }]} />
        <Text style={[styles.title, { color: t.text }]}>후회 패턴</Text>
        <Text style={[styles.subtitle, { color: t.textMuted }]}>후회율 = 후회 리뷰 수 ÷ 기록 건수 × 100</Text>

        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {peak ? (
            <View style={[styles.peakBox, { backgroundColor: t.mintSoft }]}>
              <Text style={[styles.peakTitle, { color: t.primaryDeep }]}>가장 높은 패턴</Text>
              <Text style={[styles.peakText, { color: t.text }]}>{cellAccessibilityLabel(peak)}</Text>
            </View>
          ) : null}

          <Text style={[styles.sectionTitle, { color: t.textSecondary }]}>요일별</Text>
          {WEEKDAY_DISPLAY_ORDER.map((weekday) => {
            const row = byWeekday.get(weekday) ?? {
              weekday,
              totalCount: 0,
              regretCount: 0,
              regretRate: 0,
            };
            return (
              <DetailRow
                key={weekday}
                label={`${weekdayLabel(weekday)}요일`}
                totalCount={row.totalCount}
                regretCount={row.regretCount}
                regretRate={row.regretRate}
              />
            );
          })}

          <Text style={[styles.sectionTitle, { color: t.textSecondary, marginTop: 12 }]}>시간대별</Text>
          {TIME_OF_DAY_ORDER.map((slot) => {
            const row = byTime.get(slot) ?? {
              timeOfDay: slot,
              totalCount: 0,
              regretCount: 0,
              regretRate: 0,
            };
            return (
              <DetailRow
                key={slot}
                label={`${TIME_OF_DAY_LABELS[slot]} (${TIME_OF_DAY_RANGES[slot]})`}
                totalCount={row.totalCount}
                regretCount={row.regretCount}
                regretRate={row.regretRate}
              />
            );
          })}
        </ScrollView>

        <Pressable style={[styles.closeBtn, { backgroundColor: t.mintSoft }]} onPress={onClose} accessibilityRole="button">
          <Text style={[styles.closeBtnText, { color: t.primaryDeep }]}>닫기</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function DetailRow({
  label,
  totalCount,
  regretCount,
  regretRate,
}: {
  label: string;
  totalCount: number;
  regretCount: number;
  regretRate: number;
}) {
  const t = useInsightsPalette();
  return (
    <View style={[styles.row, { borderTopColor: t.border }]}>
      <Text style={[styles.rowLabel, { color: t.text }]}>{label}</Text>
      <Text style={[styles.rowMeta, { color: t.textSecondary }]}>
        {totalCount > 0
          ? `${totalCount}건 · 후회 ${regretCount} · ${regretRate.toFixed(0)}%`
          : '기록 없음'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: '82%',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 14,
  },
  list: { flexGrow: 0 },
  peakBox: {
    borderRadius: 14,
    padding: 12,
    gap: 4,
    marginBottom: 12,
  },
  peakTitle: {
    fontSize: 12,
    fontWeight: '700',
  },
  peakText: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  rowLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  rowMeta: {
    fontSize: 13,
    fontWeight: '600',
    ...Platform.select({ ios: { fontVariant: ['tabular-nums' as const] }, default: {} }),
  },
  closeBtn: {
    marginTop: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 14,
  },
  closeBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
