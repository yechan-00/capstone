import React, { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { CompactCategoryBar } from '@/components/insights/CompactCategoryBar';
import { CategorySpendDetailSheet } from '@/components/insights/CategorySpendDetailSheet';
import { BudgetDetailSheet } from '@/components/insights/BudgetDetailSheet';
import { buildCategorySpendBreakdown } from '@/lib/categorySpendBreakdown';
import { budgetRatioColor } from '@/lib/insightsBudgetColors';
import type { CategoryInsight, FoodBudgetInsight, IncomeInsight } from '@/lib/types';
import { useInsightsPalette } from '@/theme/insightsTheme';

type Props = {
  totalSpendKrw: number;
  categoryInsights: CategoryInsight[];
  foodBudget: FoodBudgetInsight | null;
  income: IncomeInsight | null;
  hasFoodBudget: boolean;
  hasMonthlyIncome: boolean;
  periodStart: Date;
  periodEnd: Date;
  periodMode: 'month' | 'year';
};

function formatWon(n: number): string {
  return `${Math.round(Math.abs(n)).toLocaleString()}원`;
}

export function SpendingSummaryCard({
  totalSpendKrw,
  categoryInsights,
  foodBudget,
  income,
  hasFoodBudget,
  hasMonthlyIncome,
  periodStart,
  periodEnd,
  periodMode,
}: Props) {
  const t = useInsightsPalette();
  const router = useRouter();
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [budgetKind, setBudgetKind] = useState<'food' | 'income' | null>(null);

  const breakdown = useMemo(
    () => buildCategorySpendBreakdown(categoryInsights, totalSpendKrw),
    [categoryInsights, totalSpendKrw],
  );

  const topCategory = breakdown.rows.find((r) => r.amountKrw > 0) ?? null;
  const hasSpend = totalSpendKrw > 0;
  const foodBarPct = foodBudget
    ? Math.min(100, Math.max(0, foodBudget.spendRatioPercent))
    : 0;
  const foodBarColor = foodBudget ? budgetRatioColor(foodBudget.spendRatioPercent) : t.primary;

  return (
    <>
      <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.border }]}>
        {hasSpend ? (
          <>
            <Text style={[styles.amount, { color: t.text }]}>{formatWon(totalSpendKrw)}</Text>
            <Text style={[styles.amountCaption, { color: t.textMuted }]}>이번 기간 소비</Text>

            {foodBudget ? (
              <Pressable
                style={styles.metricBlock}
                onPress={() => setBudgetKind('food')}
                accessibilityRole="button"
                accessibilityLabel="식비 예산 상세"
              >
                <View style={styles.metricHead}>
                  <Text style={[styles.metricLabel, { color: t.textSecondary }]}>식비 예산</Text>
                  <Text style={[styles.metricPct, { color: foodBarColor }]}>
                    {foodBudget.spendRatioPercent.toFixed(0)}%
                  </Text>
                </View>
                <View style={[styles.barTrack, { backgroundColor: t.chartGrid }]}>
                  <View style={[styles.barFill, { width: `${foodBarPct}%`, backgroundColor: foodBarColor }]} />
                </View>
              </Pressable>
            ) : !hasFoodBudget ? (
              <Pressable
                style={styles.setupRow}
                onPress={() => router.push('/(tabs)/settings')}
                accessibilityRole="button"
              >
                <Text style={[styles.setupText, { color: t.link }]}>식비 예산 설정하기</Text>
                <MaterialIcons name="chevron-right" size={18} color={t.link} />
              </Pressable>
            ) : null}

            {income ? (
              <Pressable
                style={styles.metricRow}
                onPress={() => setBudgetKind('income')}
                accessibilityRole="button"
                accessibilityLabel="월 수입 대비 소비 상세"
              >
                <Text style={[styles.metricLabel, { color: t.textSecondary }]}>월 수입 대비</Text>
                <Text style={[styles.metricPctPlain, { color: t.text }]}>{income.spendRatioPercent.toFixed(0)}%</Text>
              </Pressable>
            ) : !hasMonthlyIncome ? (
              <Pressable
                style={styles.setupRow}
                onPress={() => router.push('/(tabs)/settings')}
                accessibilityRole="button"
              >
                <Text style={[styles.setupText, { color: t.link }]}>월 수입 설정하기</Text>
                <MaterialIcons name="chevron-right" size={18} color={t.link} />
              </Pressable>
            ) : null}

            {topCategory ? (
              <View style={styles.categoryBlock}>
                <CompactCategoryBar rows={breakdown.rows} />
                <Text style={[styles.topCategory, { color: t.textSecondary }]}>
                  {topCategory.label} · {formatWon(topCategory.amountKrw)} · {topCategory.pct.toFixed(0)}%
                </Text>
              </View>
            ) : null}

            <Pressable
              onPress={() => setCategoryOpen(true)}
              style={styles.linkBtn}
              accessibilityRole="button"
            >
              <Text style={[styles.linkText, { color: t.link }]}>카테고리 보기</Text>
              <MaterialIcons name="chevron-right" size={18} color={t.link} />
            </Pressable>
          </>
        ) : (
          <Text style={[styles.empty, { color: t.textMuted }]}>아직 소비 기록이 없어요.</Text>
        )}
      </View>

      <CategorySpendDetailSheet
        visible={categoryOpen}
        onClose={() => setCategoryOpen(false)}
        rows={breakdown.rows}
        totalAmountKrw={breakdown.totalAmountKrw}
      />

      <BudgetDetailSheet
        visible={budgetKind !== null}
        onClose={() => setBudgetKind(null)}
        kind={budgetKind}
        foodBudget={foodBudget}
        income={income}
        periodStart={periodStart}
        periodEnd={periodEnd}
        periodMode={periodMode}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 22,
    paddingVertical: 20,
    gap: 16,
  },
  amount: {
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: -0.8,
    ...Platform.select({ ios: { fontVariant: ['tabular-nums' as const] }, default: {} }),
  },
  amountCaption: {
    fontSize: 13,
    fontWeight: '500',
    marginTop: -8,
  },
  metricBlock: { gap: 8 },
  metricHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  metricLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  metricPct: {
    fontSize: 16,
    fontWeight: '700',
  },
  metricPctPlain: {
    fontSize: 16,
    fontWeight: '700',
  },
  barTrack: {
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 999,
  },
  categoryBlock: { gap: 8 },
  topCategory: {
    fontSize: 13,
    fontWeight: '600',
  },
  linkBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingTop: 4,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
  },
  setupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  setupText: {
    fontSize: 14,
    fontWeight: '600',
  },
  empty: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
    paddingVertical: 12,
  },
});
