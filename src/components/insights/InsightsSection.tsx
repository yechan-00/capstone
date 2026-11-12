import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { useInsightsPalette } from '@/theme/insightsTheme';

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
  const t = useInsightsPalette();
  return (
    <View style={[styles.wrap, backgroundTint ? { backgroundColor: backgroundTint } : null, style]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: t.text }]}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: t.textMuted }]}>{subtitle}</Text> : null}
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
    letterSpacing: -0.4,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
});
