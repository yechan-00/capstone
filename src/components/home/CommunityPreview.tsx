import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { HOME, HOME_COPY, HOME_TITLE_LINES } from '@/components/home/homeTheme';
import { HomeLinesText, HomeMultilineText, HomeText } from '@/components/home/HomeText';
import { SECTION_PY } from '@/components/home/homeStyles';
import { RevealSection, SectionContainer } from '@/components/home/RevealSection';

export function CommunityPreview() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const titleSize = isMobile ? 28 : 40;

  return (
    <SectionContainer style={styles.wrap}>
      <RevealSection>
        <View style={styles.badge}>
          <View style={styles.badgeDot} />
          <HomeText style={styles.badgeText}>{HOME_COPY.communityBadge}</HomeText>
        </View>
        <HomeLinesText
          lines={HOME_TITLE_LINES.community}
          align="center"
          style={[styles.title, { fontSize: titleSize, lineHeight: titleSize * 1.12 }]}
        />
        <HomeMultilineText
          text={HOME_COPY.communityBody}
          align="center"
          style={[styles.body, isMobile && styles.bodyMobile]}
        />
      </RevealSection>
    </SectionContainer>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingVertical: SECTION_PY * 0.8,
    backgroundColor: HOME.white,
    alignItems: 'center',
  },
  badge: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: `${HOME.lime}55`,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: `${HOME.brand}12`,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: HOME.coral,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: HOME.brand,
    letterSpacing: 0.2,
  },
  title: {
    fontWeight: '800',
    color: HOME.brand,
    textAlign: 'center',
    letterSpacing: -0.6,
  },
  body: {
    marginTop: 20,
    fontSize: 16,
    lineHeight: 26,
    fontWeight: '500',
    color: HOME.body,
    textAlign: 'center',
    maxWidth: 440,
    alignSelf: 'center',
  },
  bodyMobile: { fontSize: 15, lineHeight: 24 },
});
