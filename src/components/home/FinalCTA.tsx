import React from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { HOME, HOME_COPY, HOME_GRADIENT, HOME_TITLE_LINES } from '@/components/home/homeTheme';
import { HomeLinesText, HomeMultilineText, HomeText } from '@/components/home/HomeText';
import { homeButtons, SECTION_PY } from '@/components/home/homeStyles';
import { RevealSection, SectionContainer } from '@/components/home/RevealSection';

export function FinalCTA() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const titleSize = isMobile ? 30 : 44;

  return (
    <LinearGradient colors={[...HOME_GRADIENT.hero]} style={styles.gradient}>
      <SectionContainer style={styles.wrap}>
        <RevealSection style={styles.center}>
          <HomeLinesText
            lines={HOME_TITLE_LINES.final}
            align="center"
            style={[styles.title, { fontSize: titleSize, lineHeight: titleSize * 1.12 }]}
          />
          <HomeMultilineText
            text={HOME_COPY.finalSub}
            align="center"
            style={[styles.sub, isMobile && styles.subMobile]}
          />

          <View style={[styles.ctaRow, isMobile && styles.ctaRowMobile]}>
            <Pressable
              onPress={() => router.push('/login')}
              style={({ pressed }) => [homeButtons.primary, pressed && { opacity: 0.92 }]}
            >
              <HomeText style={homeButtons.primaryText}>{HOME_COPY.ctaPrimary}</HomeText>
            </Pressable>
          </View>

          <View style={[styles.storeRow, isMobile && styles.storeRowMobile]}>
            <View style={styles.storeCard}>
              <HomeText style={styles.storeIcon}></HomeText>
              <View style={styles.storeText}>
                <HomeText style={styles.storeLabel}>{HOME_COPY.storeAppStore}</HomeText>
                <HomeText style={styles.storeSub}>{HOME_COPY.storeComingSoon}</HomeText>
              </View>
            </View>
            <View style={styles.storeCard}>
              <HomeText style={styles.storeIcon}>▶</HomeText>
              <View style={styles.storeText}>
                <HomeText style={styles.storeLabel}>{HOME_COPY.storeGooglePlay}</HomeText>
                <HomeText style={styles.storeSub}>{HOME_COPY.storeComingSoon}</HomeText>
              </View>
            </View>
            {Platform.OS === 'web' && !isMobile ? (
              <View style={[styles.storeCard, styles.qrCard]}>
                <HomeText style={styles.qrText}>큐알</HomeText>
                <HomeText style={styles.storeSub}>{HOME_COPY.storeQr}</HomeText>
              </View>
            ) : null}
          </View>
        </RevealSection>

        <HomeText style={styles.footer}>{HOME_COPY.footer}</HomeText>
      </SectionContainer>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { width: '100%' },
  wrap: {
    paddingTop: SECTION_PY,
    paddingBottom: 80,
    alignItems: 'center',
  },
  center: {
    width: '100%',
    alignItems: 'center',
  },
  title: {
    fontWeight: '800',
    color: HOME.brand,
    textAlign: 'center',
    letterSpacing: -0.8,
  },
  sub: {
    marginTop: 20,
    fontSize: 16,
    lineHeight: 26,
    fontWeight: '500',
    color: HOME.body,
    textAlign: 'center',
    maxWidth: 400,
  },
  subMobile: { fontSize: 15, lineHeight: 24 },
  ctaRow: {
    marginTop: 36,
    alignItems: 'center',
  },
  ctaRowMobile: {
    width: '100%',
    maxWidth: 320,
  },
  storeRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 36,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    maxWidth: 580,
  },
  storeRowMobile: {
    flexDirection: 'column',
    maxWidth: 200,
  },
  storeCard: {
    width: 188,
    height: 76,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: HOME.white,
    borderWidth: 1,
    borderColor: HOME.grayDark,
    borderRadius: 16,
    paddingHorizontal: 14,
  },
  storeText: { flexShrink: 1 },
  storeIcon: { fontSize: 20, fontWeight: '700', color: HOME.brand },
  storeLabel: { fontSize: 13, fontWeight: '800', color: HOME.brand },
  storeSub: { fontSize: 11, fontWeight: '600', color: HOME.textMuted, marginTop: 2, textAlign: 'center' },
  qrCard: { flexDirection: 'column', gap: 4 },
  qrText: { fontSize: 18, fontWeight: '900', color: HOME.brand },
  footer: {
    marginTop: 56,
    fontSize: 12,
    fontWeight: '600',
    color: HOME.textMuted,
    textAlign: 'center',
    width: '100%',
  },
});
