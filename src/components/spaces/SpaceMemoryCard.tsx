import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { SpaceMemoryImage } from '@/components/spaces/SpaceMemoryImage';
import { formatSpaceDayHeading } from '@/lib/spaceEvent';
import {
  memoryPreview,
  resolveSpaceMemoryAuthor,
  type SpaceMemory,
} from '@/lib/spaceMemory';
import { spaceMemoryImageUri } from '@/lib/spaceMemoryImage';
import type { SpaceMember } from '@/lib/spaceMembersClient';
import { getR2ImageApiBaseUrl } from '@/services/storageService';
import { useTheme } from '@/theme/ThemeContext';

type Props = {
  spaceId: string;
  memory: SpaceMemory;
  members: SpaceMember[];
  accent: string;
  headers?: Record<string, string>;
  onPress: () => void;
};

export function SpaceMemoryCard({ spaceId, memory, members, accent, headers, onPress }: Props) {
  const { colors } = useTheme();
  const author = resolveSpaceMemoryAuthor(memory.createdByUid, members);
  const coverKey = memory.imageKeys[0];
  const coverUri = coverKey
    ? spaceMemoryImageUri(getR2ImageApiBaseUrl(), spaceId, memory.id, coverKey)
    : null;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${memory.title}, ${formatSpaceDayHeading(memory.dateKey)}`}
    >
      <View style={[styles.cover, { backgroundColor: colors.surfaceMuted }]}>
        {coverUri ? (
          <SpaceMemoryImage
            uri={coverUri}
            headers={headers}
            contentFit="cover"
            style={styles.coverImage}
            accessibilityLabel={`${memory.title} 대표 사진`}
          />
        ) : (
          <MaterialIcons name="photo-library" size={28} color={accent} />
        )}
      </View>
      <View style={styles.body}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {memory.title}
        </Text>
        <Text style={[styles.date, { color: colors.textSec }]}>{formatSpaceDayHeading(memory.dateKey)}</Text>
        {memory.content ? (
          <Text style={[styles.preview, { color: colors.textSec }]} numberOfLines={2}>
            {memoryPreview(memory.content)}
          </Text>
        ) : null}
        <View style={styles.authorRow}>
          <ProfileAvatar uri={author.photoURL} name={author.displayName} size={22} accent={accent} />
          <Text style={[styles.author, { color: colors.textSec }]} numberOfLines={1}>
            {author.displayName}
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  cover: {
    height: 148,
    alignItems: 'center',
    justifyContent: 'center',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  body: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
  },
  date: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  preview: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  authorRow: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  author: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
  },
});
