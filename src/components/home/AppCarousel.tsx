import React, { useRef } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { HOME, HOME_CAROUSEL, HOME_COPY, HOME_TITLE_LINES } from '@/components/home/homeTheme';
import { HomeLinesText, HomeText } from '@/components/home/HomeText';
import { SECTION_PY } from '@/components/home/homeStyles';
import { PhoneFrame, type PhoneScreenKey } from '@/components/home/PhoneFrame';
import { RevealSection, SectionContainer } from '@/components/home/RevealSection';

const CARD_WIDTH = 440;
const CARD_HEIGHT = 580;
const CARD_GAP = 20;

export function AppCarousel() {
  const scrollRef = useRef<ScrollView>(null);
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const cardWidth = isMobile ? width * 0.85 : CARD_WIDTH;
  const cardHeight = isMobile ? cardWidth * 1.32 : CARD_HEIGHT;
  const snapInterval = cardWidth + CARD_GAP;
  const titleSize = isMobile ? 28 : 40;
  const scrollOffset = useRef(0);

  const scrollBy = (dir: -1 | 1) => {
    const next = Math.max(0, scrollOffset.current + dir * snapInterval);
    scrollRef.current?.scrollTo({ x: next, animated: true });
    scrollOffset.current = next;
  };

  return (
    <View style={styles.wrap}>
      <SectionContainer>
        <RevealSection>
          <HomeLinesText
            lines={HOME_TITLE_LINES.carousel}
            align="center"
            style={[styles.title, { fontSize: titleSize, lineHeight: titleSize * 1.12 }]}
          />
        </RevealSection>
      </SectionContainer>

      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={snapInterval}
        snapToAlignment="start"
        onScroll={(e) => {
          scrollOffset.current = e.nativeEvent.contentOffset.x;
        }}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingHorizontal: isMobile
              ? 24
              : Math.max(24, (width - HOME.maxWidth) / 2 + 24),
          },
        ]}
        style={[
          styles.scroll,
          Platform.OS === 'web' ? ({ scrollSnapType: 'x mandatory' } as object) : null,
        ]}
      >
        {HOME_CAROUSEL.map((card, index) => (
          <RevealSection key={card.key} delay={index * 100}>
            <View
              style={[
                styles.card,
                {
                  width: cardWidth,
                  height: cardHeight,
                  backgroundColor: card.backgroundColor,
                },
                Platform.OS === 'web' ? ({ scrollSnapAlign: 'start' } as object) : null,
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={{ flex: 1 }}>
                  <HomeText style={[styles.cardTitle, { color: card.textColor }]}>{card.title}</HomeText>
                  <HomeText style={[styles.cardSub, { color: card.textColor, opacity: 0.88 }]}>
                    {card.subtitle}
                  </HomeText>
                </View>
              </View>
              <View style={styles.cardPhone}>
                <PhoneFrame screen={card.screen as PhoneScreenKey} size="carousel" rotate={-2} />
              </View>
            </View>
          </RevealSection>
        ))}
      </ScrollView>

      {!isMobile ? (
        <SectionContainer style={styles.navRow}>
          <Pressable onPress={() => scrollBy(-1)} style={styles.navBtn}>
            <Text style={styles.navBtnText}>←</Text>
          </Pressable>
          <Pressable onPress={() => scrollBy(1)} style={styles.navBtn}>
            <Text style={styles.navBtnText}>→</Text>
          </Pressable>
        </SectionContainer>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: SECTION_PY,
    paddingBottom: SECTION_PY,
    backgroundColor: HOME.bgMuted,
  },
  title: {
    fontWeight: '800',
    color: HOME.brand,
    textAlign: 'center',
    letterSpacing: -0.6,
    marginBottom: 40,
  },
  scroll: { width: '100%' },
  scrollContent: { gap: CARD_GAP, paddingBottom: 4 },
  card: {
    borderRadius: 40,
    padding: 28,
    justifyContent: 'space-between',
    overflow: 'hidden',
    shadowColor: HOME.brand,
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.1,
    shadowRadius: 48,
    elevation: 6,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  cardTitle: { fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  cardSub: { fontSize: 14, fontWeight: '600', marginTop: 6 },
  cardPhone: { alignItems: 'center', marginTop: 8 },
  navRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 20,
  },
  navBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: HOME.white,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: HOME.grayDark,
  },
  navBtnText: { fontSize: 18, fontWeight: '700', color: HOME.brand },
});
