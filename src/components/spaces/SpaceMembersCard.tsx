import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { SpaceMemberAvatar } from '@/components/spaces/SpaceMemberAvatar';
import {
  membersCountLabel,
  shouldShowMembersSpinner,
  spaceMemberRoleLabel,
  type SpaceMember,
} from '@/lib/spaceMembersClient';
import { spaceTypeButtonFill, spaceTypeButtonInk } from '@/lib/spaceTypes';
import { BRAND_GREEN, useTheme } from '@/theme/ThemeContext';

const PREVIEW_LIMIT = 4;

type PreviewProps = {
  members: SpaceMember[];
  status: 'loading' | 'ready' | 'error';
  refreshing: boolean;
  errorMessage: string | null;
  accent: string;
  onRetry: () => void;
  onSeeAll: () => void;
};

export function SpaceMembersPreviewCard({
  members,
  status,
  refreshing,
  errorMessage,
  accent,
  onRetry,
  onSeeAll,
}: PreviewProps) {
  const { colors, isDark } = useTheme();
  const showSpinner = shouldShowMembersSpinner(status, refreshing);
  const countLabel = status === 'ready' ? membersCountLabel(members.length) : null;
  const preview = members.slice(0, PREVIEW_LIMIT);

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
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>멤버</Text>
        {countLabel ? (
          <Text style={[styles.count, { color: colors.textSec }]}>{countLabel}</Text>
        ) : null}
      </View>

      {showSpinner ? (
        <View style={styles.state}>
          <ActivityIndicator size="small" color={BRAND_GREEN} />
        </View>
      ) : status === 'error' ? (
        <View style={styles.errorBox}>
          <Text style={[styles.errorText, { color: colors.textSec }]}>
            {errorMessage ?? '멤버 목록을 불러오지 못했어요.'}
          </Text>
          <Pressable
            onPress={onRetry}
            style={[styles.retry, { backgroundColor: colors.text }]}
            accessibilityRole="button"
            accessibilityLabel="멤버 목록 다시 시도"
          >
            <Text style={[styles.retryText, { color: colors.bg }]}>다시 시도</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.previewRow}>
          <View style={styles.avatars}>
            {preview.map((member, index) => (
              <View
                key={member.uid}
                style={[styles.avatarOverlap, { marginLeft: index === 0 ? 0 : -8, zIndex: preview.length - index }]}
              >
                <SpaceMemberAvatar member={member} accent={accent} size={32} />
              </View>
            ))}
          </View>
          <Pressable
            onPress={onSeeAll}
            style={({ pressed }) => [
              styles.seeAll,
              { backgroundColor: spaceTypeButtonFill(accent, isDark, pressed) },
            ]}
            accessibilityRole="button"
            accessibilityLabel="멤버 전체 보기"
          >
            <Text style={[styles.seeAllText, { color: spaceTypeButtonInk(accent, isDark) }]}>
              전체 보기
            </Text>
            <MaterialIcons name="chevron-right" size={18} color={spaceTypeButtonInk(accent, isDark)} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

type RowProps = {
  member: SpaceMember;
  accent: string;
  isCurrentUser?: boolean;
  onRemove?: () => void;
  removing?: boolean;
};

export function SpaceMemberRow({
  member,
  accent,
  isCurrentUser = false,
  onRemove,
  removing = false,
}: RowProps) {
  const { colors } = useTheme();
  const roleLabel = spaceMemberRoleLabel(member.role);
  const joinedLabel =
    member.joinedAt instanceof Date && !Number.isNaN(member.joinedAt.getTime())
      ? format(member.joinedAt, 'yyyy.M.d')
      : null;

  return (
    <View
      style={[
        styles.row,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      <SpaceMemberAvatar member={member} accent={accent} size={40} />
      <View style={styles.rowCopy}>
        <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>
          {member.displayName}
        </Text>
        <Text style={[styles.rowMeta, { color: colors.textMuted }]} numberOfLines={1}>
          {[roleLabel, isCurrentUser ? '나' : null, joinedLabel].filter(Boolean).join(' · ')}
        </Text>
      </View>
      <View style={styles.rowActions}>
        <View
          style={[
            styles.roleBadge,
            {
              backgroundColor: colors.bg,
              borderColor: member.role === 'owner' ? accent : colors.border,
            },
          ]}
        >
          <Text
            style={[
              styles.roleBadgeText,
              { color: member.role === 'owner' ? accent : colors.textSec },
            ]}
          >
            {roleLabel}
          </Text>
        </View>
        {onRemove ? (
          <Pressable
            onPress={onRemove}
            disabled={removing}
            hitSlop={8}
            style={({ pressed }) => [
              styles.removeBtn,
              {
                borderColor: colors.logoutBorder,
                backgroundColor: colors.surface,
                opacity: removing || pressed ? 0.72 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={`${member.displayName} 내보내기`}
          >
            {removing ? (
              <ActivityIndicator size="small" color={colors.logoutText} />
            ) : (
              <Text style={[styles.removeText, { color: colors.logoutText }]}>내보내기</Text>
            )}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
  },
  count: {
    fontSize: 13,
    fontWeight: '700',
  },
  state: {
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  previewRow: {
    marginTop: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  avatars: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatarOverlap: {},
  errorBox: {
    marginTop: 12,
  },
  errorText: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  retry: {
    marginTop: 12,
    minHeight: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  retryText: {
    fontSize: 13,
    fontWeight: '800',
  },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 36,
    paddingHorizontal: 12,
    borderRadius: 10,
    flexShrink: 0,
  },
  seeAllText: {
    fontSize: 13,
    fontWeight: '800',
  },
  row: {
    minHeight: 64,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowCopy: {
    flex: 1,
    minWidth: 0,
  },
  rowName: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  rowMeta: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '600',
  },
  roleBadge: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexShrink: 0,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '800',
  },
  rowActions: {
    alignItems: 'flex-end',
    gap: 8,
    flexShrink: 0,
  },
  removeBtn: {
    minHeight: 32,
    minWidth: 72,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: {
    fontSize: 12,
    fontWeight: '800',
  },
});
