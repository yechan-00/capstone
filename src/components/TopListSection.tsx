import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';

type Item = {
  key: string; label: string;
  regretRatePercent: number; regretCount: number; totalCount: number;
};

export function TopListSection({ title, items, defaultTopN = 3 }: {
  title: string; items: Item[]; defaultTopN?: number;
}) {
  const { colors } = useTheme();
  const [expanded, setExpanded] = useState(false);
  const sorted = useMemo(() => [...items].sort((a, b) => b.regretRatePercent - a.regretRatePercent), [items]);
  const shown = expanded ? sorted : sorted.slice(0, defaultTopN);
  const canExpand = sorted.length > defaultTopN;
  if (sorted.length === 0) return null;

  return (
    <View style={{ gap: 12 }}>
      <Text style={[styles.h2, { color: colors.text }]}>{title}</Text>
      {shown.map((it) => (
        <View key={it.key} style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.rowLeft}>
            <Text style={[styles.label, { color: colors.text }]}>{it.label}</Text>
            <Text style={[styles.sub, { color: colors.textMuted }]}>{it.regretCount}/{it.totalCount}</Text>
          </View>
          <Text style={[styles.rate, { color: colors.text }]}>{it.regretRatePercent.toFixed(1)}%</Text>
        </View>
      ))}
      {canExpand && (
        <Pressable onPress={() => setExpanded((v) => !v)}>
          <Text style={[styles.more, { color: colors.primary }]}>{expanded ? '접기' : '더보기'}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  h2: { fontSize: 20, fontWeight: '900', marginTop: 10 },
  row: { borderRadius: 16, padding: 14, borderWidth: 1, flexDirection: 'row', alignItems: 'center' },
  rowLeft: { flex: 1 },
  label: { fontWeight: '900', fontSize: 15 },
  sub: { marginTop: 6, fontWeight: '700' },
  rate: { fontWeight: '900', fontSize: 16 },
  more: { fontWeight: '900', textAlign: 'right' },
});
