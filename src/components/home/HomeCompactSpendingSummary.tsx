import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { budgetRatioColor } from '@/lib/insightsBudgetColors';
import { useTheme } from '@/theme/ThemeContext';

type Props = {
  periodLabel: string;
  totalAmount: number;
  budgetKrw: number;
  expenseCount: number;
  categories: Array<{ label: string; amount: number; emoji: string }>;
};

const LIGHT = {
  text: '#253B32',
  muted: '#87958D',
  accent: '#4D9270',
  mint: '#EAF5EE',
  border: '#E8ECE8',
  track: '#E8ECE8',
};

function formatWon(amount: number): string {
  return `${Math.round(amount).toLocaleString()}원`;
}

export function HomeCompactSpendingSummary({
  periodLabel,
  totalAmount,
  budgetKrw,
  expenseCount,
  categories,
}: Props) {
  const { colors, isDark } = useTheme();
  const hasBudget = budgetKrw > 0;
  const remaining = hasBudget ? budgetKrw - totalAmount : null;
  const over = remaining !== null && remaining < 0;
  const ratioPct = hasBudget ? (totalAmount / budgetKrw) * 100 : 0;
  const barPct = Math.min(100, Math.max(0, ratioPct));
  const barColor = over ? colors.logoutText : budgetRatioColor(ratioPct);

  const palette = isDark
    ? {
        surface: colors.surface,
        border: colors.border,
        text: colors.text,
        muted: colors.textMuted,
        accent: colors.primary,
        mint: colors.surfaceMuted,
        track: colors.border,
      }
    : {
        surface: colors.surface,
        border: LIGHT.border,
        text: LIGHT.text,
        muted: LIGHT.muted,
        accent: LIGHT.accent,
        mint: LIGHT.mint,
        track: LIGHT.track,
      };

  return (
    <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: palette.text }]}>소비 요약</Text>
        <View style={[styles.countBadge, { backgroundColor: palette.mint }]}>
          <Text style={[styles.countText, { color: palette.text }]}>총 {expenseCount}건</Text>
        </View>
      </View>
      <Text style={[styles.period, { color: palette.muted }]}>{periodLabel}</Text>

      <View style={styles.totalBlock}>
        <Text
          style={[styles.total, { color: palette.text }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
        >
          {formatWon(totalAmount)}
        </Text>
        <Text style={[styles.totalCaption, { color: palette.muted }]}>이번 기간 총 소비</Text>
      </View>

      <View style={styles.categoryRow}>
        {categories.map((category) => (
          <View
            key={category.label}
            style={styles.category}
            accessibilityLabel={`${category.label} ${formatWon(category.amount)}`}
          >
            <View style={[styles.emojiWrap, { backgroundColor: palette.mint }]}>
              <Text style={styles.emoji} accessibilityElementsHidden>
                {category.emoji}
              </Text>
            </View>
            <Text style={[styles.categoryLabel, { color: palette.muted }]} numberOfLines={1}>
              {category.label}
            </Text>
            <Text
              style={[styles.categoryAmount, { color: palette.text }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
            >
              {formatWon(category.amount)}
            </Text>
          </View>
        ))}
      </View>

      {hasBudget && remaining !== null ? (
        <View style={[styles.budget, { borderTopColor: palette.border }]}>
          <View style={styles.budgetHead}>
            <Text style={[styles.budgetTitle, { color: palette.muted }]}>이번 달 식비 예산</Text>
            <Text
              style={[styles.budgetRemain, { color: over ? colors.logoutText : palette.text }]}
              numberOfLines={1}
            >
              {over ? `${formatWon(Math.abs(remaining))} 초과` : `${formatWon(remaining)} 남음`}
            </Text>
          </View>
          <View style={[styles.track, { backgroundColor: palette.track }]}>
            <View style={[styles.fill, { width: `${barPct}%`, backgroundColor: barColor }]} />
          </View>
          <Text style={[styles.budgetMeta, { color: palette.muted }]}>
            사용 {formatWon(totalAmount)} / 예산 {formatWon(budgetKrw)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: '800', letterSpacing: -0.2 },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    flexShrink: 0,
  },
  countText: { fontSize: 11, fontWeight: '800' },
  period: { marginTop: 4, fontSize: 12, fontWeight: '600' },
  totalBlock: { marginTop: 12, gap: 2 },
  total: {
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -0.8,
    ...Platform.select({ ios: { fontVariant: ['tabular-nums' as const] }, default: {} }),
  },
  totalCaption: { fontSize: 12, fontWeight: '600' },
  categoryRow: {
    marginTop: 14,
    flexDirection: 'row',
    gap: 8,
  },
  category: {
    flex: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: 4,
  },
  emojiWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 18, lineHeight: 22, textAlign: 'center' },
  categoryLabel: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  categoryAmount: {
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: -0.2,
    ...Platform.select({ ios: { fontVariant: ['tabular-nums' as const] }, default: {} }),
  },
  budget: {
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 8,
  },
  budgetHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
  },
  budgetTitle: { fontSize: 12, fontWeight: '700', flexShrink: 0 },
  budgetRemain: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: '800', textAlign: 'right' },
  track: {
    height: 6,
    borderRadius: 999,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 999,
  },
  budgetMeta: { fontSize: 11, fontWeight: '600' },
});
