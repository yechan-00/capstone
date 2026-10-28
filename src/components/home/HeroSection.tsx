import React from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { HomeMultilineText, HomeText } from '@/components/home/HomeText';
import { HOME, HOME_COPY } from '@/components/home/homeTheme';
import { homeButtons } from '@/components/home/homeStyles';
import { PhoneFrame } from '@/components/home/PhoneFrame';
import { RevealSection } from '@/components/home/RevealSection';
import { WEB_KO_TITLE_LINE, WEB_NO_TRANSLATE } from '@/components/home/homeWeb';

const TRUST_ITEMS = [
  {
    icon: 'verified-user' as const,
    title: HOME_COPY.heroTrustSafeTitle,
    desc: HOME_COPY.heroTrustSafeDesc,
  },
  {
    icon: 'lock-outline' as const,
    title: HOME_COPY.heroTrustPrivacyTitle,
    desc: HOME_COPY.heroTrustPrivacyDesc,
  },
  {
    icon: 'sentiment-satisfied-alt' as const,
    title: HOME_COPY.heroTrustFreeTitle,
    desc: HOME_COPY.heroTrustFreeDesc,
  },
] as const;

const AVATAR_COLORS = ['#34785F', '#42A5F5', '#FFA726', '#AB47BC', '#26A69A', '#EF5350'] as const;

type Props = {
  onExplore?: () => void;
  onFeatureBarLayout?: (y: number) => void;
};

export function HeroSection({ onFeatureBarLayout }: Props) {
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const isMobile = width < 768;
  const titleSize = isMobile ? 36 : Math.min(56, Math.floor(width * 0.042));
  const heroMinHeight =
    Platform.OS === 'web'
      ? (`calc(100vh - ${HOME.headerHeight}px)` as unknown as number)
      : Math.max(height - HOME.headerHeight, 640);

  return (
    <View
      style={[styles.block, { minHeight: heroMinHeight }]}
      onLayout={(e) => onFeatureBarLayout?.(e.nativeEvent.layout.y)}
      {...WEB_NO_TRANSLATE}
    >
      <View style={[styles.blob, isMobile && styles.blobMobile]} />

      <View style={styles.content}>
        <View style={[styles.inner, isMobile && styles.innerMobile]}>
          <View style={[styles.copyCol, isMobile && styles.copyColMobile]}>
            <RevealSection delay={0}>
              <View style={[styles.badge, isMobile && styles.badgeCenter]}>
                <Text style={styles.badgeEmoji}>📈</Text>
                <HomeText style={styles.badgeText}>{HOME_COPY.heroBadge}</HomeText>
              </View>
            </RevealSection>

            <RevealSection delay={60}>
              <HomeText
                style={[
                  styles.title,
                  styles.titleDark,
                  { fontSize: titleSize, lineHeight: titleSize * 1.12 },
                  WEB_KO_TITLE_LINE,
                  isMobile && styles.titleCenter,
                ]}
              >
                {HOME_COPY.heroTitleLine1}
              </HomeText>
              <HomeText
                style={[
                  styles.title,
                  styles.titleGreen,
                  { fontSize: titleSize, lineHeight: titleSize * 1.12 },
                  WEB_KO_TITLE_LINE,
                  isMobile && styles.titleCenter,
                ]}
              >
                {HOME_COPY.heroTitleLine2}
              </HomeText>
            </RevealSection>

            <RevealSection delay={120}>
              <HomeMultilineText
                text={HOME_COPY.heroSub}
                align={isMobile ? 'center' : 'left'}
                style={[styles.sub, isMobile && styles.subCenter]}
              />
            </RevealSection>

            <RevealSection delay={160}>
              <Pressable
                onPress={() => router.push('/login')}
                style={({ pressed }) => [
                  homeButtons.primary,
                  styles.ctaPrimary,
                  isMobile && styles.ctaPrimaryMobile,
                  pressed && { opacity: 0.92 },
                ]}
              >
                <HomeText style={homeButtons.primaryText}>{HOME_COPY.ctaPrimaryHero}</HomeText>
                <MaterialIcons name="chevron-right" size={20} color={HOME.white} />
              </Pressable>
            </RevealSection>

            <RevealSection delay={200}>
              <View style={[styles.trustRow, isMobile && styles.trustRowMobile]}>
                {TRUST_ITEMS.map((item) => (
                  <View key={item.title} style={styles.trustItem}>
                    <View style={styles.trustIcon}>
                      <MaterialIcons name={item.icon} size={16} color={HOME.green} />
                    </View>
                    <HomeText style={styles.trustTitle}>{item.title}</HomeText>
                    <HomeText style={styles.trustDesc}>{item.desc}</HomeText>
                  </View>
                ))}
              </View>
            </RevealSection>

            <RevealSection delay={240}>
              <View style={[styles.socialRow, isMobile && styles.socialRowMobile]}>
                <HomeText style={styles.socialLabel}>{HOME_COPY.heroSocialProof}</HomeText>
                <View style={styles.avatarRow}>
                  {AVATAR_COLORS.map((color, i) => (
                    <View
                      key={color}
                      style={[
                        styles.avatar,
                        { backgroundColor: color, marginLeft: i === 0 ? 0 : -8, zIndex: 6 - i },
                      ]}
                    />
                  ))}
                  <View style={styles.userCountBadge}>
                    <HomeText style={styles.userCountText}>{HOME_COPY.heroUserCount}</HomeText>
                  </View>
                </View>
              </View>
            </RevealSection>
          </View>

          <View style={[styles.phoneCol, isMobile && styles.phoneColMobile]}>
            <RevealSection delay={100}>
              <PhoneFrame screen="hero-dashboard" floating size="hero" rotate={0} lightBezel />
            </RevealSection>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    overflow: 'hidden',
    backgroundColor: HOME.white,
    position: 'relative',
  },
  blob: {
    position: 'absolute',
    top: '8%',
    right: '-8%',
    width: 520,
    height: 520,
    borderRadius: 260,
    backgroundColor: 'rgba(52, 195, 111, 0.08)',
  },
  blobMobile: {
    top: '42%',
    right: '-30%',
    width: 360,
    height: 360,
    borderRadius: 180,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingTop: HOME.headerHeight + 24,
    paddingBottom: 56,
  },
  inner: {
    width: '100%',
    maxWidth: HOME.maxWidth,
    alignSelf: 'center',
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 32,
  },
  innerMobile: {
    flexDirection: 'column-reverse',
    gap: 36,
  },
  copyCol: {
    flex: 1,
    maxWidth: 480,
    minWidth: 280,
  },
  copyColMobile: {
    maxWidth: '100%',
    width: '100%',
    alignItems: 'center',
  },
  badge: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: HOME.greenLight,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    marginBottom: 20,
  },
  badgeCenter: { alignSelf: 'center' },
  badgeEmoji: { fontSize: 14 },
  badgeText: {
    fontSize: 13,
    fontWeight: '700',
    color: HOME.greenDark,
    letterSpacing: -0.2,
  },
  title: {
    fontWeight: '800',
    letterSpacing: -1.8,
  },
  titleDark: { color: HOME.dark },
  titleGreen: { color: HOME.green },
  titleCenter: { textAlign: 'center' },
  sub: {
    marginTop: 18,
    fontSize: 17,
    lineHeight: 28,
    fontWeight: '500',
    color: HOME.body,
    letterSpacing: -0.3,
  },
  subCenter: { textAlign: 'center' },
  ctaPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 28,
    paddingHorizontal: 28,
    paddingVertical: 16,
    borderRadius: 14,
    alignSelf: 'flex-start',
    minWidth: 240,
  },
  ctaPrimaryMobile: {
    alignSelf: 'stretch',
    width: '100%',
  },
  trustRow: {
    flexDirection: 'row',
    gap: 20,
    marginTop: 28,
    paddingTop: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: HOME.gray,
  },
  trustRowMobile: {
    flexDirection: 'column',
    gap: 16,
    width: '100%',
  },
  trustItem: {
    flex: 1,
    gap: 4,
  },
  trustIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: HOME.greenLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  trustTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: HOME.dark,
    letterSpacing: -0.2,
  },
  trustDesc: {
    fontSize: 11,
    lineHeight: 16,
    fontWeight: '500',
    color: HOME.textMuted,
  },
  socialRow: {
    marginTop: 24,
    gap: 10,
  },
  socialRowMobile: {
    alignItems: 'center',
  },
  socialLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: HOME.textSec,
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: HOME.white,
  },
  userCountBadge: {
    marginLeft: 8,
    backgroundColor: HOME.greenLight,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  userCountText: {
    fontSize: 12,
    fontWeight: '800',
    color: HOME.greenDark,
  },
  phoneCol: {
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phoneColMobile: {
    width: '100%',
  },
});
