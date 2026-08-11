import React from 'react';
import { Platform, Pressable, StyleSheet, TextInput, View, useWindowDimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { BrandLogo } from '@/components/BrandLogo';
import { HOME, HOME_COPY } from '@/components/home/homeTheme';
import { HomeText } from '@/components/home/HomeText';
import { SectionContainer } from '@/components/home/RevealSection';
import { WEB_NO_TRANSLATE } from '@/components/home/homeWeb';

const FOOTER_COLS = [
  {
    title: '서비스',
    links: ['소개', '기능', '사용 방법', '요금'],
  },
  {
    title: '고객 지원',
    links: ['FAQ', '문의하기', '의견 보내기'],
  },
  {
    title: '회사',
    links: ['회사 소개', '블로그', '채용', '제휴 문의'],
  },
  {
    title: '정책',
    links: ['개인정보처리방침', '이용약관', '위치기반서비스'],
  },
] as const;

const SOCIAL_ICONS = [
  { name: 'photo-camera' as const, label: 'Instagram' },
  { name: 'play-circle-outline' as const, label: 'YouTube' },
  { name: 'public' as const, label: 'Website' },
  { name: 'article' as const, label: 'Blog' },
] as const;

/** 푸터 — 히어로(1번) 아래 */
export function LandingFooterSection() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;

  return (
    <View style={styles.section} {...WEB_NO_TRANSLATE}>
      <SectionContainer style={styles.wrap}>
        <View style={[styles.topRow, isMobile && styles.topRowMobile]}>
          <View style={styles.brandCol}>
            <BrandLogo iconSize={40} labelSize={16} layout="column" tone="home" />
            <HomeText style={styles.tagline}>{HOME_COPY.footerTagline}</HomeText>
            <View style={styles.socialRow}>
              {SOCIAL_ICONS.map((item) => (
                <View key={item.label} style={styles.socialBtn} accessibilityLabel={item.label}>
                  <MaterialIcons name={item.name} size={18} color={HOME.textSec} />
                </View>
              ))}
            </View>
          </View>

          <View style={[styles.linkGrid, isMobile && styles.linkGridMobile]}>
            {FOOTER_COLS.map((col) => (
              <View key={col.title} style={styles.linkCol}>
                <HomeText style={styles.linkTitle}>{col.title}</HomeText>
                {col.links.map((link) => (
                  <Pressable key={link} style={styles.linkItem}>
                    <HomeText style={styles.linkText}>{link}</HomeText>
                  </Pressable>
                ))}
              </View>
            ))}
          </View>

          {!isMobile ? (
            <View style={styles.newsletter}>
              <HomeText style={styles.newsletterTitle}>{HOME_COPY.footerNewsletterTitle}</HomeText>
              <HomeText style={styles.newsletterSub}>{HOME_COPY.footerNewsletterSub}</HomeText>
              <View style={styles.emailRow}>
                <TextInput
                  placeholder="이메일 주소"
                  placeholderTextColor={HOME.textMuted}
                  style={styles.emailInput}
                  {...(Platform.OS === 'web' ? ({ type: 'email' } as object) : {})}
                />
                <Pressable style={styles.subscribeBtn}>
                  <HomeText style={styles.subscribeText}>구독하기</HomeText>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.bottomBar}>
          <HomeText style={styles.copyright}>{HOME_COPY.footerCopyright}</HomeText>
          <View style={styles.bottomLinks}>
            <HomeText style={styles.bottomLink}>이용약관</HomeText>
            <HomeText style={styles.bottomDot}>·</HomeText>
            <HomeText style={styles.bottomLink}>개인정보처리방침</HomeText>
          </View>
        </View>
      </SectionContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    backgroundColor: '#F0F2F0',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: HOME.gray,
  },
  wrap: {
    paddingTop: 56,
    paddingBottom: 32,
    gap: 40,
  },
  topRow: {
    flexDirection: 'row',
    gap: 40,
    alignItems: 'flex-start',
  },
  topRowMobile: { flexDirection: 'column', gap: 32 },
  brandCol: { width: 200, gap: 12 },
  tagline: {
    fontSize: 13,
    lineHeight: 20,
    fontWeight: '500',
    color: HOME.textSec,
  },
  socialRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  socialBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: HOME.white,
    borderWidth: 1,
    borderColor: HOME.gray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 24,
  },
  linkGridMobile: { width: '100%' },
  linkCol: { minWidth: 100, gap: 8 },
  linkTitle: { fontSize: 13, fontWeight: '800', color: HOME.dark, marginBottom: 4 },
  linkItem: { paddingVertical: 2 },
  linkText: { fontSize: 13, fontWeight: '500', color: HOME.textSec },
  newsletter: {
    width: 280,
    backgroundColor: HOME.white,
    borderRadius: 16,
    padding: 18,
    gap: 10,
    borderWidth: 1,
    borderColor: HOME.gray,
  },
  newsletterTitle: { fontSize: 14, fontWeight: '800', color: HOME.dark, lineHeight: 20 },
  newsletterSub: { fontSize: 12, lineHeight: 18, fontWeight: '500', color: HOME.textMuted },
  emailRow: { flexDirection: 'row', gap: 8, marginTop: 4 },
  emailInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: HOME.gray,
    borderRadius: 10,
    paddingHorizontal: 12,
    fontSize: 13,
    color: HOME.dark,
    backgroundColor: HOME.bgSoft,
  },
  subscribeBtn: {
    backgroundColor: HOME.green,
    paddingHorizontal: 14,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  subscribeText: { fontSize: 13, fontWeight: '700', color: HOME.white },
  bottomBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 12,
    paddingTop: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: HOME.gray,
  },
  copyright: { fontSize: 12, fontWeight: '500', color: HOME.textMuted },
  bottomLinks: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bottomLink: { fontSize: 12, fontWeight: '600', color: HOME.textSec },
  bottomDot: { fontSize: 12, color: HOME.textMuted },
});
