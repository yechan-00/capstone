import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { HOME, HOME_COPY, PATTERN_CARDS } from '@/components/home/homeTheme';
import { HomeMultilineText, HomeText } from '@/components/home/HomeText';
import { PatternCardIllustration } from '@/components/home/PatternCardIllustration';
import { SECTION_PY } from '@/components/home/homeStyles';
import { RevealSection, SectionContainer } from '@/components/home/RevealSection';
import { WEB_KO_TITLE_LINE, WEB_NO_TRANSLATE } from '@/components/home/homeWeb';

const ILLUS_VARIANTS = ['delivery', 'shopping', 'procrastination'] as const;

/** 섹션 2 — 반복 패턴 (3번째 페이지) */
export function StorySection() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const isTablet = width < 1100;
  const titleSize = isMobile ? 28 : 40;

  return (
    <View style={styles.section} {...WEB_NO_TRANSLATE}>
      <SectionContainer style={styles.wrap}>
        <RevealSection style={isMobile ? styles.headerMobile : styles.header}>
          <View style={[styles.badge, isMobile && styles.badgeMobile]}>
            <HomeText style={styles.badgeText}>{HOME_COPY.storySectionLabel}</HomeText>
          </View>
          <HomeText
            style={[
              styles.title,
              { fontSize: titleSize, lineHeight: titleSize * 1.14 },
              WEB_KO_TITLE_LINE,
              isMobile && styles.titleMobile,
            ]}
          >
            {HOME_COPY.storyTitleMain}
          </HomeText>
          <HomeMultilineText
            text={HOME_COPY.storyLead}
            align={isMobile ? 'center' : 'left'}
            style={[styles.lead, isMobile && styles.leadMobile]}
          />
        </RevealSection>

        <View style={[styles.cardGrid, isTablet && styles.cardGridStack]}>
          {PATTERN_CARDS.map((card, i) => (
            <RevealSection key={card.title} delay={80 + i * 80} style={styles.cardWrap}>
              <View style={styles.card}>
                <View style={styles.illusWrap}>
                  <PatternCardIllustration variant={ILLUS_VARIANTS[i]} />
                </View>
                <View style={styles.cardBody}>
                  <HomeText style={styles.cardTitle}>{card.title}</HomeText>
                  <HomeMultilineText text={card.desc} style={styles.cardDesc} />
                  <View style={styles.tagRow}>
                    {card.tags.map((tag) => (
                      <View key={tag.label} style={[styles.tag, { backgroundColor: tag.bg }]}>
                        <HomeText style={styles.tagEmoji}>{tag.emoji}</HomeText>
                        <HomeText style={styles.tagLabel}>{tag.label}</HomeText>
                      </View>
                    ))}
                  </View>
                </View>
              </View>
            </RevealSection>
          ))}
        </View>
      </SectionContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { backgroundColor: '#F5F7F4' },
  wrap: { paddingVertical: SECTION_PY, gap: 48 },
  header: { maxWidth: 640, gap: 16 },
  headerMobile: { maxWidth: '100%', gap: 16, alignSelf: 'center', alignItems: 'center' },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: '#EDE9FE',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
  },
  badgeMobile: { alignSelf: 'center' },
  badgeText: { fontSize: 13, fontWeight: '700', color: '#6D28D9' },
  title: {
    fontWeight: '800',
    color: HOME.dark,
    letterSpacing: -1.2,
  },
  titleMobile: { textAlign: 'center' },
  lead: {
    fontSize: 17,
    lineHeight: 28,
    fontWeight: '500',
    color: HOME.body,
    letterSpacing: -0.2,
  },
  leadMobile: { textAlign: 'center' },
  cardGrid: {
    flexDirection: 'row',
    gap: 24,
    alignItems: 'stretch',
  },
  cardGridStack: {
    flexDirection: 'column',
  },
  cardWrap: { flex: 1, minWidth: 0 },
  card: {
    flex: 1,
    backgroundColor: HOME.white,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 4,
  },
  illusWrap: {
    height: 180,
    padding: 12,
    paddingBottom: 0,
  },
  cardBody: {
    padding: 20,
    paddingTop: 16,
    gap: 10,
    flex: 1,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: HOME.dark,
    letterSpacing: -0.4,
  },
  cardDesc: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '500',
    color: HOME.textSec,
  },
  tagRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 'auto',
    paddingTop: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  tagEmoji: { fontSize: 12 },
  tagLabel: { fontSize: 12, fontWeight: '700', color: HOME.textSec },
});
