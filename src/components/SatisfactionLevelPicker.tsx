import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { SATISFACTION_LEVELS } from '@/lib/satisfactionScale';
import { useTheme } from '@/theme/ThemeContext';

function SatisfactionChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      style={({ pressed }) => [
        styles.chip,
        {
          backgroundColor: selected ? colors.choiceActiveBg : colors.surface,
          borderColor: selected ? colors.choiceActiveBorder : colors.border,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
    >
      <Text
        style={[styles.label, { color: selected ? colors.choiceTextActive : colors.text }]}
        numberOfLines={2}
      >
        {label}
      </Text>
      {selected ? (
        <MaterialIcons name="check" size={16} color={colors.choiceTextActive} />
      ) : null}
    </Pressable>
  );
}

export function SatisfactionLevelPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (stars: number) => void;
  isDark?: boolean;
}) {
  const top = SATISFACTION_LEVELS.filter((row) => row.stars >= 3);
  const bottom = SATISFACTION_LEVELS.filter((row) => row.stars <= 2);

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {top.map((row) => (
          <SatisfactionChip
            key={row.stars}
            label={row.label}
            selected={value === row.stars}
            onPress={() => onChange(row.stars)}
          />
        ))}
      </View>
      <View style={styles.row}>
        {bottom.map((row) => (
          <SatisfactionChip
            key={row.stars}
            label={row.label}
            selected={value === row.stars}
            onPress={() => onChange(row.stars)}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  row: { flexDirection: 'row', gap: 8 },
  chip: {
    flex: 1,
    minHeight: 48,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },
});
