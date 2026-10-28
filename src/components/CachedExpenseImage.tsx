import React, { useEffect, useRef } from 'react';
import { Image, type ImageStyle, type NativeSyntheticEvent, type StyleProp } from 'react-native';
import {
  logExpenseImageError,
  logExpenseImageEventsNone,
  logExpenseImageLoad,
  logExpenseImageLoadEnd,
  logExpenseImageLoadStart,
  logExpenseImageStart,
  probeExpenseImageOnce,
  type ImageEventFlags,
} from '@/lib/expenseImageDebug';

type Props = {
  uri: string;
  accessibilityLabel?: string;
  contentFit?: 'contain' | 'cover';
  blurRadius?: number;
  style?: StyleProp<ImageStyle>;
  onLoad?: () => void;
  onError?: () => void;
  onLoadEnd?: () => void;
};

export function CachedExpenseImage({
  uri,
  accessibilityLabel,
  contentFit = 'contain',
  blurRadius,
  style,
  onLoad,
  onError,
  onLoadEnd,
}: Props) {
  const flagsRef = useRef<ImageEventFlags>({
    loadStart: false,
    load: false,
    error: false,
    loadEnd: false,
  });

  useEffect(() => {
    flagsRef.current = { loadStart: false, load: false, error: false, loadEnd: false };
    if (!__DEV__) return undefined;
    logExpenseImageStart(uri);
    probeExpenseImageOnce(uri);
    const timer = setTimeout(() => {
      const flags = flagsRef.current;
      if (!flags.load && !flags.error) {
        logExpenseImageEventsNone(uri, flags);
      }
    }, 12_000);
    return () => clearTimeout(timer);
  }, [uri]);

  return (
    <Image
      source={{ uri }}
      style={style}
      resizeMode={contentFit}
      blurRadius={blurRadius}
      accessibilityLabel={accessibilityLabel}
      onLoadStart={() => {
        flagsRef.current.loadStart = true;
        if (__DEV__) logExpenseImageLoadStart(uri);
      }}
      onLoad={() => {
        flagsRef.current.load = true;
        if (__DEV__) logExpenseImageLoad(uri);
        onLoad?.();
      }}
      onError={(event: NativeSyntheticEvent<{ error?: string }>) => {
        flagsRef.current.error = true;
        if (__DEV__) logExpenseImageError(uri, event.nativeEvent?.error);
        onError?.();
      }}
      onLoadEnd={() => {
        flagsRef.current.loadEnd = true;
        if (__DEV__) logExpenseImageLoadEnd(uri);
        onLoadEnd?.();
      }}
    />
  );
}
