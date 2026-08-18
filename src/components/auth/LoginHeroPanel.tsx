import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { BrandLogo } from '@/components/BrandLogo';
import { FeatureCard } from '@/components/auth/FeatureCard';
import {
  LOGIN_FEATURES,
  LOGIN_HEADLINE,
  LOGIN_MOTTO,
  LOGIN_SUBCOPY,
  LOGIN_TAGLINE,
} from '@/components/auth/featureContent';
import { useTheme } from '@/theme/ThemeContext';

type Props = {
  /** 모바일: 짧은 헤더만 / 데스크톱: 전체 소개 */
  variant: 'full' | 'compact';
  showFeatures?: boolean;
};

export function LoginHeroPanel({ variant, showFeatures = true }: Props) {
  const { colors } = useTheme();
  const isFull = variant === 'full';

  return (
    <View style={[styles.wrap, isFull && styles.wrapFull]}>
      <View style={[styles.brand, !isFull && styles.brandCompact]}>
        <BrandLogo iconSize={isFull ? 48 : 40} labelSize={isFull ? 24 : 20} layout="column" tone="auth" />
        <Text style={[styles.tagline, { color: colors.textSec }]}>{LOGIN_TAGLINE}</Text>
        {isFull ? (
          <>
            <Text style={[styles.headline, { color: colors.text }]}>{LOGIN_HEADLINE}</Text>
            <Text style={[styles.subcopy, { color: colors.textSec }]}>{LOGIN_SUBCOPY}</Text>
          </>
        ) : (
          <Text style={[styles.motto, { color: colors.textMuted }]}>{LOGIN_MOTTO}</Text>
        )}
      </View>

      {showFeatures && (
        <View style={[styles.features, isFull && styles.featuresFull]}>
          {LOGIN_FEATURES.map((item) => (
            <FeatureCard key={item.title} {...item} compact={!isFull} />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 16 },
  wrapFull: { flex: 1, paddingTop: 4 },
  brand: { gap: 6, alignItems: 'flex-start' },
  brandCompact: { alignItems: 'center' },
  brandName: {
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
  },
  headline: {
    fontSize: 24,
    lineHeight: 34,
    fontWeight: '900',
    letterSpacing: -0.4,
    marginTop: 4,
  },
  subcopy: {
    fontSize: 15,
    lineHeight: 24,
    fontWeight: '500',
    maxWidth: 480,
  },
  motto: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '600',
    textAlign: 'center',
  },
  features: { gap: 10 },
  featuresFull: { marginTop: 2 },
});
