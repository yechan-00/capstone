import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { ThemeColors } from '@/theme/ThemeContext';
import { formatCalendarMonth } from '@/lib/reviewWindow';

export function ReviewMonthHeader({
  month,
  onPrev,
  onNext,
  canGoNext,
  colors,
}: {
  month: Date;
  onPrev: () => void;
  onNext: () => void;
  canGoNext: boolean;
  colors: ThemeColors;
}) {
  return (
    <View style={[styles.header, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Pressable onPress={onPrev} hitSlop={8} accessibilityRole="button" accessibilityLabel="이전 달">
        <MaterialIcons name="chevron-left" size={28} color={colors.primary} />
      </Pressable>
      <Text style={[styles.title, { color: colors.text }]}>{formatCalendarMonth(month)}</Text>
      <Pressable
        onPress={onNext}
        hitSlop={8}
        disabled={!canGoNext}
        accessibilityRole="button"
        accessibilityLabel="다음 달"
        style={{ opacity: canGoNext ? 1 : 0.35 }}
      >
        <MaterialIcons name="chevron-right" size={28} color={colors.primary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
});
