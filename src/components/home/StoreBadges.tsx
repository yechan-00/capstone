import React from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { HOME, HOME_COPY } from '@/components/home/homeTheme';
import { HomeText } from '@/components/home/HomeText';

type Props = {
  compact?: boolean;
  align?: 'left' | 'center';
};

export function StoreBadges({ compact, align = 'left' }: Props) {
  const badge = (icon: string, label: string) => (
    <Pressable
      key={label}
      style={({ pressed }) => [
        styles.badge,
        compact && styles.badgeCompact,
        pressed && { opacity: 0.85 },
      ]}
    >
      <HomeText style={[styles.icon, compact && styles.iconCompact]}>{icon}</HomeText>
      <View>
        <HomeText style={[styles.label, compact && styles.labelCompact]}>{label}</HomeText>
        <HomeText style={styles.sub}>{HOME_COPY.storeComingSoon}</HomeText>
      </View>
    </Pressable>
  );

  return (
    <View style={[styles.row, align === 'center' && styles.rowCenter]}>
      {badge('\uF8FF', HOME_COPY.storeAppStore)}
      {badge('▶', HOME_COPY.storeGooglePlay)}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    alignSelf: 'stretch',
  },
  rowCenter: {
    justifyContent: 'center',
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: HOME.dark,
    minWidth: 148,
    ...(Platform.OS === 'web'
      ? ({ cursor: 'default' } as object)
      : {}),
  },
  badgeCompact: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    minWidth: 132,
    borderRadius: 10,
  },
  icon: {
    fontSize: 22,
    color: HOME.white,
    fontWeight: '600',
  },
  iconCompact: { fontSize: 18 },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: HOME.white,
    letterSpacing: -0.2,
  },
  labelCompact: { fontSize: 12 },
  sub: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.65)',
    marginTop: 1,
  },
});
