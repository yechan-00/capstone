import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';

export function DataQualityCard({ count, minCount = 5, onAddExpense }: { count: number; minCount?: number; onAddExpense?: () => void }) {
  const { colors } = useTheme();
  const remain = Math.max(0, minCount - count);

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text }]}>인사이트를 만드는 중이에요</Text>
      <Text style={[styles.desc, { color: colors.textSec }]}>현재 데이터 {count}건. {remain}건 더 기록하면 패턴이 더 정확해져요.</Text>
      {onAddExpense ? (
        <TouchableOpacity style={[styles.button, { backgroundColor: colors.text }]} onPress={onAddExpense}>
          <Text style={[styles.buttonText, { color: colors.bg }]}>소비 추가</Text>
        </TouchableOpacity>
      ) : null}
      <Text style={[styles.tip, { color: colors.textMuted }]}>팁: 먼저 3~5건만 모아도 "후회 포인트"가 보이기 시작해요.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, padding: 16, borderWidth: 1 },
  title: { fontWeight: '900', fontSize: 16 },
  desc: { marginTop: 8, lineHeight: 20, fontWeight: '600' },
  tip: { marginTop: 10, fontWeight: '600', fontSize: 12 },
  button: { marginTop: 12, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  buttonText: { fontWeight: '800' },
});
