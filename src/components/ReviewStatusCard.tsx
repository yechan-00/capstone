import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';

export function ReviewStatusCard({ nextDueInDays, notificationsEnabled = true }: { nextDueInDays?: number; notificationsEnabled?: boolean }) {
  const { colors } = useTheme();
  const title = !notificationsEnabled ? '리뷰 알림이 꺼져 있어요' : nextDueInDays == null ? '예정된 리뷰가 없어요' : `다음 리뷰까지 D-${nextDueInDays}`;
  const desc = !notificationsEnabled ? '알림을 켜면 3일 리뷰를 놓치지 않아요.' : nextDueInDays == null ? '소비를 기록하면 3일 뒤(설정 시각) 리뷰 알림이 잡혀요.' : '리뷰가 쌓일수록 후회 패턴이 더 정확해져요.';

  return (
    <View style={[styles.card, { backgroundColor: colors.surfaceMuted }]}>
      <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.desc, { color: colors.textSec }]}>{desc}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 12, padding: 14 },
  title: { fontWeight: '900', fontSize: 16 },
  desc: { marginTop: 8, lineHeight: 20, fontWeight: '600' },
});
