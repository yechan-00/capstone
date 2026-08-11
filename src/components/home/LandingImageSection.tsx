import React from 'react';
import { Image, StyleSheet, View, type ImageSourcePropType } from 'react-native';
import { LANDING_ASPECT } from '@/components/home/landingAssets';
import { HOME } from '@/components/home/homeTheme';
import { WEB_NO_TRANSLATE } from '@/components/home/homeWeb';

type Props = {
  source: ImageSourcePropType;
  /** 섹션 배경 (다크 섹션 등) */
  backgroundColor?: string;
};

export function LandingImageSection({ source, backgroundColor = HOME.bgSoft }: Props) {
  return (
    <View style={[styles.wrap, { backgroundColor }]} {...WEB_NO_TRANSLATE}>
      <Image source={source} style={styles.image} resizeMode="contain" accessibilityRole="image" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    alignItems: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    maxWidth: 1280,
    aspectRatio: LANDING_ASPECT,
  },
});
