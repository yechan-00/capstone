import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useExpenseDetailPalette } from '@/theme/expenseDetailTheme';

type Props = {
  reasonChips: string[];
  tags: string[];
  memo?: string | null;
  summaryLine?: string | null;
};

export function ExpenseReasonSection({ reasonChips, tags, memo, summaryLine }: Props) {
  const p = useExpenseDetailPalette();
  const reasons = reasonChips.map((c) => c.trim()).filter(Boolean);
  const situationTags = tags.map((t) => t.trim()).filter(Boolean);
  const hasAny = reasons.length > 0 || situationTags.length > 0 || Boolean(memo) || Boolean(summaryLine);

  if (!hasAny) return null;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.sectionTitle, { color: p.text }]}>당시의 기록</Text>

      {reasons.length > 0 ? (
        <View style={styles.block}>
          <Text style={[styles.label, { color: p.textMuted }]}>소비 이유</Text>
          <Text style={[styles.body, { color: p.text }]}>{reasons.join(' · ')}</Text>
        </View>
      ) : null}

      {situationTags.length > 0 ? (
        <View style={styles.block}>
          <Text style={[styles.label, { color: p.textMuted }]}>상황</Text>
          <View style={styles.chipRow}>
            {situationTags.map((tag) => (
              <View key={tag} style={[styles.chip, { backgroundColor: p.chipBg }]}>
                <Text style={[styles.chipText, { color: p.chipText }]}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {memo ? (
        <View style={styles.block}>
          <Text style={[styles.label, { color: p.textMuted }]}>상황 메모</Text>
          <Text style={[styles.body, { color: p.textSec }]}>{memo}</Text>
        </View>
      ) : null}

      {summaryLine ? (
        <View style={styles.block}>
          <Text style={[styles.label, { color: p.textMuted }]}>한줄평</Text>
          <Text style={[styles.body, { color: p.textSec }]}>{summaryLine}</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 28,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  block: {
    gap: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.1,
  },
  body: {
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
