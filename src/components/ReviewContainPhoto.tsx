import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { CachedExpenseImage } from '@/components/CachedExpenseImage';

const THUMB_ASPECT = 16 / 10;
const WAIT_HINT_MS = 400;
const LOAD_TIMEOUT_MS = 15_000;

type Props = {
  uri: string;
  accessibilityLabel: string;
  onPress?: () => void;
  photoBg: string;
  muted: string;
  ctaColor?: string;
  maxHeight?: number;
  /** 리뷰 목록 전용. 다른 화면 기본 표시는 그대로 둡니다. */
  blurBackdrop?: boolean;
  blurOverlay?: string;
  /** 부모 콘텐츠 너비 안에서 사진 프레임을 가운데 맞춥니다. */
  centerInParent?: boolean;
  /** 사진 프레임 위 오버레이. 레이아웃은 바꾸지 않습니다. */
  cornerBadge?: React.ReactNode;
};

export function ReviewContainPhoto({
  uri,
  accessibilityLabel,
  onPress,
  photoBg,
  muted,
  ctaColor,
  maxHeight = 180,
  blurBackdrop = false,
  blurOverlay,
  centerInParent = false,
  cornerBadge,
}: Props) {
  const failedRef = useRef(false);
  const [failed, setFailed] = useState(false);
  const [settled, setSettled] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [showWaitMark, setShowWaitMark] = useState(false);

  useEffect(() => {
    failedRef.current = false;
    setFailed(false);
    setSettled(false);
    setShowWaitMark(false);
  }, [uri, reloadKey]);

  useEffect(() => {
    if (failed || settled) return undefined;
    const hintTimer = setTimeout(() => setShowWaitMark(true), WAIT_HINT_MS);
    const settleTimer = setTimeout(() => {
      // onLoad가 누락돼도 스피너를 붙잡지 않습니다. 실제 실패는 onError만 에러 UI로 처리합니다.
      if (!failedRef.current) setSettled(true);
    }, LOAD_TIMEOUT_MS);
    return () => {
      clearTimeout(hintTimer);
      clearTimeout(settleTimer);
    };
  }, [failed, settled, uri, reloadKey]);

  const markReady = () => {
    if (failedRef.current) return;
    setSettled(true);
  };

  const markFailed = () => {
    failedRef.current = true;
    setFailed(true);
    setSettled(true);
  };

  const retry = () => {
    failedRef.current = false;
    setFailed(false);
    setSettled(false);
    setShowWaitMark(false);
    setReloadKey((n) => n + 1);
  };

  return (
    <Pressable
      onPress={failed ? retry : onPress}
      disabled={!failed && !onPress}
      accessibilityRole={failed || onPress ? 'button' : undefined}
      accessibilityLabel={failed ? '사진 다시 시도' : accessibilityLabel}
      style={centerInParent ? styles.centerRoot : undefined}
    >
      <View
        style={[
          styles.frame,
          centerInParent ? styles.centerFrame : null,
          {
            backgroundColor: photoBg,
            aspectRatio: THUMB_ASPECT,
            maxHeight,
          },
        ]}
      >
        {!failed && blurBackdrop ? (
          <CachedExpenseImage
            key={`${uri}-${reloadKey}-bg`}
            uri={uri}
            contentFit="cover"
            blurRadius={Platform.OS === 'web' ? 0 : 28}
            style={styles.blurFill}
            accessibilityLabel={undefined}
          />
        ) : null}
        {!failed && blurBackdrop && blurOverlay ? (
          <View pointerEvents="none" style={[styles.blurScrim, { backgroundColor: blurOverlay }]} />
        ) : null}
        {!failed ? (
          <CachedExpenseImage
            key={`${uri}-${reloadKey}`}
            uri={uri}
            accessibilityLabel={accessibilityLabel}
            contentFit="contain"
            style={blurBackdrop ? styles.imageFill : styles.image}
            onLoad={markReady}
            onLoadEnd={markReady}
            onError={markFailed}
          />
        ) : null}

        {!failed && !settled && showWaitMark ? (
          <View style={styles.overlay} pointerEvents="none">
            <MaterialIcons name="image" size={22} color={muted} />
          </View>
        ) : null}

        {failed ? (
          <View style={styles.overlay}>
            <MaterialIcons name="broken-image" size={18} color={muted} />
            <Text style={[styles.fallbackText, { color: muted }]}>사진을 불러오지 못했어요</Text>
            <Text style={[styles.retryText, { color: ctaColor ?? muted }]}>다시 시도</Text>
          </View>
        ) : null}

        {!failed && cornerBadge ? (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {cornerBadge}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  centerRoot: {
    width: '100%',
    alignItems: 'center',
  },
  centerFrame: {
    alignSelf: 'center',
    maxWidth: '100%',
  },
  frame: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageFill: {
    ...StyleSheet.absoluteFill,
    width: '100%',
    height: '100%',
  },
  blurFill: {
    position: 'absolute',
    width: '120%',
    height: '120%',
    top: '-10%',
    left: '-10%',
  },
  blurScrim: {
    ...StyleSheet.absoluteFill,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 12,
  },
  fallbackText: {
    fontSize: 12,
    fontWeight: '600',
  },
  retryText: {
    fontSize: 12,
    fontWeight: '800',
    marginTop: 2,
  },
});
