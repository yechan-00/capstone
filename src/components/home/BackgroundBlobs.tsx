import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { HOME_GRADIENT } from '@/components/home/homeTheme';

type Props = {
  variant?: 'hero' | 'light' | 'none';
};

export function BackgroundBlobs({ variant = 'hero' }: Props) {
  if (variant === 'none') return null;

  const blurStyle =
    Platform.OS === 'web'
      ? ({ filter: 'blur(100px)', WebkitFilter: 'blur(100px)' } as object)
      : {};

  return (
    <>
      <View style={[styles.blobLime, blurStyle, variant === 'light' && styles.blobLimeLight]} />
      <View style={[styles.blobCoral, blurStyle, variant === 'light' && styles.blobCoralLight]} />
    </>
  );
}

const styles = StyleSheet.create({
  blobLime: {
    position: 'absolute',
    top: -40,
    right: '8%',
    width: 420,
    height: 420,
    borderRadius: 210,
    backgroundColor: HOME_GRADIENT.limeBlob,
    pointerEvents: 'none',
  },
  blobLimeLight: {
    width: 280,
    height: 280,
    borderRadius: 140,
    opacity: 0.65,
  },
  blobCoral: {
    position: 'absolute',
    bottom: -20,
    left: -60,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: HOME_GRADIENT.coralBlob,
    pointerEvents: 'none',
  },
  blobCoralLight: {
    width: 220,
    height: 220,
    borderRadius: 110,
    opacity: 0.5,
  },
});
