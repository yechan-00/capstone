import React, { useCallback, useRef } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { HomeHeader } from '@/components/home/HomeHeader';
import { HeroSection } from '@/components/home/HeroSection';
import { LandingCTASection } from '@/components/home/LandingCTASection';
import { LandingFooterSection } from '@/components/home/LandingFooterSection';
import { StorySection } from '@/components/home/StorySection';
import { StoryRecordSection } from '@/components/home/StoryRecordSection';
import { StoryAnalysisSection } from '@/components/home/StoryAnalysisSection';
import { StoryPreventionSection } from '@/components/home/StoryPreventionSection';
import { HOME } from '@/components/home/homeTheme';
import { WEB_MIN_HEIGHT_FULL, WEB_NO_TRANSLATE } from '@/components/home/homeWeb';

type ScrollTarget = 'hero' | 'features' | 'howTo' | 'reviews';

/** 첫 화면 히어로 → 이후 섹션 6 → 2 → 3 → 4 → 5 + 푸터 */
export default function HomeLandingScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const heroY = useRef(0);
  const section2Y = useRef(0);
  const section4Y = useRef(0);
  const section6Y = useRef(0);
  const scrollY = useRef(new Animated.Value(0)).current;

  const onScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { y: scrollY } } }],
    { useNativeDriver: false },
  );

  const onScrollTo = useCallback((target: ScrollTarget) => {
    const offsets: Record<ScrollTarget, number> = {
      hero: heroY.current,
      features: section2Y.current,
      howTo: section4Y.current,
      reviews: section6Y.current,
    };
    scrollRef.current?.scrollTo({ y: offsets[target], animated: true });
  }, []);

  return (
    <View style={styles.root} {...WEB_NO_TRANSLATE}>
      <HomeHeader scrollY={scrollY} onScrollTo={onScrollTo} />
      <Animated.ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <View
          onLayout={(e) => {
            heroY.current = e.nativeEvent.layout.y;
          }}
        >
          <HeroSection onExplore={() => onScrollTo('features')} />
        </View>

        <View
          onLayout={(e) => {
            section6Y.current = e.nativeEvent.layout.y;
          }}
        >
          <LandingCTASection />
        </View>

        <View
          onLayout={(e) => {
            section2Y.current = e.nativeEvent.layout.y;
          }}
        >
          <StorySection />
        </View>

        <StoryRecordSection />

        <View
          onLayout={(e) => {
            section4Y.current = e.nativeEvent.layout.y;
          }}
        >
          <StoryAnalysisSection />
        </View>

        <StoryPreventionSection />

        <LandingFooterSection />
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: HOME.white,
    ...WEB_MIN_HEIGHT_FULL,
  },
  scroll: {
    flexGrow: 1,
  },
});
