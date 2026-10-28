import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ReviewContainPhoto } from '@/components/ReviewContainPhoto';
import { useExpenseDetailPalette } from '@/theme/expenseDetailTheme';
import { pageIndexFromOffset } from '@/utils/photoPager';

const PHOTO_MAX_HEIGHT = 220;

type Props = {
  urls: string[];
  title: string;
  onPhotoPress?: (uri: string) => void;
};

export function ExpenseDetailPhotoGallery({ urls, title, onPhotoPress }: Props) {
  const p = useExpenseDetailPalette();
  const scrollRef = useRef<ScrollView>(null);
  const pageWidthRef = useRef(0);
  const indexRef = useRef(0);
  const [pageWidth, setPageWidth] = useState(0);
  const [index, setIndex] = useState(0);
  const urlsKey = urls.join('\n');

  const blurOverlay = p.isDark ? 'rgba(11, 16, 14, 0.42)' : 'rgba(250, 252, 250, 0.38)';

  useEffect(() => {
    indexRef.current = 0;
    setIndex(0);
    scrollRef.current?.scrollTo({ x: 0, animated: false });
  }, [urlsKey]);

  useEffect(() => {
    if (pageWidth <= 0) return;
    scrollRef.current?.scrollTo({
      x: indexRef.current * pageWidth,
      animated: false,
    });
  }, [pageWidth]);

  const syncIndex = useCallback(
    (offsetX: number) => {
      const next = pageIndexFromOffset(offsetX, pageWidthRef.current, urls.length);
      if (next === indexRef.current) return;
      indexRef.current = next;
      setIndex(next);
    },
    [urls.length],
  );

  const handleScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      syncIndex(event.nativeEvent.contentOffset.x);
    },
    [syncIndex],
  );

  if (urls.length === 0) return null;

  const renderPhoto = (uri: string, photoIndex: number) => (
    <ReviewContainPhoto
      uri={uri}
      accessibilityLabel={
        urls.length > 1
          ? `${title} 사진 ${photoIndex + 1} / ${urls.length} 크게 보기`
          : `${title} 사진 크게 보기`
      }
      onPress={onPhotoPress ? () => onPhotoPress(uri) : undefined}
      photoBg={p.photoBg}
      muted={p.textMuted}
      ctaColor={p.mintText}
      maxHeight={PHOTO_MAX_HEIGHT}
      blurBackdrop
      blurOverlay={blurOverlay}
    />
  );

  if (urls.length === 1) {
    return renderPhoto(urls[0], 0);
  }

  return (
    <View
      style={styles.pager}
      onLayout={(event) => {
        const width = Math.round(event.nativeEvent.layout.width);
        if (width <= 0 || width === pageWidthRef.current) return;
        pageWidthRef.current = width;
        setPageWidth(width);
      }}
    >
      {pageWidth > 0 ? (
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
          style={styles.pagerScroll}
          onScrollEndDrag={handleScrollEnd}
          onMomentumScrollEnd={handleScrollEnd}
        >
          {urls.map((uri, photoIndex) => (
            <View key={`${photoIndex}-${uri}`} style={{ width: pageWidth }}>
              {renderPhoto(uri, photoIndex)}
            </View>
          ))}
        </ScrollView>
      ) : null}
      {pageWidth > 0 ? (
        <View pointerEvents="none" style={styles.pageBadge}>
          <Text style={styles.pageBadgeText}>
            {index + 1} / {urls.length}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  pager: {
    position: 'relative',
    width: '100%',
    aspectRatio: 16 / 10,
    maxHeight: PHOTO_MAX_HEIGHT,
    overflow: 'hidden',
  },
  pagerScroll: {
    flex: 1,
  },
  pageBadge: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    backgroundColor: 'rgba(11, 16, 14, 0.55)',
  },
  pageBadgeText: {
    color: '#F4F6F5',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
