import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';

type Props = {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  subtitle?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  showChevron?: boolean;
  last?: boolean;
};

export function SettingsRow({
  icon,
  title,
  subtitle,
  onPress,
  rightElement,
  showChevron = !!onPress,
  last = false,
}: Props) {
  const { colors } = useTheme();
  const styles = useMemo(
    () =>
      StyleSheet.create({
        row: {
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 14,
          gap: 12,
          borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        iconWrap: {
          width: 28,
          alignItems: 'center',
        },
        body: { flex: 1, minWidth: 0, gap: 3 },
        title: {
          fontSize: 16,
          fontWeight: '800',
          color: colors.text,
          letterSpacing: -0.2,
        },
        subtitle: {
          fontSize: 13,
          fontWeight: '600',
          color: colors.textMuted,
        },
        chevron: { marginLeft: 4 },
      }),
    [colors, last],
  );

  const inner = (
    <>
      <View style={styles.iconWrap}>
        <MaterialIcons name={icon} size={22} color={colors.textMuted} />
      </View>
      <View style={styles.body}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {rightElement}
      {showChevron && !rightElement ? (
        <MaterialIcons name="chevron-right" size={22} color={colors.textMuted} style={styles.chevron} />
      ) : null}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        style={({ pressed }) => [styles.row, pressed && { opacity: 0.88 }]}
        accessibilityRole="button"
      >
        {inner}
      </Pressable>
    );
  }

  return <View style={styles.row}>{inner}</View>;
}
