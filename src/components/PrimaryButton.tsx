import React from 'react';
import { Pressable, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';

export function PrimaryButton({ label, onPress, disabled, style }: { label: string; onPress: () => void; disabled?: boolean; style?: ViewStyle }) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress} disabled={disabled}
      style={({ pressed }) => [styles.base, { backgroundColor: colors.accentCta }, disabled && styles.disabled, pressed && !disabled && styles.pressed, style]}
    >
      <Text style={[styles.text, { color: colors.onPrimary }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  text: { fontWeight: '900' },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
});
