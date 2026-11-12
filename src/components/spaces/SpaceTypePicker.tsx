import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import {
  SPACE_TYPE_OPTIONS,
  spaceTypeSoftFill,
  type SpaceTypeId,
  type SpaceTypeOption,
} from '@/lib/spaceTypes';

type Props = {
  value: SpaceTypeId | null;
  onChange: (type: SpaceTypeId) => void;
  disabled?: boolean;
};

export function SpaceTypePicker({ value, onChange, disabled = false }: Props) {
  const { colors, isDark, animationsEnabled } = useTheme();
  const { width } = useWindowDimensions();
  const [reduceMotion, setReduceMotion] = useState(false);
  const cardWidth = Math.floor((width - 40 - 10) / 2);

  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (alive) setReduceMotion(enabled);
      })
      .catch(() => {});
    const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduceMotion);
    return () => {
      alive = false;
      sub?.remove?.();
    };
  }, []);

  return (
    <View>
      <Text style={[styles.sectionTitle, { color: colors.text }]}>어떤 공간인가요?</Text>
      <Text style={[styles.sectionHint, { color: colors.textSec }]}>
        함께할 사람들과 기록의 성격을 선택해 주세요.
      </Text>
      <View style={styles.grid}>
        {SPACE_TYPE_OPTIONS.map((option) => (
          <SpaceTypeCard
            key={option.id}
            option={option}
            selected={value === option.id}
            width={cardWidth}
            isDark={isDark}
            animate={animationsEnabled && !reduceMotion}
            textColor={colors.text}
            mutedColor={colors.textSec}
            borderColor={colors.border}
            surface={colors.surface}
            disabled={disabled}
            onPress={() => onChange(option.id)}
          />
        ))}
      </View>
    </View>
  );
}

function SpaceTypeCard({
  option,
  selected,
  width,
  isDark,
  animate,
  textColor,
  mutedColor,
  borderColor,
  surface,
  disabled,
  onPress,
}: {
  option: SpaceTypeOption;
  selected: boolean;
  width: number;
  isDark: boolean;
  animate: boolean;
  textColor: string;
  mutedColor: string;
  borderColor: string;
  surface: string;
  disabled: boolean;
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!animate) {
      scale.setValue(1);
      return;
    }
    Animated.spring(scale, {
      toValue: selected ? 1.015 : 1,
      useNativeDriver: true,
      friction: 9,
      tension: 140,
    }).start();
  }, [animate, scale, selected]);

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityLabel={`${option.label}. ${option.description}`}
      style={({ pressed }) => [{ width, opacity: pressed && !disabled ? 0.88 : 1 }]}
    >
      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: selected ? spaceTypeSoftFill(option.accent, isDark) : surface,
            borderColor: selected ? option.accent : borderColor,
            transform: [{ scale }],
          },
        ]}
      >
        <View style={styles.cardTop}>
          <View style={[styles.iconWrap, { backgroundColor: spaceTypeSoftFill(option.accent, isDark) }]}>
            <MaterialIcons name={option.icon} size={20} color={option.accent} />
          </View>
          {selected ? (
            <MaterialIcons name="check-circle" size={18} color={option.accent} />
          ) : (
            <View style={[styles.unchecked, { borderColor }]} />
          )}
        </View>
        <Text style={[styles.cardTitle, { color: textColor }]}>{option.label}</Text>
        <Text style={[styles.cardDesc, { color: mutedColor }]}>{option.description}</Text>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  sectionHint: {
    marginTop: 4,
    marginBottom: 12,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    minHeight: 118,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unchecked: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  cardDesc: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 17,
  },
});
