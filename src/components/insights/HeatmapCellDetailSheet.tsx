import React from 'react';
import {
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { WeekdayTimeCell } from '@/lib/types';
import { cellAccessibilityLabel } from '@/lib/regretHeatmap';
import { TIME_OF_DAY_LABELS, weekdayLabel } from '@/lib/timePatternInsight';
import { INSIGHTS_THEME } from '@/theme/insightsTheme';

type Props = {
  visible: boolean;
  cell: WeekdayTimeCell | null;
  onClose: () => void;
};

function formatWon(n: number): string {
  return `${Math.round(Math.abs(n)).toLocaleString()}원`;
}

export function HeatmapCellDetailSheet({ visible, cell, onClose }: Props) {
  const insets = useSafeAreaInsets();
  if (!cell) return null;

  const avg =
    cell.totalCount > 0 ? Math.round(cell.totalAmountKrw / cell.totalCount) : null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="닫기" />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Text style={styles.title}>
          {weekdayLabel(cell.weekday)} · {TIME_OF_DAY_LABELS[cell.timeOfDay]}
        </Text>
        {cell.totalCount === 0 ? (
          <Text style={styles.body}>이 시간대 기록이 없어요.</Text>
        ) : (
          <View style={styles.rows}>
            <Row label="소비" value={`${cell.totalCount}건`} />
            <Row label="후회" value={`${cell.regretCount}건`} />
            <Row label="후회율" value={`${cell.regretRate.toFixed(0)}%`} />
            {avg !== null ? <Row label="평균 소비" value={formatWon(avg)} /> : null}
          </View>
        )}
        <Text style={styles.a11y}>{cellAccessibilityLabel(cell)}</Text>
        <Pressable style={styles.closeBtn} onPress={onClose} accessibilityRole="button">
          <Text style={styles.closeBtnText}>닫기</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(32, 37, 34, 0.35)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: INSIGHTS_THEME.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: INSIGHTS_THEME.text,
    marginBottom: 12,
  },
  body: {
    fontSize: 14,
    fontWeight: '500',
    color: INSIGHTS_THEME.textMuted,
    marginBottom: 12,
  },
  rows: { gap: 0, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: INSIGHTS_THEME.border,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: INSIGHTS_THEME.textMuted,
  },
  rowValue: {
    fontSize: 15,
    fontWeight: '700',
    color: INSIGHTS_THEME.text,
    ...Platform.select({ ios: { fontVariant: ['tabular-nums' as const] }, default: {} }),
  },
  a11y: {
    fontSize: 12,
    color: INSIGHTS_THEME.textMuted,
    marginBottom: 12,
  },
  closeBtn: {
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
