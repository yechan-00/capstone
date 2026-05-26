import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { ThemeColors } from '@/theme/ThemeContext';

export type ReviewListMode = 'pending' | 'past' | 'liked' | 'history';

const MODES: {
  id: ReviewListMode;
  label: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
}[] = [
  { id: 'pending', label: '평가하기', icon: 'rate-review' },
  { id: 'past', label: '지나간 리뷰', icon: 'history' },
  { id: 'history', label: '이전 리뷰', icon: 'collections-bookmark' },
  { id: 'liked', label: '좋아요', icon: 'favorite' },
];

export function ReviewModeSwitcher({
  mode,
  onChange,
  colors,
  isDark,
  bottom,
  right = 14,
  pendingCount,
  likedCount,
  historyCount,
}: {
  mode: ReviewListMode;
  onChange: (next: ReviewListMode) => void;
  colors: ThemeColors;
  isDark: boolean;
  bottom: number;
  right?: number;
  pendingCount: number;
  likedCount: number;
  historyCount?: number;
}) {
  const [open, setOpen] = React.useState(false);
  const active = MODES.find((m) => m.id === mode) ?? MODES[0];

  const badgeFor = (id: ReviewListMode): number | undefined => {
    if (id === 'pending' && pendingCount > 0) return pendingCount;
    if (id === 'liked' && likedCount > 0) return likedCount;
    if (id === 'history' && historyCount != null && historyCount > 0) return historyCount;
    return undefined;
  };

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom, right }]}>
      {open ? (
        <View style={[styles.menu, { backgroundColor: colors.surface, borderColor: colors.border }, !isDark && styles.menuElev]}>
          {MODES.map((item) => {
            const selected = item.id === mode;
            const badge = badgeFor(item.id);
            return (
              <Pressable
                key={item.id}
                style={({ pressed }) => [
                  styles.menuRow,
                  selected && { backgroundColor: colors.choiceActiveBg },
                  pressed && { opacity: 0.9 },
                ]}
                onPress={() => {
                  onChange(item.id);
                  setOpen(false);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={item.label}
              >
                <MaterialIcons
                  name={item.icon}
                  size={20}
                  color={selected ? colors.accentBlue : colors.textSec}
                />
                <Text
                  style={[
                    styles.menuLabel,
                    { color: selected ? colors.accentBlue : colors.text },
                  ]}
                  numberOfLines={1}
                >
                  {item.label}
                </Text>
                {badge != null ? (
                  <View style={[styles.badge, { backgroundColor: colors.accentBlue }]}>
                    <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <Pressable
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: colors.accentCta, opacity: pressed ? 0.92 : 1 },
          !isDark && styles.fabElev,
        ]}
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={`리뷰 보기: ${active.label}`}
        accessibilityState={{ expanded: open }}
      >
        <MaterialIcons name={active.icon} size={22} color={colors.onPrimary} />
        <Text style={[styles.fabLabel, { color: colors.onPrimary }]} numberOfLines={1}>
          {active.label}
        </Text>
        <MaterialIcons name={open ? 'expand-more' : 'expand-less'} size={20} color={colors.onPrimary} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    alignItems: 'flex-end',
    zIndex: 20,
    gap: 8,
  },
  menu: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    minWidth: 176,
  },
  menuElev: {
    shadowColor: '#1a2d4a',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 6,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  menuLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: '800',
  },
  badge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '900',
  },
  fab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    maxWidth: 160,
  },
  fabElev: {
    shadowColor: '#1a2d4a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 10,
    elevation: 8,
  },
  fabLabel: {
    fontSize: 13,
    fontWeight: '900',
    flexShrink: 1,
  },
});
