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
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { CategorySpendRow } from '@/lib/categorySpendBreakdown';
import { useInsightsPalette } from '@/theme/insightsTheme';

type Props = {
  visible: boolean;
  onClose: () => void;
  rows: CategorySpendRow[];
  totalAmountKrw: number;
};

function formatWon(n: number): string {
  return `${Math.round(Math.abs(n)).toLocaleString()}원`;
}

function formatAvg(amount: number, count: number): string {
  if (count <= 0) return '—';
  return `${Math.round(amount / count).toLocaleString()}원`;
}

export function CategorySpendDetailSheet({ visible, onClose, rows, totalAmountKrw }: Props) {
  const t = useInsightsPalette();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: t.overlay }]} onPress={onClose} accessibilityLabel="닫기" />
      <View style={[styles.sheet, { backgroundColor: t.surface, paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={[styles.handle, { backgroundColor: t.border }]} />
        <Text style={[styles.title, { color: t.text }]}>카테고리별 소비</Text>
        <Text style={[styles.subtitle, { color: t.textMuted }]}>소비 금액 기준 · {formatWon(totalAmountKrw)}</Text>

        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {rows.map((row) => (
            <View key={row.key} style={[styles.row, { borderTopColor: t.border }]}>
              <View style={styles.rowHead}>
                <View style={[styles.dot, { backgroundColor: row.color }]} />
                <Text style={[styles.rowLabel, { color: t.text }]}>{row.label}</Text>
                <Text style={[styles.rowAmount, { color: t.text }]}>{formatWon(row.amountKrw)}</Text>
              </View>
              <View style={styles.metaGrid}>
                <View style={styles.metaCell}>
                  <Text style={[styles.metaKey, { color: t.textMuted }]}>비율</Text>
                  <Text style={[styles.metaVal, { color: t.textSecondary }]}>{row.pct.toFixed(0)}%</Text>
                </View>
                <View style={styles.metaCell}>
                  <Text style={[styles.metaKey, { color: t.textMuted }]}>건수</Text>
                  <Text style={[styles.metaVal, { color: t.textSecondary }]}>{row.count}건</Text>
                </View>
                <View style={styles.metaCell}>
                  <Text style={[styles.metaKey, { color: t.textMuted }]}>평균</Text>
                  <Text style={[styles.metaVal, { color: t.textSecondary }]}>{formatAvg(row.amountKrw, row.count)}</Text>
                </View>
                <View style={styles.metaCell}>
                  <Text style={[styles.metaKey, { color: t.textMuted }]}>후회율</Text>
                  <Text style={[styles.metaVal, { color: t.textSecondary }]}>
                    {row.count > 0 ? `${row.regretRate.toFixed(0)}%` : '—'}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </ScrollView>

        <Pressable style={[styles.closeBtn, { backgroundColor: t.mintSoft }]} onPress={onClose} accessibilityRole="button">
          <Text style={[styles.closeBtnText, { color: t.primaryDeep }]}>닫기</Text>
        </Pressable>
      </View>
    </Modal>
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
    maxHeight: '78%',
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
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
    marginBottom: 16,
  },
  list: {
    flexGrow: 0,
  },
  row: {
    borderTopWidth: 1,
    paddingVertical: 14,
    gap: 10,
  },
  rowHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  rowLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
  },
  rowAmount: {
    fontSize: 15,
    fontWeight: '800',
    ...Platform.select({ ios: { fontVariant: ['tabular-nums' as const] }, default: {} }),
  },
  metaGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  metaCell: {
    width: '47%',
    gap: 2,
  },
  metaKey: {
    fontSize: 12,
    fontWeight: '600',
  },
  metaVal: {
    fontSize: 14,
    fontWeight: '700',
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
