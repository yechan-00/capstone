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
import { INSIGHTS_THEME } from '@/theme/insightsTheme';

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
  const insets = useSafeAreaInsets();
  const peak = findPeakHeatmapCell(cells);
  const byWeekday = new Map(weekdayInsights.map((r) => [r.weekday, r]));
  const byTime = new Map(timeOfDayInsights.map((r) => [r.timeOfDay, r]));

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="닫기" />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.handle} />
        <Text style={styles.title}>후회 패턴</Text>
        <Text style={styles.subtitle}>후회율 = 후회 리뷰 수 ÷ 기록 건수 × 100</Text>

        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {peak ? (
            <View style={styles.peakBox}>
              <Text style={styles.peakTitle}>가장 높은 패턴</Text>
              <Text style={styles.peakText}>{cellAccessibilityLabel(peak)}</Text>
            </View>
          ) : null}

          <Text style={styles.sectionTitle}>요일별</Text>
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

          <Text style={[styles.sectionTitle, { marginTop: 12 }]}>시간대별</Text>
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

        <Pressable style={styles.closeBtn} onPress={onClose} accessibilityRole="button">
          <Text style={styles.closeBtnText}>닫기</Text>
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
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowMeta}>
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
    backgroundColor: 'rgba(32, 37, 34, 0.35)',
  },
  sheet: {
    backgroundColor: INSIGHTS_THEME.surface,
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
    backgroundColor: INSIGHTS_THEME.border,
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: INSIGHTS_THEME.text,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: '600',
    color: INSIGHTS_THEME.textMuted,
    marginTop: 4,
    marginBottom: 14,
  },
  list: { flexGrow: 0 },
  peakBox: {
    backgroundColor: INSIGHTS_THEME.mintSoft,
    borderRadius: 14,
    padding: 12,
    gap: 4,
    marginBottom: 12,
  },
  peakTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: INSIGHTS_THEME.primaryDeep,
  },
  peakText: {
    fontSize: 14,
    fontWeight: '600',
    color: INSIGHTS_THEME.text,
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: INSIGHTS_THEME.textSecondary,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: INSIGHTS_THEME.border,
  },
  rowLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: INSIGHTS_THEME.text,
  },
  rowMeta: {
    fontSize: 13,
    fontWeight: '600',
    color: INSIGHTS_THEME.textSecondary,
    ...Platform.select({ ios: { fontVariant: ['tabular-nums' as const] }, default: {} }),
  },
  closeBtn: {
    marginTop: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: INSIGHTS_THEME.mintSoft,
  },
  closeBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: INSIGHTS_THEME.primaryDeep,
  },
});
