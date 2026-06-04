import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { RegretKeywordChip } from '@/lib/moodInsightDetail';
import { useTheme } from '@/theme/ThemeContext';

type Props = {
  keywords: RegretKeywordChip[];
};

export function MoodInsightKeywordCard({ keywords }: Props) {
  const { colors } = useTheme();
  if (keywords.length === 0) return null;

  return (
    <View style={[styles.wrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
        후회 패턴 키워드
      </Text>
      <View style={styles.chips}>
        {keywords.map((chip) => (
          <View
            key={chip.label}
            style={[styles.chip, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}
          >
            <Text style={[styles.chipText, { color: colors.textSec }]} numberOfLines={1}>
              {chip.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  title: { fontSize: 14, fontWeight: '900' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: '100%',
  },
  chipText: { fontSize: 11, fontWeight: '800' },
});
