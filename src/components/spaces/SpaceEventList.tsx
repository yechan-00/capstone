import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import {
  formatSpaceDayHeading,
  formatSpaceEventTimeLabel,
  resolveSpaceEventAuthor,
  type SpaceEvent,
} from '@/lib/spaceEvent';
import type { SpaceMember } from '@/lib/spaceMembersClient';
import { spaceTypeButtonFill, spaceTypeButtonInk } from '@/lib/spaceTypes';
import { BRAND_GREEN, useTheme } from '@/theme/ThemeContext';

type Props = {
  dateKey: string;
  events: SpaceEvent[];
  members: SpaceMember[];
  accent: string;
  loading: boolean;
  onAdd: () => void;
  onOpen: (event: SpaceEvent) => void;
};

export function SpaceEventList({
  dateKey,
  events,
  members,
  accent,
  loading,
  onAdd,
  onOpen,
}: Props) {
  const { colors, isDark } = useTheme();

  return (
    <View style={styles.wrap}>
      <Text style={[styles.heading, { color: colors.text }]}>{formatSpaceDayHeading(dateKey)}</Text>

      {loading ? (
        <View style={styles.state}>
          <ActivityIndicator size="small" color={BRAND_GREEN} />
        </View>
      ) : events.length === 0 ? (
        <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>아직 일정이 없어요</Text>
          <Text style={[styles.emptyDesc, { color: colors.textSec }]}>
            이 날에 남기고 싶은 약속을 추가해 보세요.
          </Text>
          <Pressable
            onPress={onAdd}
            style={[styles.addBtn, { backgroundColor: spaceTypeButtonFill(accent, isDark) }]}
            accessibilityRole="button"
            accessibilityLabel="일정 추가"
          >
            <Text style={[styles.addBtnText, { color: spaceTypeButtonInk(accent, isDark) }]}>일정 추가</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.list}>
          {events.map((event) => {
            const author = resolveSpaceEventAuthor(event.createdByUid, members);
            return (
              <Pressable
                key={event.id}
                onPress={() => onOpen(event)}
                style={({ pressed }) => [
                  styles.row,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                    opacity: pressed ? 0.88 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={`${event.title}, ${formatSpaceEventTimeLabel(event)}, ${author.displayName}`}
              >
                <ProfileAvatar uri={author.photoURL} name={author.displayName} size={36} accent={accent} />
                <View style={styles.rowBody}>
                  <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                    {event.title}
                  </Text>
                  <Text style={[styles.meta, { color: colors.textSec }]} numberOfLines={1}>
                    {formatSpaceEventTimeLabel(event)} · {author.displayName}
                  </Text>
                </View>
              </Pressable>
            );
          })}
          <Pressable
            onPress={onAdd}
            style={[styles.addBtn, { backgroundColor: spaceTypeButtonFill(accent, isDark), alignSelf: 'flex-start' }]}
            accessibilityRole="button"
            accessibilityLabel="일정 추가"
          >
            <Text style={[styles.addBtnText, { color: spaceTypeButtonInk(accent, isDark) }]}>일정 추가</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 20,
  },
  heading: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 12,
  },
  state: {
    minHeight: 88,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '800',
  },
  emptyDesc: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  addBtn: {
    marginTop: 14,
    minHeight: 40,
    borderRadius: 10,
    paddingHorizontal: 14,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: '800',
  },
  list: {
    gap: 8,
  },
  row: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
  },
  meta: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
  },
});
