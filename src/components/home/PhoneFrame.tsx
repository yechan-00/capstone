import React, { useEffect, useRef } from 'react';
import { Animated, Image, Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { HOME } from '@/components/home/homeTheme';
import { getScreenshot, type ScreenshotKey } from '@/components/home/screenshotAssets';
import {
  CommunityScreenPreview,
  HomeScreenPreview,
  InsightsScreenPreview,
  NotificationScreenPreview,
  RegretAnalysisScreenPreview,
  RecordReasonScreenPreview,
  RegretIndexScreenPreview,
  ReviewScreenPreview,
  WeeklyRegretChartPreview,
} from '@/components/home/mockScreens';
import { HeroDashboardPreview } from '@/components/home/HeroDashboardPreview';

export type PhoneScreenKey = ScreenshotKey | 'notification' | 'community' | 'regret-analysis' | 'record-reason' | 'regret-index' | 'weekly-regret' | 'hero-dashboard';

type Props = {
  screen: PhoneScreenKey;
  floating?: boolean;
  size?: 'hero' | 'compact' | 'carousel';
  rotate?: number;
  offsetY?: number;
  zIndex?: number;
  lightBezel?: boolean;
};

function ScreenContent({ screen }: { screen: PhoneScreenKey }) {
  const source =
    screen === 'home' || screen === 'insights' || screen === 'review'
      ? getScreenshot(screen)
      : undefined;
  if (source) {
    return <Image source={source} style={styles.screenshot} resizeMode="cover" />;
  }
  if (screen === 'home') return <HomeScreenPreview />;
  if (screen === 'insights') return <InsightsScreenPreview />;
  if (screen === 'review') return <ReviewScreenPreview />;
  if (screen === 'regret-analysis') return <RegretAnalysisScreenPreview />;
  if (screen === 'record-reason') return <RecordReasonScreenPreview />;
  if (screen === 'regret-index') return <RegretIndexScreenPreview />;
  if (screen === 'weekly-regret') return <WeeklyRegretChartPreview />;
  if (screen === 'notification') return <NotificationScreenPreview />;
  if (screen === 'hero-dashboard') return <HeroDashboardPreview />;
  return <CommunityScreenPreview />;
}

const SIZES = {
  hero: { width: 300, bezel: 12, radius: 52, screenRadius: 40 },
  compact: { width: 210, bezel: 10, radius: 48, screenRadius: 36 },
  carousel: { width: 200, bezel: 10, radius: 44, screenRadius: 34 },
} as const;

export function PhoneFrame({
  screen,
  floating = false,
  size = 'hero',
  rotate = 0,
  offsetY = 0,
  zIndex = 1,
  lightBezel = false,
}: Props) {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  const spec = SIZES[size];
  const frameWidth =
    size === 'hero' && isMobile ? Math.min(width - 48, 260) : spec.width;
  const bezel = size === 'hero' && isMobile ? 10 : spec.bezel;
  const frameHeight = frameWidth * 2.06;

  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!floating) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, { toValue: -10, duration: 5000, useNativeDriver: true }),
        Animated.timing(floatAnim, { toValue: 0, duration: 5000, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [floatAnim, floating]);

  const transforms: (
    | { translateY: Animated.AnimatedInterpolation<number> | Animated.Value | number }
    | { rotate: string }
  )[] = [];

  if (offsetY !== 0) transforms.push({ translateY: offsetY });
  if (floating) transforms.push({ translateY: floatAnim });
  if (rotate !== 0) transforms.push({ rotate: `${rotate}deg` });

  const frame = (
    <View
      style={[
        styles.shadowWrap,
        size === 'hero' && styles.shadowWrapHero,
        size === 'compact' && styles.shadowWrapCompact,
        { zIndex },
      ]}
    >
      <View
        style={[
          styles.bezel,
          lightBezel && styles.bezelLight,
          {
            width: frameWidth,
            height: frameHeight,
            borderRadius: spec.radius,
            padding: bezel,
          },
        ]}
      >
        <View style={[styles.dynamicIsland, lightBezel && styles.dynamicIslandLight, { top: bezel + 2 }]} />
        <View
          style={[
            styles.screen,
            { borderRadius: spec.screenRadius },
          ]}
        >
          <ScreenContent screen={screen} />
        </View>
        {screen !== 'notification' ? (
          <View style={[styles.homeIndicator, lightBezel && styles.homeIndicatorLight]} />
        ) : null}
      </View>
    </View>
  );

  if (transforms.length === 0) return frame;
  return <Animated.View style={{ transform: transforms }}>{frame}</Animated.View>;
}

/** Hero: 인사이트(좌) · 홈(중앙) · 리뷰(우) 3폰 구성 */
export function HeroPhoneShowcase() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  if (isMobile) {
    return (
      <View style={showcaseStyles.mobileWrap}>
        <PhoneFrame screen="home" floating size="hero" rotate={-3} offsetY={8} />
      </View>
    );
  }

  return (
    <View style={showcaseStyles.desktopWrap}>
      <View style={showcaseStyles.sideLeft}>
        <PhoneFrame screen="insights" size="compact" rotate={-10} zIndex={1} />
      </View>
      <View style={showcaseStyles.center}>
        <PhoneFrame
          screen="home"
          floating
          size="hero"
          rotate={-4}
          offsetY={20}
          zIndex={3}
        />
      </View>
      <View style={showcaseStyles.sideRight}>
        <PhoneFrame screen="review" size="compact" rotate={8} zIndex={2} />
      </View>
    </View>
  );
}

/** 목업용 2열 폰 쇼케이스 */
export function HeroDualPhones() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  if (isMobile) {
    return (
      <View style={showcaseStyles.mobileWrap}>
        <PhoneFrame screen="home" floating size="hero" rotate={-4} offsetY={6} />
      </View>
    );
  }

  return (
    <View style={showcaseStyles.dualWrap}>
      <View style={showcaseStyles.dualLeft}>
        <PhoneFrame screen="home" floating size="compact" rotate={-8} zIndex={2} />
      </View>
      <View style={showcaseStyles.dualRight}>
        <PhoneFrame screen="insights" size="compact" rotate={6} zIndex={1} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadowWrap: {
    shadowColor: HOME.brand,
    shadowOffset: { width: 0, height: 32 },
    shadowOpacity: 0.15,
    shadowRadius: 64,
    elevation: 16,
  },
  shadowWrapHero: {
    shadowOffset: { width: 0, height: 40 },
    shadowOpacity: 0.25,
    shadowRadius: 100,
  },
  shadowWrapCompact: {
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.18,
    shadowRadius: 48,
  },
  bezel: {
    backgroundColor: HOME.bezel,
    position: 'relative',
    overflow: 'visible',
  },
  bezelLight: {
    backgroundColor: '#F2F2F2',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  dynamicIsland: {
    position: 'absolute',
    alignSelf: 'center',
    width: 90,
    height: 28,
    borderRadius: 999,
    backgroundColor: HOME.island,
    zIndex: 5,
  },
  dynamicIslandLight: {
    backgroundColor: '#1A1A1A',
  },
  screen: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: HOME.white,
  },
  homeIndicator: {
    position: 'absolute',
    bottom: 10,
    alignSelf: 'center',
    width: 100,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.4)',
    zIndex: 5,
  },
  homeIndicatorLight: {
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  screenshot: {
    width: '100%',
    height: '100%',
  },
});

const showcaseStyles = StyleSheet.create({
  mobileWrap: {
    alignItems: 'center',
    width: '100%',
    overflow: 'hidden',
  },
  desktopWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    minHeight: 580,
    position: 'relative',
  },
  sideLeft: {
    marginTop: 72,
    marginRight: -36,
    transform: [{ scale: 0.88 }],
    zIndex: 1,
  },
  center: {
    zIndex: 3,
  },
  sideRight: {
    marginTop: 96,
    marginLeft: -36,
    transform: [{ scale: 0.9 }],
    zIndex: 2,
  },
  dualWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    minHeight: 440,
    gap: 8,
  },
  dualLeft: {
    marginTop: 24,
    transform: [{ scale: 1.05 }],
    zIndex: 2,
  },
  dualRight: {
    marginTop: -16,
    marginLeft: -20,
    transform: [{ scale: 1.02 }],
    zIndex: 1,
  },
});
