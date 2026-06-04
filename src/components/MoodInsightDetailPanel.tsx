import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import type { MoodInsightDetail } from '@/lib/moodInsightDetail';
import { expenseCategoryLabel } from '@/lib/expenseCategoryLabel';
import { useTheme } from '@/theme/ThemeContext';
import { formatDate } from '@/utils/time';

const SHORT_TIME_LABEL: Record<string, string> = {
  '아침 (6~12시)': '아침',
  '낮 (12~18시)': '낮',
  '저녁 (18~22시)': '저녁',
  '밤 (22~6시)': '밤',
};

function compactCounts(items: { label: string; count: number }[], weekday = false, limit = 3): string {
  if (items.length === 0) return '—';
  return items
    .slice(0, limit)
    .map((x) => {
      const name = weekday ? `${x.label}요일` : (SHORT_TIME_LABEL[x.label] ?? x.label);
      return `${name} ${x.count}`;
    })
    .join(' · ');
}

type Props = {
  detail: MoodInsightDetail;
};

export function MoodInsightDetailPanel({ detail }: Props) {
  const router = useRouter();
  const { colors, isDark } = useTheme();

  const weekdayLine = compactCounts(detail.weekdayCounts, true);
  const timeLine = compactCounts(detail.timeOfDayCounts);
  const categoryLine = compactCounts(detail.categoryCounts);
  const menuLine = compactCounts(detail.menuCounts, false, 2);

  return (
    <View style={[styles.wrap, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
        {detail.moodLabel} 상세
      </Text>
      <Text style={[styles.headline, { color: colors.textSec }]} numberOfLines={1} ellipsizeMode="tail">
        {detail.headline}
      </Text>

      <View style={[styles.patternGrid, { borderColor: colors.border }]}>
        <View style={styles.patternRow}>
          <Text style={[styles.patternLabel, { color: colors.textMuted }]} numberOfLines={1}>
            요일
          </Text>
          <Text style={[styles.patternValue, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">
            {weekdayLine}
          </Text>
        </View>
        <View style={styles.patternRow}>
          <Text style={[styles.patternLabel, { color: colors.textMuted }]} numberOfLines={1}>
            시간
          </Text>
          <Text style={[styles.patternValue, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">
            {timeLine}
          </Text>
        </View>
        <View style={styles.patternRow}>
          <Text style={[styles.patternLabel, { color: colors.textMuted }]} numberOfLines={1}>
            카테고리
          </Text>
          <Text style={[styles.patternValue, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">
            {categoryLine}
          </Text>
        </View>
        {detail.menuCounts.length > 0 ? (
          <View style={styles.patternRow}>
            <Text style={[styles.patternLabel, { color: colors.textMuted }]} numberOfLines={1}>
              메뉴
            </Text>
            <Text style={[styles.patternValue, { color: colors.text }]} numberOfLines={1} ellipsizeMode="tail">
              {menuLine}
            </Text>
          </View>
        ) : null}
      </View>

      <View style={styles.expenseList}>
        {detail.expenses.map((item) => {
          const e = item.expense;
          const title = (e.item ?? e.content ?? e.reason ?? '소비').trim();
          const meta = `${formatDate(e.spentAt, 'M/d')} · ${expenseCategoryLabel(e.category)}`;
          return (
            <Pressable
              key={e.id}
              onPress={() => router.push(`/expense/${e.id}`)}
              style={({ pressed }) => [
                styles.expenseRow,
                {
                  borderColor: item.isRegret ? (isDark ? '#7f1d1d' : '#fecaca') : colors.border,
                  backgroundColor: item.isRegret ? (isDark ? '#3f1d24' : '#fff1f2') : colors.surfaceMuted,
                  opacity: pressed ? 0.88 : 1,
                },
              ]}
            >
              <Text style={styles.expenseLine} numberOfLines={1} ellipsizeMode="tail">
                <Text style={[styles.expenseTitle, { color: colors.text }]}>{title}</Text>
                <Text style={[styles.expenseMeta, { color: colors.textMuted }]}> · {meta}</Text>
              </Text>
              <View style={styles.expenseRight}>
                <Text style={[styles.expenseAmount, { color: colors.text }]} numberOfLines={1}>
                  {e.amount.toLocaleString()}원
                </Text>
                {item.isRegret ? (
                  <Text style={[styles.regretMark, { color: colors.logoutText }]}>후회</Text>
                ) : null}
                <MaterialIcons name="chevron-right" size={16} color={colors.textMuted} />
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  title: { fontSize: 13, fontWeight: '900' },
  headline: { fontSize: 11, fontWeight: '700' },
  patternGrid: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 6,
    gap: 4,
  },
  patternRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  patternLabel: { width: 44, fontSize: 10, fontWeight: '800' },
  patternValue: { flex: 1, minWidth: 0, fontSize: 11, fontWeight: '700' },
  expenseList: { gap: 5 },
  expenseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  expenseLine: { flex: 1, minWidth: 0 },
  expenseTitle: { fontSize: 12, fontWeight: '800' },
  expenseMeta: { fontSize: 10, fontWeight: '600' },
  expenseRight: { flexDirection: 'row', alignItems: 'center', gap: 2, flexShrink: 0 },
  expenseAmount: { fontSize: 11, fontWeight: '900' },
  regretMark: { fontSize: 9, fontWeight: '900' },
});
