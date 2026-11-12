import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';

export function SpaceSummaryCards() {
  const { colors } = useTheme();

  return (
    <View style={styles.row}>
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.title, { color: colors.textMuted }]}>함께한 소비</Text>
        <Text style={[styles.value, { color: colors.text }]}>—</Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>공유 기록 준비 중</Text>
      </View>
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.title, { color: colors.textMuted }]}>추억 기록</Text>
        <Text style={[styles.value, { color: colors.text }]}>—</Text>
        <Text style={[styles.hint, { color: colors.textMuted }]}>추억 기능 준비 중</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  card: {
    flex: 1,
    minHeight: 108,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 14,
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 12,
    fontWeight: '700',
  },
  value: {
    marginTop: 10,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  hint: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
});
