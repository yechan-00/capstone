import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { SPACE_TYPE_BY_ID, spaceTypeSoftFill } from '@/lib/spaceTypes';
import type { SpaceDetailRecord } from '@/lib/spaceList';

export function SpaceInviteSummary({ space }: { space: SpaceDetailRecord }) {
  const { colors, isDark } = useTheme();
  const type = space.type ? SPACE_TYPE_BY_ID[space.type] : null;
  const accent = type?.accent ?? colors.primary;

  return (
    <View
      style={[
        styles.summary,
        {
          backgroundColor: spaceTypeSoftFill(accent, isDark),
          borderColor: accent,
        },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.surface }]}>
        <MaterialIcons name={type?.icon ?? 'people-outline'} size={26} color={accent} />
      </View>
      <View style={styles.summaryCopy}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>
          {space.name}
        </Text>
        {type ? (
          <Text style={[styles.typeLabel, { color: colors.text }]}>{type.label} 공간</Text>
        ) : null}
      </View>
    </View>
  );
}

export function SpaceInviteCodeCard({
  code,
  countdown,
  expired,
  accent,
}: {
  code: string;
  countdown: string;
  expired: boolean;
  accent: string;
}) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: expired ? colors.border : accent,
        },
      ]}
    >
      <Text style={[styles.cardTitle, { color: colors.text }]}>초대 코드</Text>
      <Text
        style={[styles.code, { color: colors.text }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.65}
        accessibilityRole="text"
        accessibilityLabel={`초대 코드 ${code.split('').join(' ')}`}
      >
        {code}
      </Text>
      <Text style={[styles.metaLabel, { color: colors.textMuted }]}>유효기간</Text>
      <Text
        style={[styles.countdown, { color: expired ? colors.errorText : colors.text }]}
        accessibilityLabel={`남은 시간 ${countdown}`}
      >
        남은 시간 {countdown}
      </Text>
      {expired ? (
        <Text style={[styles.expired, { color: colors.errorText }]}>
          초대 코드가 만료되었어요. 새 코드를 발급해 주세요.
        </Text>
      ) : (
        <Text style={[styles.hint, { color: colors.textSec }]}>
          함께할 사람에게 이 코드를 알려 주세요.
        </Text>
      )}
    </View>
  );
}

export function SpaceInviteEmptyCard() {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <Text style={[styles.cardTitle, { color: colors.text }]}>아직 발급된 초대 코드가 없어요</Text>
      <Text style={[styles.hint, { color: colors.textSec }]}>
        초대 코드를 만들고 함께할 사람을 초대해 보세요.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  summary: {
    borderRadius: 18,
    borderWidth: 1.5,
    paddingHorizontal: 18,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  summaryCopy: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 28,
  },
  typeLabel: {
    marginTop: 4,
    fontSize: 14,
    fontWeight: '800',
  },
  card: {
    marginTop: 18,
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 18,
    overflow: 'hidden',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: '800',
  },
  code: {
    marginTop: 14,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 4,
    lineHeight: 36,
  },
  metaLabel: {
    marginTop: 16,
    fontSize: 12,
    fontWeight: '700',
  },
  countdown: {
    marginTop: 4,
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  hint: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
  },
  expired: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
  },
});
