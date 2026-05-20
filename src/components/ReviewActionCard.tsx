import React from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import type { ScheduleType } from '@/lib/types';
import { scheduleDueLabel } from '@/lib/scheduleLabels';
import { useTheme } from '@/theme/ThemeContext';

type PendingSchedule = { id: string; expenseId: string; dueType: ScheduleType; title?: string; amount?: number; dueAt?: Date };

export function ReviewActionCard({ item, onPressReview }: { item: PendingSchedule; onPressReview: (item: PendingSchedule) => void }) {
  const { colors, isDark } = useTheme();
  const dueBadge = scheduleDueLabel(item.dueType);
  const amountLabel = item.amount != null ? `₩${item.amount.toLocaleString()}` : '금액 정보 없음';
  const elevated =
    !isDark && Platform.OS !== 'web'
      ? {
          shadowColor: '#1a2d4a',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.07,
          shadowRadius: 14,
          elevation: 3,
        }
      : {};

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, elevated]}>
      <View style={styles.content}>
        <Text style={[styles.kicker, { color: colors.textMuted }]}>평가 대기</Text>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {item.title?.trim() || '소비 평가'}
        </Text>
        <Text style={[styles.amount, { color: colors.primary }]}>{amountLabel}</Text>
        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
            <Text style={[styles.badgeText, { color: colors.textSec }]}>{dueBadge} 리뷰</Text>
          </View>
        </View>
      </View>
      <Pressable
        style={[styles.ctaButton, { backgroundColor: colors.accentCta }]}
        onPress={() => onPressReview(item)}
      >
        <Text style={[styles.ctaText, { color: colors.onPrimary }]}>평가하기</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
    gap: 14,
  },
  content: { gap: 6 },
  kicker: { fontWeight: '700', fontSize: 12, letterSpacing: 0.2 },
  title: { fontWeight: '800', fontSize: 17, letterSpacing: -0.2 },
  amount: { fontWeight: '800', fontSize: 16, marginTop: 2 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  badge: {
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: { fontWeight: '800', fontSize: 11 },
  ctaButton: { borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  ctaText: { fontWeight: '800', fontSize: 15 },
});
