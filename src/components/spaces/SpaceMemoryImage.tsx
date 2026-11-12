import React, { useEffect, useState } from 'react';
import { StyleSheet, View, type ImageStyle, type StyleProp } from 'react-native';
import { Image } from 'expo-image';
import { useTheme } from '@/theme/ThemeContext';

type Props = {
  uri?: string | null;
  headers?: Record<string, string>;
  contentFit?: 'contain' | 'cover';
  style?: StyleProp<ImageStyle>;
  accessibilityLabel?: string;
};

export function SpaceMemoryImage({
  uri,
  headers,
  contentFit = 'cover',
  style,
  accessibilityLabel,
}: Props) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  const authorization = headers?.Authorization;

  useEffect(() => {
    setFailed(false);
  }, [authorization, uri]);

  const waitingForAuth = Boolean(uri?.startsWith('http') && !authorization);
  if (!uri || failed || waitingForAuth) {
    return <View style={[styles.fallback, { backgroundColor: colors.surfaceMuted }, style]} />;
  }

  return (
    <Image
      source={headers ? { uri, headers } : { uri }}
      style={style}
      contentFit={contentFit}
      accessibilityLabel={accessibilityLabel}
      onError={() => setFailed(true)}
    />
  );
}

const styles = StyleSheet.create({
  fallback: {
    width: '100%',
    height: '100%',
  },
});
