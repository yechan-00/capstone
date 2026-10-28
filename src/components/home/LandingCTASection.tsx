import React from 'react';
import { Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { HOME, HOME_COPY } from '@/components/home/homeTheme';
import { HomeMultilineText, HomeText } from '@/components/home/HomeText';
import { SECTION_PY } from '@/components/home/homeStyles';
import { homeButtons } from '@/components/home/homeStyles';
import { PhoneFrame } from '@/components/home/PhoneFrame';
import { RevealSection, SectionContainer } from '@/components/home/RevealSection';
import { StoreBadges } from '@/components/home/StoreBadges';
import { WEB_KO_TITLE_LINE, WEB_NO_TRANSLATE } from '@/components/home/homeWeb';

const PROOF_ITEMS = [
  { icon: 'verified-user' as const, text: HOME_COPY.ctaProofDownloads },
  { icon: 'star' as const, text: HOME_COPY.ctaProofRating },
  { icon: 'lock' as const, text: HOME_COPY.ctaProofPrivacy },
] as const;

/** 섹션 6 — 상단 CTA */
export function LandingCTASection() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const titleSize = isMobile ? 28 : 40;

  return (
    <View style={styles.section} {...WEB_NO_TRANSLATE}>
      <SectionContainer style={styles.wrap}>
        <View style={[styles.row, isMobile && styles.rowMobile]}>
          <View style={[styles.copyCol, isMobile && styles.copyColMobile]}>
            <RevealSection>
              <View style={[styles.badge, isMobile && styles.badgeMobile]}>
                <HomeText style={styles.badgeText}>{HOME_COPY.ctaBadge}</HomeText>
              </View>
              <HomeText
                style={[
                  styles.title,
                  { fontSize: titleSize, lineHeight: titleSize * 1.15 },
                  WEB_KO_TITLE_LINE,
                  isMobile && styles.titleMobile,
                ]}
              >
                {HOME_COPY.ctaTitle}
              </HomeText>
              <HomeMultilineText
                text={HOME_COPY.ctaSub}
                align={isMobile ? 'center' : 'left'}
                style={[styles.sub, isMobile && styles.subMobile]}
              />
              <Pressable
                onPress={() => router.push('/login')}
                style={({ pressed }) => [
                  homeButtons.primary,
                  styles.ctaBtn,
                  isMobile && styles.ctaBtnMobile,
                  pressed && { opacity: 0.92 },
                ]}
              >
                <HomeText style={homeButtons.primaryText}>{HOME_COPY.ctaPrimary}</HomeText>
                <MaterialIcons name="arrow-forward" size={18} color={HOME.white} />
              </Pressable>
            </RevealSection>
          </View>

          <RevealSection delay={120} style={styles.phoneCol}>
            <PhoneFrame screen="regret-index" size="compact" rotate={isMobile ? 0 : 4} lightBezel />
          </RevealSection>

          <RevealSection delay={180} style={isMobile ? styles.proofColMobileFull : styles.proofCol}>
            <HomeText style={styles.proofTitle}>{HOME_COPY.ctaProofTitle}</HomeText>
            {PROOF_ITEMS.map((item) => (
              <View key={item.text} style={styles.proofRow}>
                <View style={styles.proofIcon}>
                  <MaterialIcons name={item.icon} size={18} color={HOME.green} />
                </View>
                <HomeText style={styles.proofText}>{item.text}</HomeText>
              </View>
            ))}
            <StoreBadges compact align={isMobile ? 'center' : 'left'} />
          </RevealSection>
        </View>
      </SectionContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { backgroundColor: HOME.bgSoft },
  wrap: { paddingVertical: SECTION_PY },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 40,
  },
  rowMobile: { flexDirection: 'column', gap: 32 },
  copyCol: { flex: 1, maxWidth: 380 },
  copyColMobile: { maxWidth: '100%', alignItems: 'center' },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: HOME.greenLight,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 16,
  },
  badgeMobile: { alignSelf: 'center' },
  badgeText: { fontSize: 13, fontWeight: '700', color: HOME.greenDark },
  title: {
    fontWeight: '800',
    color: HOME.dark,
    letterSpacing: -1,
    marginBottom: 14,
  },
  titleMobile: { textAlign: 'center' },
  sub: {
    fontSize: 16,
    lineHeight: 26,
    fontWeight: '500',
    color: HOME.body,
    marginBottom: 24,
  },
  subMobile: { textAlign: 'center' },
  ctaBtn: { alignSelf: 'flex-start' },
  ctaBtnMobile: { alignSelf: 'stretch' },
  phoneCol: { flexShrink: 0, alignItems: 'center' },
  proofCol: { flex: 1, maxWidth: 300, gap: 14 },
  proofColMobileFull: { flex: 1, maxWidth: '100%', gap: 14, alignItems: 'center' },
  proofTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: HOME.dark,
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  proofRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  proofIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: HOME.greenLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  proofText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '600',
    color: HOME.textSec,
  },
});
