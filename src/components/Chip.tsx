import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';

export function Chip({ label, active = false, onPress, disabled = false }: { label: string; active?: boolean; onPress?: () => void; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: active ? colors.chipActiveBg : colors.chipInactiveBg, borderColor: active ? colors.chipActiveBorder : colors.chipInactiveBorder },
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
      onPress={onPress} disabled={disabled}
    >
      <Text style={[styles.text, { color: active ? colors.chipTextActive : colors.chipTextInactive }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, borderWidth: 1 },
  disabled: { opacity: 0.7 },
  pressed: { opacity: 0.85 },
  text: { fontSize: 12, fontWeight: '800' },
});
