import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SubScreenHeader } from '@/components/SubScreenHeader';
import { CreateSpaceButton } from '@/components/spaces/CreateSpaceButton';
import { JoinSpaceButton } from '@/components/spaces/JoinSpaceButton';
import { SpaceListBody } from '@/components/spaces/SpaceListBody';
import { useMySpaces } from '@/hooks/useMySpaces';
import { buildJoinSpaceHref } from '@/lib/spaceInviteClient';
import type { SpaceListItem } from '@/lib/spaceTypes';
import { useTheme } from '@/theme/ThemeContext';

export default function SpacesScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { status, spaces, errorMessage, retry } = useMySpaces();
  const goCreate = () => router.push('/spaces/create');
  const goJoin = () => router.push(buildJoinSpaceHref());
  const onSpacePress = (space: SpaceListItem) => {
    if (!space.id) return;
    router.push({
      pathname: '/spaces/[spaceId]',
      params: { spaceId: space.id },
    });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SubScreenHeader title="함께한 기록" fallbackHref="/(tabs)" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.intro}>
          <Text style={[styles.headline, { color: colors.text }]}>소중한 순간을 함께 기록해요</Text>
          <Text style={[styles.subhead, { color: colors.textSec }]}>
            가족, 연인, 친구와 함께한 기록을 하나의 공간에 모아보세요.
          </Text>
        </View>

        <CreateSpaceButton onPress={goCreate} />
        <JoinSpaceButton onPress={goJoin} />

        <Text style={[styles.sectionTitle, { color: colors.text }]}>내 공유 공간</Text>
        <SpaceListBody
          status={status}
          spaces={spaces}
          errorMessage={errorMessage}
          onRetry={retry}
          onSpacePress={onSpacePress}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
  },
  intro: {
    marginBottom: 16,
  },
  headline: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subhead: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
  },
  sectionTitle: {
    marginTop: 22,
    marginBottom: 12,
    fontSize: 15,
    fontWeight: '800',
  },
});
