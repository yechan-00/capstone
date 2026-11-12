import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useTheme } from '@/theme/ThemeContext';
import {
  SPACE_TYPE_BY_ID,
  spaceRoleLabel,
  spaceTypeSoftFill,
  type SpaceListItem,
} from '@/lib/spaceTypes';

type Props = {
  space: SpaceListItem;
  onPress?: (space: SpaceListItem) => void;
  preview?: boolean;
  previewName?: string;
};

export function SpaceListCard({ space, onPress, preview = false, previewName }: Props) {
  const { colors, isDark } = useTheme();
  const type = space.type ? SPACE_TYPE_BY_ID[space.type] : null;
  const title = previewName ?? space.name;
  const roleLabel = spaceRoleLabel(space.role);
  const createdLabel =
    space.createdAt instanceof Date && !Number.isNaN(space.createdAt.getTime())
      ? format(space.createdAt, 'yyyy.M.d')
      : null;
  const listMeta = [type?.label, roleLabel, createdLabel].filter(Boolean).join(' · ');
  const memberLabel =
    !preview && typeof space.memberCount === 'number' ? `멤버 ${space.memberCount}명` : null;
  const caption = preview ? (type?.description ?? memberLabel) : listMeta || memberLabel;
  const iconName = type?.icon ?? 'people-outline';
  const iconColor = type?.accent ?? colors.primary;
  const iconBg = type ? spaceTypeSoftFill(type.accent, isDark) : colors.surfaceMuted;

  return (
    <Pressable
      onPress={() => onPress?.(space)}
      disabled={!onPress || preview}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: type?.accent ?? colors.border,
          opacity: pressed && onPress && !preview ? 0.82 : 1,
        },
      ]}
      accessibilityRole={onPress && !preview ? 'button' : 'none'}
      accessibilityLabel={title}
    >
      <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
        <MaterialIcons name={iconName} size={22} color={iconColor} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        {caption ? (
          <Text style={[styles.meta, { color: colors.textMuted }]} numberOfLines={2}>
            {caption}
          </Text>
        ) : null}
      </View>
      {preview ? null : (
        <MaterialIcons name="chevron-right" size={22} color={colors.textMuted} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 64,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  meta: {
    marginTop: 2,
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
});
