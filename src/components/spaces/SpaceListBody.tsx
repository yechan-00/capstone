import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { ErrorRetryCard } from '@/components/ErrorRetryCard';
import { SpaceListCard } from '@/components/spaces/SpaceListCard';
import { SpaceListEmpty } from '@/components/spaces/SpaceListEmpty';
import { BRAND_GREEN } from '@/theme/ThemeContext';
import type { SpaceListItem } from '@/lib/spaceTypes';
import type { SpaceListStatus } from '@/hooks/useMySpaces';

type Props = {
  status: SpaceListStatus;
  spaces: SpaceListItem[];
  errorMessage: string | null;
  onRetry: () => void;
  onSpacePress?: (space: SpaceListItem) => void;
};

export function SpaceListBody({
  status,
  spaces,
  errorMessage,
  onRetry,
  onSpacePress,
}: Props) {
  if (status === 'loading') {
    return (
      <View style={styles.stateWrap}>
        <ActivityIndicator size="large" color={BRAND_GREEN} />
      </View>
    );
  }

  if (status === 'error') {
    return (
      <View style={styles.errorWrap}>
        <ErrorRetryCard
          title="공간을 불러오지 못했어요"
          desc={errorMessage || '잠시 후 다시 시도해 주세요.'}
          onRetry={onRetry}
        />
      </View>
    );
  }

  if (status === 'empty' || spaces.length === 0) {
    return <SpaceListEmpty />;
  }

  return (
    <View style={styles.list}>
      {spaces.map((space) => (
        <SpaceListCard key={space.id} space={space} onPress={onSpacePress} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stateWrap: {
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorWrap: {
    paddingTop: 8,
  },
  list: {
    gap: 10,
  },
});
