import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { INSIGHTS_THEME } from '@/theme/insightsTheme';

type Props = {
  title: string;
  subtitle?: string;
  backgroundTint?: string;
  children: React.ReactNode;
  style?: ViewStyle;
};

export function InsightsSection({
  title,
  subtitle,
  backgroundTint,
  children,
  style,
}: Props) {
  return (
    <View style={[styles.wrap, backgroundTint ? { backgroundColor: backgroundTint } : null, style]}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: -20,
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 16,
    gap: 14,
  },
  header: {
    gap: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: INSIGHTS_THEME.text,
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: INSIGHTS_THEME.textMuted,
    lineHeight: 18,
  },
});
