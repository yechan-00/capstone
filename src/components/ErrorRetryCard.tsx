import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';

export function ErrorRetryCard({ title = '불러오지 못했어요', desc = '잠시 후 다시 시도해 주세요.', onRetry }: { title?: string; desc?: string; onRetry: () => void }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.desc, { color: colors.textSec }]}>{desc}</Text>
      <TouchableOpacity style={[styles.button, { backgroundColor: colors.text }]} onPress={onRetry}>
        <Text style={[styles.buttonText, { color: colors.bg }]}>다시 시도</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, padding: 16, borderWidth: 1 },
  title: { fontWeight: '900', fontSize: 16 },
  desc: { marginTop: 8, lineHeight: 20, fontWeight: '600' },
  button: { marginTop: 12, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  buttonText: { fontWeight: '800' },
});
