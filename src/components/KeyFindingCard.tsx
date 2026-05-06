import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';

export function KeyFindingCard({ title, desc }: { title: string; desc: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.keyFindingBg }]}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.desc}>{desc}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, padding: 16 },
  title: { color: 'rgba(255,255,255,0.85)', fontWeight: '900', fontSize: 15 },
  desc: { marginTop: 8, color: 'rgba(255,255,255,0.8)', fontWeight: '700', lineHeight: 20 },
});
