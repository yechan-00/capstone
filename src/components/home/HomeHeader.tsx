import React from 'react';
import { Animated, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { BrandLogo } from '@/components/BrandLogo';
import { HOME, HOME_COPY } from '@/components/home/homeTheme';
import { HomeText } from '@/components/home/HomeText';
import { WEB_NO_TRANSLATE } from '@/components/home/homeWeb';

type ScrollTarget = 'hero' | 'features' | 'howTo' | 'reviews';

type Props = {
  scrollY: Animated.Value;
  onScrollTo?: (target: ScrollTarget) => void;
};

export function HomeHeader({ scrollY, onScrollTo }: Props) {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const scrollOrNavigate = (target: ScrollTarget) => {
    if (onScrollTo) {
      onScrollTo(target);
      return;
    }
    router.push('/home');
  };

  const bgOpacity = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const borderOpacity = scrollY.interpolate({
    inputRange: [0, 60],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });

  const navItem = (target: ScrollTarget, label: string) => (
    <Pressable
      onPress={() => scrollOrNavigate(target)}
      style={({ pressed }) => [styles.navItem, pressed && { opacity: 0.65 }]}
    >
      <HomeText style={styles.navText}>{label}</HomeText>
    </Pressable>
  );

  return (
    <View style={styles.wrap} {...WEB_NO_TRANSLATE}>
      <Animated.View
        style={[
          styles.bg,
          { opacity: bgOpacity },
          Platform.OS === 'web' &&
            ({
              backdropFilter: 'saturate(180%) blur(20px)',
              WebkitBackdropFilter: 'saturate(180%) blur(20px)',
            } as object),
        ]}
      />
      <Animated.View style={[styles.border, { opacity: borderOpacity }]} />

      <View style={styles.inner}>
        <Pressable onPress={() => scrollOrNavigate('hero')} style={styles.logoRow}>
          <BrandLogo
            iconSize={36}
            labelSize={17}
            layout="row"
            tone="home"
            labelStyle={styles.logoText}
          />
        </Pressable>

        {!isMobile ? (
          <View style={styles.nav}>
            {navItem('features', HOME_COPY.headerNavFeatures)}
            {navItem('hero', HOME_COPY.headerNavService)}
            {navItem('reviews', HOME_COPY.headerNavReviews)}
            {navItem('howTo', HOME_COPY.headerNavHowTo)}
          </View>
        ) : (
          <Pressable
            onPress={() => router.push('/login')}
            style={({ pressed }) => [styles.mobileCta, pressed && { opacity: 0.88 }]}
          >
            <HomeText style={styles.mobileCtaText}>{HOME_COPY.ctaPrimaryHero}</HomeText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
    height: HOME.headerHeight,
    justifyContent: 'center',
  },
  bg: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(255, 255, 255, 0.92)',
  },
  border: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: StyleSheet.hairlineWidth,
    backgroundColor: HOME.gray,
  },
  inner: {
    maxWidth: HOME.maxWidth,
    width: '100%',
    alignSelf: 'center',
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  logoRow: { flexDirection: 'row', alignItems: 'center' },
  logoText: { fontWeight: '800', letterSpacing: -0.4, color: HOME.dark },
  nav: { flexDirection: 'row', alignItems: 'center', gap: 32 },
  navItem: { paddingVertical: 6 },
  navText: { fontSize: 14, fontWeight: '600', color: HOME.textSec },
  mobileCta: {
    backgroundColor: HOME.green,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 10,
  },
  mobileCtaText: { color: HOME.white, fontSize: 12, fontWeight: '700' },
});
