import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import {
  formatSpaceDayHeading,
  formatSpaceEventCreatedAt,
  formatSpaceEventTimeLabel,
  resolveSpaceEventAuthor,
  type SpaceEvent,
} from '@/lib/spaceEvent';
import { canMutateSpaceEvent } from '@/lib/spaceEventClient';
import type { SpaceMember } from '@/lib/spaceMembersClient';
import { spaceTypeButtonFill, spaceTypeButtonInk } from '@/lib/spaceTypes';
import { useTheme } from '@/theme/ThemeContext';

type Props = {
  event: SpaceEvent | null;
  members: SpaceMember[];
  viewerUid: string | null;
  accent: string;
  onClose: () => void;
  onEdit: (event: SpaceEvent) => void;
  onDelete: (event: SpaceEvent) => void;
};

export function SpaceEventDetailSheet({
  event,
  members,
  viewerUid,
  accent,
  onClose,
  onEdit,
  onDelete,
}: Props) {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const author = event ? resolveSpaceEventAuthor(event.createdByUid, members) : null;
  const canMutate = event ? canMutateSpaceEvent(event.createdByUid, viewerUid) : false;
  const createdLabel = event ? formatSpaceEventCreatedAt(event.createdAt) : null;

  return (
    <Modal visible={event != null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="닫기" />
      {event && author ? (
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <Text style={[styles.title, { color: colors.text }]}>{event.title}</Text>

          <View style={styles.metaRow}>
            <ProfileAvatar uri={author.photoURL} name={author.displayName} size={40} accent={accent} />
            <View style={styles.metaBody}>
              <Text style={[styles.author, { color: colors.text }]}>{author.displayName}</Text>
              {createdLabel ? (
                <Text style={[styles.created, { color: colors.textSec }]}>{createdLabel}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.fields}>
            <Field label="날짜" value={formatSpaceDayHeading(event.dateKey)} />
            <Field label="시간" value={formatSpaceEventTimeLabel(event)} />
            {event.description ? <Field label="설명" value={event.description} /> : null}
          </View>

          {canMutate ? (
            <View style={styles.actions}>
              <Pressable
                onPress={() => onEdit(event)}
                style={[styles.btn, { backgroundColor: spaceTypeButtonFill(accent, isDark) }]}
                accessibilityRole="button"
                accessibilityLabel="일정 수정"
              >
                <Text style={[styles.btnText, { color: spaceTypeButtonInk(accent, isDark) }]}>수정</Text>
              </Pressable>
              <Pressable
                onPress={() => onDelete(event)}
                style={[styles.btn, { borderColor: colors.logoutBorder, borderWidth: StyleSheet.hairlineWidth }]}
                accessibilityRole="button"
                accessibilityLabel="일정 삭제"
              >
                <Text style={[styles.btnText, { color: colors.logoutText }]}>삭제</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={[styles.readonly, { color: colors.textMuted }]}>작성한 멤버만 수정할 수 있어요.</Text>
          )}
        </View>
      ) : null}
    </Modal>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.field}>
      <Text style={[styles.fieldLabel, { color: colors.textSec }]}>{label}</Text>
      <Text style={[styles.fieldValue, { color: colors.text }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  metaRow: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  metaBody: {
    flex: 1,
  },
  author: {
    fontSize: 15,
    fontWeight: '800',
  },
  created: {
    marginTop: 3,
    fontSize: 12,
    fontWeight: '600',
  },
  fields: {
    marginTop: 18,
    gap: 12,
  },
  field: {
    gap: 4,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  fieldValue: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  actions: {
    marginTop: 20,
    flexDirection: 'row',
    gap: 8,
  },
  btn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontSize: 15,
    fontWeight: '800',
  },
  readonly: {
    marginTop: 18,
    fontSize: 13,
    fontWeight: '600',
  },
});
