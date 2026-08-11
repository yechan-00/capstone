import React from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { AnalysisDashboardPanel } from '@/components/home/AnalysisDashboardPanel';
import {
  ANALYSIS_SUMMARY_CARDS,
  HOME,
  HOME_COPY,
} from '@/components/home/homeTheme';
import { SECTION_PY } from '@/components/home/homeStyles';
import { RevealSection, SectionContainer } from '@/components/home/RevealSection';
import { HomeText } from '@/components/home/HomeText';
import { WEB_KO_TITLE_LINE, WEB_NO_TRANSLATE } from '@/components/home/homeWeb';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

/** 섹션 4 — 패턴 분석 (다크) */
export function StoryAnalysisSection() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const titleSize = isMobile ? 28 : 44;

  return (
    <View style={styles.section} {...WEB_NO_TRANSLATE}>
      <View style={styles.glowGreen} pointerEvents="none" />
      <SectionContainer style={styles.wrap}>
        <View style={[styles.topRow, isMobile && styles.topRowMobile]}>
          <RevealSection style={isMobile ? styles.copyColMobile : styles.copyCol}>
            <View style={styles.sectionBadge}>
              <HomeText style={styles.sectionBadgeText}>
                {HOME_COPY.insightSectionIndex} {HOME_COPY.insightSectionLabel}
              </HomeText>
            </View>
            <HomeText
              style={[
                styles.title,
                { fontSize: titleSize, lineHeight: titleSize * 1.12 },
                WEB_KO_TITLE_LINE,
                isMobile && styles.titleCenter,
              ]}
            >
              내 소비에도{'\n'}
              <HomeText style={[styles.titleAccent, { fontSize: titleSize, lineHeight: titleSize * 1.12 }]}>
                패턴
              </HomeText>
              이 있습니다
            </HomeText>
            <HomeText style={[styles.lead, isMobile && styles.leadCenter]}>{HOME_COPY.insightBody}</HomeText>

            <View style={styles.summaryRow}>
              {ANALYSIS_SUMMARY_CARDS.map((item) => (
                <View key={item.label} style={styles.summaryCard}>
                  <MaterialIcons name={item.icon as IconName} size={20} color={HOME.neon} />
                  <HomeText style={styles.summaryLabel}>{item.label}</HomeText>
                  <HomeText style={styles.summaryValue}>{item.value}</HomeText>
                </View>
              ))}
            </View>

            <View style={styles.ctaBar}>
              <MaterialIcons name="gps-fixed" size={18} color={HOME.neon} />
              <HomeText style={styles.ctaText}>{HOME_COPY.insightCtaBar}</HomeText>
              <MaterialIcons name="chevron-right" size={18} color={HOME.neon} />
            </View>
          </RevealSection>

          <RevealSection delay={120} style={styles.dashboardCol}>
            <AnalysisDashboardPanel />
          </RevealSection>
        </View>
      </SectionContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { backgroundColor: HOME.darkDeep, overflow: 'hidden' },
  glowGreen: {
    position: 'absolute',
    top: '10%',
    left: -100,
    width: 400,
    height: 400,
    borderRadius: 200,
    backgroundColor: 'rgba(125,255,154,0.05)',
    ...(Platform.OS === 'web'
      ? ({ filter: 'blur(80px)', WebkitFilter: 'blur(80px)' } as object)
      : {}),
  },
  wrap: { paddingVertical: SECTION_PY },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 40,
  },
  topRowMobile: { flexDirection: 'column', gap: 32 },
  copyCol: { flex: 1, maxWidth: 420, gap: 16 },
  copyColMobile: { flex: 1, maxWidth: '100%', gap: 16, alignItems: 'center' },
  sectionBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: `${HOME.neon}44`,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
  },
  sectionBadgeText: { fontSize: 12, fontWeight: '700', color: HOME.neon },
  title: {
    fontWeight: '800',
    color: HOME.white,
    letterSpacing: -1,
  },
  titleAccent: { fontWeight: '800', color: HOME.neon },
  titleCenter: { textAlign: 'center' },
  lead: {
    fontSize: 15,
    lineHeight: 24,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.55)',
  },
  leadCenter: { textAlign: 'center' },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 8 },
  summaryCard: {
    flex: 1,
    minWidth: 110,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(125,255,154,0.12)',
    padding: 12,
    gap: 6,
  },
  summaryLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.5)' },
  summaryValue: { fontSize: 12, fontWeight: '700', color: HOME.white, lineHeight: 17 },
  ctaBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(125,255,154,0.15)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 8,
  },
  ctaText: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: 'rgba(255,255,255,0.85)',
    lineHeight: 19,
  },
  dashboardCol: { flex: 1.2, minWidth: 0 },
});
