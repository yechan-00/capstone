import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SATISFACTION_LEVELS, type SatisfactionTone } from '@/lib/satisfactionScale';

function buildTonePalette(isDark: boolean): Record<
  SatisfactionTone,
  { bg: string; bgSelected: string; border: string; borderSelected: string; text: string }
> {
  if (isDark) {
    return {
      positive: {
        bg: 'rgba(20, 83, 45, 0.35)',
        bgSelected: '#14532d',
        border: 'rgba(74, 222, 128, 0.45)',
        borderSelected: '#4ade80',
        text: '#f8fafc',
      },
      neutral: {
        bg: 'rgba(113, 63, 18, 0.4)',
        bgSelected: '#713f12',
        border: 'rgba(250, 204, 21, 0.5)',
        borderSelected: '#facc15',
        text: '#fef9c3',
      },
      negative: {
        bg: 'rgba(159, 18, 57, 0.35)',
        bgSelected: '#9f1239',
        border: 'rgba(251, 113, 133, 0.55)',
        borderSelected: '#fb7185',
        text: '#fecdd3',
      },
    };
  }
  return {
    positive: {
      bg: '#ecfdf5',
      bgSelected: '#bbf7d0',
      border: '#86efac',
      borderSelected: '#16a34a',
      text: '#14532d',
    },
    neutral: {
      bg: '#fefce8',
      bgSelected: '#fef9c3',
      border: '#fde047',
      borderSelected: '#ca8a04',
      text: '#713f12',
    },
    negative: {
      bg: '#fef2f2',
      bgSelected: '#fecaca',
      border: '#fca5a5',
      borderSelected: '#dc2626',
      text: '#7f1d1d',
    },
  };
}

const PALETTE_LIGHT = buildTonePalette(false);
const PALETTE_DARK = buildTonePalette(true);

export function SatisfactionLevelPicker({
  value,
  onChange,
  isDark,
}: {
  value: number;
  onChange: (stars: number) => void;
  isDark: boolean;
}) {
  const palette = isDark ? PALETTE_DARK : PALETTE_LIGHT;

  return (
    <View style={styles.wrap}>
      {SATISFACTION_LEVELS.map((row) => {
        const selected = value === row.stars;
        const c = palette[row.tone];
        return (
          <Pressable
            key={row.stars}
            onPress={() => onChange(row.stars)}
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: selected ? c.bgSelected : c.bg,
                borderColor: selected ? c.borderSelected : c.border,
                opacity: pressed ? 0.92 : 1,
              },
            ]}
          >
            <Text style={[styles.label, { color: c.text }]}>{row.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  row: {
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 2,
  },
  label: { fontSize: 16, fontWeight: '900', textAlign: 'left', alignSelf: 'stretch' },
});
