import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ThemeColors } from '@/theme/ThemeContext';

export type ReviewListMode = 'pending' | 'past' | 'liked' | 'history';

const TABS: { id: ReviewListMode; label: string }[] = [
  { id: 'pending', label: '평가하기' },
  { id: 'past', label: '지나간 리뷰' },
  { id: 'history', label: '이전 리뷰' },
  { id: 'liked', label: '좋아요' },
];

type Props = {
  mode: ReviewListMode;
  onChange: (next: ReviewListMode) => void;
  colors: ThemeColors;
  isDark: boolean;
  pendingCount: number;
  likedCount: number;
  historyCount?: number;
};

export function ReviewModeTabs({
  mode,
  onChange,
  colors,
  pendingCount,
  likedCount,
  historyCount,
}: Props) {
  const mintFill = colors.choiceActiveBg;
  const mintText = colors.choiceTextActive;

  const badgeFor = (id: ReviewListMode): number | undefined => {
    if (id === 'pending' && pendingCount > 0) return pendingCount;
    if (id === 'liked' && likedCount > 0) return likedCount;
    if (id === 'history' && historyCount != null && historyCount > 0) return historyCount;
    return undefined;
  };

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {TABS.map((tab) => {
        const selected = tab.id === mode;
        const badge = badgeFor(tab.id);
        return (
          <Pressable
            key={tab.id}
            onPress={() => onChange(tab.id)}
            style={({ pressed }) => [
              styles.tab,
              {
                backgroundColor: selected ? mintFill : 'transparent',
                opacity: pressed ? 0.88 : 1,
              },
            ]}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={tab.label}
          >
            <Text style={[styles.label, { color: selected ? mintText : colors.textMuted }]}>
              {tab.label}
            </Text>
            {badge != null ? (
              <View style={[styles.badge, { backgroundColor: selected ? mintText : colors.surfaceMuted }]}>
                <Text style={[styles.badgeText, { color: selected ? colors.onPrimary : colors.textSec }]}>
                  {badge > 99 ? '99+' : badge}
                </Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingHorizontal: 20,
    gap: 6,
    alignItems: 'center',
  },
  tab: {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
  },
  badge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
});
