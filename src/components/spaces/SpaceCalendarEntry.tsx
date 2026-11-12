import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SpacePressable } from '@/components/spaces/SpacePressable';
import { useTheme } from '@/theme/ThemeContext';
import { spaceTypeButtonFill, spaceTypeButtonInk, spaceTypeSoftFill } from '@/lib/spaceTypes';

type Props = {
  accent: string;
  onPress: () => void;
};

export function SpaceCalendarEntry({ accent, onPress }: Props) {
  const { colors, isDark } = useTheme();

  return (
    <SpacePressable onPress={onPress} accessibilityLabel="캘린더 열기">
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: accent,
          },
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: spaceTypeSoftFill(accent, isDark) }]}>
          <MaterialIcons name="calendar-today" size={22} color={accent} />
        </View>
        <Text style={[styles.title, { color: colors.text }]}>함께한 날들을 기록해 보세요</Text>
        <Text style={[styles.desc, { color: colors.textSec }]}>
          일정과 추억을 하나의 캘린더에서 확인할 수 있어요.
        </Text>
        <View style={[styles.cta, { backgroundColor: spaceTypeButtonFill(accent, isDark) }]}>
          <Text style={[styles.ctaText, { color: spaceTypeButtonInk(accent, isDark) }]}>
            캘린더 열기
          </Text>
        </View>
      </View>
    </SpacePressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  desc: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  cta: {
    marginTop: 14,
    minHeight: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
  },
  ctaText: {
    fontSize: 13,
    fontWeight: '800',
  },
});
