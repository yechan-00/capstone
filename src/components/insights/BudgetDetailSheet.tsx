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
import { formatBudgetPeriodRange } from '@/lib/budgetPeriod';
import { budgetRatioColor, budgetRemainColor } from '@/lib/insightsBudgetColors';
import type { FoodBudgetInsight, IncomeInsight } from '@/lib/types';
import { useInsightsPalette } from '@/theme/insightsTheme';

type Props = {
  visible: boolean;
  onClose: () => void;
  kind: 'food' | 'income' | null;
  foodBudget: FoodBudgetInsight | null;
  income: IncomeInsight | null;
  periodStart?: Date;
  periodEnd?: Date;
  periodMode: 'month' | 'year';
};

function formatWon(n: number): string {
  return `${Math.round(Math.abs(n)).toLocaleString()}원`;
}

export function BudgetDetailSheet({
  visible,
  onClose,
  kind,
  foodBudget,
  income,
  periodStart,
  periodEnd,
  periodMode,
}: Props) {
  const t = useInsightsPalette();
  const insets = useSafeAreaInsets();

  if (!kind) return null;

  const title = kind === 'food' ? '식비 예산' : '월 수입 대비 소비';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: t.overlay }]} onPress={onClose} accessibilityLabel="닫기" />
      <View style={[styles.sheet, { backgroundColor: t.surface, paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={[styles.handle, { backgroundColor: t.border }]} />
        <Text style={[styles.title, { color: t.text }]}>{title}</Text>

        {kind === 'food' && foodBudget ? (
          <View style={styles.rows}>
            <Row label="사용" value={formatWon(foodBudget.totalSpendKrw)} />
            <Row label="예산" value={formatWon(foodBudget.budgetKrw)} />
            <Row
              label={foodBudget.isOverBudget ? '초과' : '남은 금액'}
              value={formatWon(foodBudget.isOverBudget ? -foodBudget.remainingKrw : foodBudget.remainingKrw)}
              valueColor={budgetRemainColor(foodBudget.isOverBudget)}
            />
            <Row label="사용률" value={`${foodBudget.spendRatioPercent.toFixed(0)}%`} />
            {periodStart && periodEnd ? (
              <Row label="기간" value={formatBudgetPeriodRange(periodStart, periodEnd)} />
            ) : null}
          </View>
        ) : null}

        {kind === 'income' && income ? (
          <View style={styles.rows}>
            <Row
              label={periodMode === 'year' ? '연간 예산' : '월 수입'}
              value={formatWon(income.budgetKrw)}
            />
            <Row label="이번 기간 소비" value={formatWon(income.totalSpendKrw)} />
            <Row
              label={income.isOverBudget ? '초과' : '남은 금액'}
              value={formatWon(income.isOverBudget ? -income.remainingKrw : income.remainingKrw)}
              valueColor={budgetRemainColor(income.isOverBudget)}
            />
            <Row
              label="소비율"
              value={`${income.spendRatioPercent.toFixed(0)}%`}
              valueColor={budgetRatioColor(income.spendRatioPercent)}
            />
          </View>
        ) : null}

        <Pressable style={[styles.closeBtn, { backgroundColor: t.mintSoft }]} onPress={onClose} accessibilityRole="button">
          <Text style={[styles.closeBtnText, { color: t.primaryDeep }]}>닫기</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

function Row({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  const t = useInsightsPalette();
  return (
    <View style={[styles.row, { borderTopColor: t.border }]}>
      <Text style={[styles.rowLabel, { color: t.textMuted }]}>{label}</Text>
      <Text style={[styles.rowValue, { color: valueColor ?? t.text }]}>{value}</Text>
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
    marginBottom: 16,
  },
  rows: { gap: 0 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderTopWidth: 1,
  },
  rowLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  rowValue: {
    fontSize: 15,
    fontWeight: '700',
    ...Platform.select({ ios: { fontVariant: ['tabular-nums' as const] }, default: {} }),
  },
  closeBtn: {
    marginTop: 16,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 14,
  },
  closeBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
