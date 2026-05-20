import React from 'react';
import { Pressable, StyleProp, Text, ViewStyle, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';

export function Chip({
  label,
  active = false,
  onPress,
  disabled = false,
  compact = false,
  soft = false,
  style,
}: {
  label: string;
  active?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  compact?: boolean;
  soft?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        compact && styles.compact,
        compact && soft && styles.compactSoft,
        {
          backgroundColor: active ? colors.chipActiveBg : colors.chipInactiveBg,
          borderColor: active ? colors.chipActiveBorder : colors.chipInactiveBorder,
        },
        style,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text
        style={[
          styles.text,
          compact && styles.textCompact,
          compact && soft && styles.textSoft,
          { color: active ? colors.chipTextActive : colors.chipTextInactive },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.82}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  compact: { paddingHorizontal: 6, paddingVertical: 7, borderRadius: 10, minWidth: 0 },
  compactSoft: { paddingHorizontal: 8, paddingVertical: 9, borderRadius: 16 },
  disabled: { opacity: 0.7 },
  pressed: { opacity: 0.85 },
  text: { fontSize: 12, fontWeight: '800', textAlign: 'center' },
  textCompact: { fontSize: 11, letterSpacing: -0.3 },
  textSoft: { fontWeight: '700' },
});
