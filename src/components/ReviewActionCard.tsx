import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import type { ScheduleType } from '@/lib/types';
import { scheduleDueLabel } from '@/lib/scheduleLabels';
import { useTheme } from '@/theme/ThemeContext';

type PendingSchedule = { id: string; expenseId: string; dueType: ScheduleType; title?: string; amount?: number; dueAt?: Date };

export function ReviewActionCard({ item, onPressReview }: { item: PendingSchedule; onPressReview: (item: PendingSchedule) => void }) {
  const { colors } = useTheme();
  const dueBadge = scheduleDueLabel(item.dueType);
  const amountLabel = item.amount != null ? `₩${item.amount.toLocaleString()}` : '금액 정보 없음';

  return (
    <View style={[styles.card, { backgroundColor: colors.accentCta }]}>
      <View style={styles.content}>
        <Text style={styles.kicker}>🔔 지금 평가할 소비</Text>
        <Text style={styles.title} numberOfLines={1}>{item.title ?? '소비 평가'}</Text>
        <Text style={styles.amount}>{amountLabel}</Text>
        <View style={styles.badgeRow}>
          <View style={styles.badge}><Text style={styles.badgeText}>{dueBadge} 리뷰</Text></View>
          <Text style={styles.badgeHint}>평가해서 다음 소비도 더 현명하게!</Text>
        </View>
      </View>
      <Pressable style={[styles.ctaButton, { backgroundColor: colors.primaryDark }]} onPress={() => onPressReview(item)}>
        <Text style={styles.ctaText}>지금 평가하기 →</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 18, padding: 22, minHeight: 210, justifyContent: 'space-between', shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.18, shadowRadius: 18, elevation: 6 },
  content: { gap: 6 },
  kicker: { color: 'rgba(255,255,255,0.95)', fontWeight: '800', fontSize: 12 },
  title: { color: '#fff', fontWeight: '900', fontSize: 20 },
  amount: { color: '#fff', fontWeight: '900', fontSize: 18 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  badge: { backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  badgeHint: { color: 'rgba(255,255,255,0.95)', fontWeight: '700', fontSize: 12 },
  ctaButton: { marginTop: 14, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  ctaText: { color: '#fff', fontWeight: '900', fontSize: 16 },
});
