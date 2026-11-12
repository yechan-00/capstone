import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { SpaceMemoryImage } from '@/components/spaces/SpaceMemoryImage';
import { spaceMemoryImageUri } from '@/lib/spaceMemoryImage';
import { pageIndexFromOffset } from '@/utils/photoPager';
import { getR2ImageApiBaseUrl } from '@/services/storageService';
import { useTheme } from '@/theme/ThemeContext';

type Props = {
  spaceId: string;
  memoryId: string;
  imageKeys: string[];
  title: string;
  headers?: Record<string, string>;
};

export function SpaceMemoryGallery({ spaceId, memoryId, imageKeys, title, headers }: Props) {
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const pageWidth = Math.max(1, width - 40);
  const scrollRef = useRef<ScrollView>(null);
  const indexRef = useRef(0);
  const [index, setIndex] = useState(0);
  const urls = imageKeys
    .map((key) => spaceMemoryImageUri(getR2ImageApiBaseUrl(), spaceId, memoryId, key))
    .filter((uri): uri is string => Boolean(uri));
  const urlsKey = urls.join('\n');

  useEffect(() => {
    indexRef.current = 0;
    setIndex(0);
    scrollRef.current?.scrollTo({ x: 0, animated: false });
  }, [urlsKey]);

  const syncIndex = useCallback(
    (offsetX: number) => {
      const next = pageIndexFromOffset(offsetX, pageWidth, urls.length);
      if (next === indexRef.current) return;
      indexRef.current = next;
      setIndex(next);
    },
    [pageWidth, urls.length],
  );

  const handleScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      syncIndex(event.nativeEvent.contentOffset.x);
    },
    [syncIndex],
  );

  if (urls.length === 0) return null;

  const photo = (uri: string, photoIndex: number) => (
    <View style={[styles.frame, { width: pageWidth, backgroundColor: colors.surfaceMuted }]}>
      <SpaceMemoryImage
        uri={uri}
        headers={headers}
        contentFit="contain"
        style={styles.image}
        accessibilityLabel={
          urls.length > 1 ? `${title} 사진 ${photoIndex + 1} / ${urls.length}` : `${title} 사진`
        }
      />
    </View>
  );

  if (urls.length === 1) return photo(urls[0], 0);

  return (
    <View style={styles.pager}>
      <ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        nestedScrollEnabled
        directionalLockEnabled
        disableIntervalMomentum
        decelerationRate="fast"
        showsHorizontalScrollIndicator={false}
        overScrollMode="never"
        bounces={false}
        onScrollEndDrag={handleScrollEnd}
        onMomentumScrollEnd={handleScrollEnd}
      >
        {urls.map((uri, photoIndex) => (
          <View key={`${photoIndex}-${uri}`}>{photo(uri, photoIndex)}</View>
        ))}
      </ScrollView>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>
          {index + 1} / {urls.length}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pager: {
    position: 'relative',
  },
  frame: {
    height: 280,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  badge: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(11, 16, 14, 0.55)',
  },
  badgeText: {
    color: '#F4F6F5',
    fontSize: 11,
    fontWeight: '700',
  },
});
