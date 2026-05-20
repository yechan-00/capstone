import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';

export function SettingsCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const { colors, isDark } = useTheme();
  const elev =
    !isDark && Platform.OS !== 'web'
      ? {
          shadowColor: '#1a2d4a',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.06,
          shadowRadius: 12,
          elevation: 2,
        }
      : {};

  const styles = useMemo(
    () =>
      StyleSheet.create({
        wrap: { gap: 8 },
        title: {
          fontSize: 13,
          fontWeight: '600',
          color: colors.textMuted,
          marginLeft: 4,
          letterSpacing: -0.1,
        },
        card: {
          backgroundColor: colors.surface,
          borderRadius: 16,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          overflow: 'hidden',
        },
      }),
    [colors],
  );

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <View style={[styles.card, elev]}>{children}</View>
    </View>
  );
}
