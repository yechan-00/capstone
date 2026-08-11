import React from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { BRAND_NAME } from '@/constants/brand';
import { HOME, HOME_COPY } from '@/components/home/homeTheme';
import { HomeMultilineText, HomeText } from '@/components/home/HomeText';
import { SECTION_PY } from '@/components/home/homeStyles';
import { PhoneFrame } from '@/components/home/PhoneFrame';
import { RevealSection, SectionContainer } from '@/components/home/RevealSection';
import { WEB_KO_TITLE_LINE, WEB_NO_TRANSLATE } from '@/components/home/homeWeb';

const SIDE_FEATURES = [
  {
    icon: 'notifications-none' as const,
    title: '반복되는 순간 포착',
    desc: '자주 후회한 시간대를 분석해 미리 알려드려요.',
    align: 'left' as const,
  },
  {
    icon: 'lightbulb-outline' as const,
    title: '현명한 선택을 응원',
    desc: '지금의 작은 선택이 내일의 후회를 줄여줘요.',
    align: 'right' as const,
  },
];

/** 섹션 5 — 알림 예방 */
export function StoryPreventionSection() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const titleSize = isMobile ? 28 : 40;

  return (
    <View style={styles.section} {...WEB_NO_TRANSLATE}>
      <SectionContainer style={styles.wrap}>
        <RevealSection style={isMobile ? styles.headerMobileFull : styles.header}>
          <View style={styles.brandPill}>
            <HomeText style={styles.brandPillText}>{BRAND_NAME}</HomeText>
          </View>
          <HomeText
            style={[
              styles.title,
              { fontSize: titleSize, lineHeight: titleSize * 1.14 },
              WEB_KO_TITLE_LINE,
            ]}
          >
            후회하기 전에{'\n'}
            <HomeText style={[styles.titleAccent, { fontSize: titleSize, lineHeight: titleSize * 1.14 }]}>
              먼저 알려드립니다
            </HomeText>
          </HomeText>
          <HomeMultilineText
            text={HOME_COPY.preventionBodyExtended}
            align="center"
            style={styles.body}
          />
        </RevealSection>

        <View style={[styles.phoneRow, isMobile && styles.phoneRowMobile]}>
          {!isMobile ? (
            <RevealSection delay={100} style={styles.sideCol}>
              <SideFeature {...SIDE_FEATURES[0]} />
            </RevealSection>
          ) : null}

          <RevealSection delay={60}>
            <PhoneFrame screen="notification" size="hero" rotate={0} />
          </RevealSection>

          {!isMobile ? (
            <RevealSection delay={140} style={styles.sideCol}>
              <SideFeature {...SIDE_FEATURES[1]} />
            </RevealSection>
          ) : null}
        </View>

        {isMobile ? (
          <View style={styles.mobileFeatures}>
            {SIDE_FEATURES.map((item) => (
              <SideFeature key={item.title} {...item} />
            ))}
          </View>
        ) : null}
      </SectionContainer>
    </View>
  );
}

function SideFeature({
  icon,
  title,
  desc,
}: {
  icon: 'notifications-none' | 'lightbulb-outline';
  title: string;
  desc: string;
}) {
  return (
    <View style={styles.sideFeature}>
      <View style={styles.sideIconRing}>
        <MaterialIcons name={icon} size={24} color={HOME.green} />
      </View>
      <HomeText style={styles.sideTitle}>{title}</HomeText>
      <HomeText style={styles.sideDesc}>{desc}</HomeText>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { backgroundColor: HOME.bgSoft },
  wrap: { paddingVertical: SECTION_PY, gap: 36 },
  header: { alignItems: 'center', gap: 14, maxWidth: 560, alignSelf: 'center' },
  headerMobileFull: {
    alignItems: 'center',
    gap: 14,
    maxWidth: 560,
    alignSelf: 'center',
    paddingHorizontal: 8,
  },
  brandPill: {
    backgroundColor: HOME.green,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 999,
  },
  brandPillText: { fontSize: 13, fontWeight: '800', color: HOME.white },
  title: {
    fontWeight: '800',
    color: HOME.dark,
    textAlign: 'center',
    letterSpacing: -1,
  },
  titleAccent: { fontWeight: '800', color: HOME.green },
  body: {
    fontSize: 16,
    lineHeight: 26,
    fontWeight: '500',
    color: HOME.body,
    textAlign: 'center',
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 32,
  },
  phoneRowMobile: { gap: 0 },
  sideCol: { width: 200, alignItems: 'center' },
  sideFeature: { alignItems: 'center', gap: 10, maxWidth: 180 },
  sideIconRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 2,
    borderColor: HOME.greenLight,
    backgroundColor: HOME.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: HOME.green,
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  sideDesc: {
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '500',
    color: HOME.textSec,
    textAlign: 'center',
  },
  mobileFeatures: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 24,
    paddingHorizontal: 16,
  },
});
