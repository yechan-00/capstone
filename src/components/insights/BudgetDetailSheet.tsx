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
import { INSIGHTS_THEME } from '@/theme/insightsTheme';

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
  const insets = useSafeAreaInsets();

  if (!kind) return null;

  const title = kind === 'food' ? '식비 예산' : '월 수입 대비 소비';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="닫기" />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.handle} />
        <Text style={styles.title}>{title}</Text>

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

        <Pressable style={styles.closeBtn} onPress={onClose} accessibilityRole="button">
          <Text style={styles.closeBtnText}>닫기</Text>
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
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={[styles.rowValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
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
    marginBottom: 16,
  },
  rows: { gap: 0 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
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
  closeBtn: {
    marginTop: 16,
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
