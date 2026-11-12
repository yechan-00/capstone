import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import {
  SPACE_TYPE_BY_ID,
  SPACE_TYPE_HOME_COPY,
  spaceRoleLabel,
  spaceTypeButtonFill,
  spaceTypeButtonInk,
  spaceTypeSoftFill,
} from '@/lib/spaceTypes';
import type { SpaceDetailRecord } from '@/lib/spaceList';

type Props = {
  space: SpaceDetailRecord;
  role?: string;
  onInvite?: () => void;
};

export function SpaceInfoCard({ space, role, onInvite }: Props) {
  const { colors, isDark } = useTheme();
  const type = space.type ? SPACE_TYPE_BY_ID[space.type] : null;
  const accent = type?.accent ?? colors.primary;
  const roleLabel = spaceRoleLabel(role);
  const tagline = space.type ? SPACE_TYPE_HOME_COPY[space.type] : null;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: spaceTypeSoftFill(accent, isDark),
          borderColor: accent,
        },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.surface }]}>
        <MaterialIcons name={type?.icon ?? 'people-outline'} size={26} color={accent} />
      </View>
      <Text style={[styles.name, { color: colors.text }]}>{space.name}</Text>
      {type ? (
        <Text style={[styles.typeLabel, { color: colors.text }]}>{type.label} 공간</Text>
      ) : null}
      {tagline ? (
        <Text style={[styles.tagline, { color: colors.textSec }]}>{tagline}</Text>
      ) : null}

      <View style={styles.footer}>
        {roleLabel ? (
          <View
            style={[
              styles.badge,
              {
                backgroundColor: colors.surface,
                borderColor: accent,
              },
            ]}
          >
            <Text style={[styles.badgeText, { color: accent }]}>{roleLabel}</Text>
          </View>
        ) : (
          <View />
        )}
        {onInvite ? (
          <Pressable
            onPress={onInvite}
            style={({ pressed }) => [
              styles.invite,
              {
                backgroundColor: spaceTypeButtonFill(accent, isDark, pressed),
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel="초대하기"
          >
            <MaterialIcons name="person-add" size={16} color={spaceTypeButtonInk(accent, isDark)} />
            <Text style={[styles.inviteText, { color: spaceTypeButtonInk(accent, isDark) }]}>
              초대하기
            </Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1.5,
    paddingHorizontal: 18,
    paddingVertical: 18,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  name: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 30,
  },
  typeLabel: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '800',
  },
  tagline: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  footer: {
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  badge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexShrink: 1,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  invite: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 10,
    flexShrink: 0,
  },
  inviteText: {
    fontSize: 13,
    fontWeight: '800',
  },
});
