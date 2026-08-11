import React from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { HOME, HOME_COPY, RECORD_FEATURE_CHIPS } from '@/components/home/homeTheme';
import { HomeMultilineText, HomeText } from '@/components/home/HomeText';
import { SECTION_PY } from '@/components/home/homeStyles';
import { PhoneFrame } from '@/components/home/PhoneFrame';
import { RevealSection, SectionContainer } from '@/components/home/RevealSection';
import { WEB_KO_TITLE_LINE, WEB_NO_TRANSLATE } from '@/components/home/homeWeb';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

/** 섹션 3 — 지출 이유 */
export function StoryRecordSection() {
  const { width } = useWindowDimensions();
  const isMobile = width < 768;
  const titleSize = isMobile ? 28 : 40;

  return (
    <View style={styles.section} {...WEB_NO_TRANSLATE}>
      <SectionContainer style={styles.wrap}>
        <View style={[styles.row, isMobile && styles.rowMobile]}>
          <RevealSection style={styles.phoneWrap}>
            <View style={styles.phoneBlob} pointerEvents="none" />
            <PhoneFrame screen="regret-analysis" size="hero" rotate={isMobile ? 0 : -2} />
          </RevealSection>

          <View style={[styles.copyCol, isMobile && styles.copyColMobile]}>
            <RevealSection delay={80}>
              <View style={[styles.indexBadge, isMobile && styles.indexBadgeMobile]}>
                <HomeText style={styles.indexText}>03</HomeText>
              </View>

              <HomeText
                style={[
                  styles.title,
                  { fontSize: titleSize, lineHeight: titleSize * 1.12 },
                  WEB_KO_TITLE_LINE,
                  isMobile && styles.titleMobile,
                ]}
              >
                무엇을 샀는지보다{'\n'}
                <HomeText style={[styles.titleAccent, { fontSize: titleSize, lineHeight: titleSize * 1.12 }]}>
                  왜
                </HomeText>
                {' '}샀는지가 중요합니다
              </HomeText>

              <View style={styles.accentLine} />

              <HomeMultilineText
                text={HOME_COPY.recordSub}
                align={isMobile ? 'center' : 'left'}
                style={[styles.body, isMobile && styles.bodyMobile]}
              />
            </RevealSection>

            <RevealSection delay={160}>
              <View style={[styles.featureGrid, isMobile && styles.featureGridMobile]}>
                {RECORD_FEATURE_CHIPS.map((chip) => (
                  <View key={chip.title} style={styles.featureItem}>
                    <View style={[styles.featureIcon, { backgroundColor: chip.bg }]}>
                      <MaterialIcons name={chip.icon as IconName} size={20} color={chip.color} />
                    </View>
                    <View style={styles.featureCopy}>
                      <HomeText style={styles.featureTitle}>{chip.title}</HomeText>
                      <HomeText style={styles.featureDesc}>{chip.desc}</HomeText>
                    </View>
                  </View>
                ))}
              </View>
            </RevealSection>
          </View>
        </View>
      </SectionContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { backgroundColor: HOME.white },
  wrap: { paddingVertical: SECTION_PY },
  row: { flexDirection: 'row', alignItems: 'center', gap: 56 },
  rowMobile: { flexDirection: 'column', gap: 36 },
  phoneWrap: { flex: 1, alignItems: 'center', position: 'relative' },
  phoneBlob: {
    position: 'absolute',
    width: 360,
    height: 360,
    borderRadius: 180,
    backgroundColor: HOME.greenLight,
    top: '50%',
    left: '50%',
    marginLeft: -180,
    marginTop: -180,
    opacity: 0.6,
    ...(Platform.OS === 'web'
      ? ({ filter: 'blur(60px)', WebkitFilter: 'blur(60px)' } as object)
      : {}),
  },
  copyCol: { flex: 1, maxWidth: 480 },
  copyColMobile: { maxWidth: '100%', alignItems: 'center' },
  indexBadge: {
    alignSelf: 'flex-start',
    backgroundColor: HOME.greenLight,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  indexBadgeMobile: { alignSelf: 'center' },
  indexText: { fontSize: 13, fontWeight: '800', color: HOME.green },
  title: {
    fontWeight: '800',
    color: HOME.dark,
    letterSpacing: -1,
  },
  titleAccent: { fontWeight: '800', color: HOME.green },
  titleMobile: { textAlign: 'center' },
  accentLine: {
    width: 48,
    height: 4,
    borderRadius: 2,
    backgroundColor: HOME.green,
    marginTop: 16,
    marginBottom: 16,
    transform: [{ rotate: '-2deg' }],
  },
  body: {
    fontSize: 16,
    lineHeight: 26,
    fontWeight: '500',
    color: HOME.body,
  },
  bodyMobile: { textAlign: 'center' },
  featureGrid: { marginTop: 28, gap: 16 },
  featureGridMobile: { width: '100%' },
  featureItem: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  featureIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureCopy: { flex: 1, gap: 2 },
  featureTitle: { fontSize: 14, fontWeight: '800', color: HOME.dark },
  featureDesc: { fontSize: 13, lineHeight: 19, fontWeight: '500', color: HOME.textMuted },
});
