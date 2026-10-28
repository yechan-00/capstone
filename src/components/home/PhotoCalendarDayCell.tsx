import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { CachedExpenseImage } from '@/components/CachedExpenseImage';
import type { Expense, Review } from '@/lib/types';
import { calendarReviewStatus, calendarReviewStatusStyle } from '@/lib/reviewSentiment';
import { expenseCategoryEmoji } from '@/lib/expenseCategoryLabel';
import { BRAND_GREEN, useTheme } from '@/theme/ThemeContext';

type Props = {
  day: number;
  expenses: Expense[];
  reviewsByExpenseId: Map<string, Review>;
  unreadCommentsByExpenseId: Map<string, number>;
  selected: boolean;
  today: boolean;
  payday: boolean;
  sunday: boolean;
  saturday: boolean;
  compact: boolean;
  minHeight: number;
  onPress: () => void;
};

function formatAmount(amount: number): string {
  if (!Number.isFinite(amount) || amount <= 0) return '기록';
  if (amount < 10_000) return `${Math.max(1, Math.round(amount / 1000))}천`;
  const value = Math.round((amount / 10_000) * 10) / 10;
  return `${Number.isInteger(value) ? value.toFixed(0) : value}만`;
}

export function PhotoCalendarDayCell({
  day,
  expenses,
  reviewsByExpenseId,
  unreadCommentsByExpenseId,
  selected,
  today,
  payday,
  sunday,
  saturday,
  compact,
  minHeight,
  onPress,
}: Props) {
  const { colors, isDark } = useTheme();
  const displayExpense = expenses[0];
  const extraCount = Math.max(0, expenses.length - 1);
  const unreadComments = expenses.reduce(
    (sum, expense) => sum + (unreadCommentsByExpenseId.get(expense.id) ?? 0),
    0,
  );
  const reviewedCount = expenses.filter((expense) => reviewsByExpenseId.has(expense.id)).length;
  const displayReview = displayExpense ? reviewsByExpenseId.get(displayExpense.id) : undefined;
  const status = calendarReviewStatus(displayReview);
  const statusStyle = calendarReviewStatusStyle(status, isDark);
  const reviewed = status !== 'pending';
  const mixed = expenses.length > 1 && reviewedCount > 0 && reviewedCount < expenses.length;
  const hasPhoto = Boolean(displayExpense?.imageUrl);
  const weekdayColor = sunday ? '#C47A7A' : saturday ? '#7A8A94' : colors.text;

  const a11yParts = [`${day}일`];
  if (expenses.length === 1) {
    a11yParts.push('소비 1건', statusStyle.a11yLabel);
  } else if (expenses.length > 1) {
    a11yParts.push(`소비 ${expenses.length}건`);
    if (reviewedCount > 0) a11yParts.push(`평가 ${reviewedCount}건`);
    a11yParts.push(`대표 소비 ${statusStyle.a11yLabel}`);
  }

  return (
    <Pressable
      style={[styles.cell, compact && styles.cellCompact, { minHeight }]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={a11yParts.join(', ')}
    >
      <View style={styles.dateRow}>
        <View
          style={[
            styles.dateCircle,
            selected && { backgroundColor: BRAND_GREEN },
            today && !selected && { borderColor: BRAND_GREEN, borderWidth: 1.5 },
            payday && !selected && !today && { borderColor: '#C47A7A', borderWidth: 1.5 },
          ]}
        >
          <Text
            style={[
              styles.dateText,
              selected && { color: '#FFFFFF' },
              !selected && { color: weekdayColor },
            ]}
          >
            {day}
          </Text>
        </View>
        {mixed || reviewed ? (
          <View style={styles.dateMeta} pointerEvents="none">
            {mixed ? (
              <Text style={[styles.progressText, { color: colors.textMuted }]}>
                {reviewedCount}/{expenses.length}
              </Text>
            ) : (
              <View style={[styles.doneDot, { backgroundColor: statusStyle.accent }]} />
            )}
          </View>
        ) : null}
      </View>

      {displayExpense ? (
        <View
          style={[
            styles.photoFrame,
            compact && styles.photoFrameCompact,
            {
              backgroundColor: statusStyle.bg,
              borderColor: selected ? BRAND_GREEN : statusStyle.border,
            },
            hasPhoto && styles.photoFrameWithPhoto,
          ]}
        >
          {hasPhoto ? (
            <View
              style={[
                styles.photoInner,
                compact && styles.photoInnerCompact,
                { backgroundColor: colors.surfaceMuted },
              ]}
            >
              <CachedExpenseImage
                uri={displayExpense.imageUrl!}
                style={styles.photo}
                accessibilityLabel={(displayExpense.item ?? displayExpense.content ?? '소비') + ' 사진'}
              />
            </View>
          ) : (
            <View style={styles.noPhotoRecord}>
              <Text
                style={[styles.categoryEmoji, compact && styles.categoryEmojiCompact]}
                accessible={false}
              >
                {expenseCategoryEmoji(displayExpense.category) || '•'}
              </Text>
              <Text style={[styles.amount, { color: statusStyle.text }]} numberOfLines={1}>
                {formatAmount(Number(displayExpense.amount) || 0)}
              </Text>
            </View>
          )}

          {reviewed ? (
            <View
              style={[
                styles.checkBadge,
                { backgroundColor: statusStyle.accent, borderColor: statusStyle.badgeRing },
              ]}
            >
              <MaterialIcons name="check" size={11} color="#FFFFFF" />
            </View>
          ) : null}

          {extraCount > 0 ? (
            <View style={styles.moreBadge}>
              <Text style={styles.moreText}>+{extraCount}</Text>
            </View>
          ) : null}

          {unreadComments > 0 ? (
            <View style={[styles.commentBadge, { backgroundColor: BRAND_GREEN }]}>
              <MaterialIcons name="chat-bubble" size={8} color="#FFFFFF" />
              <Text style={styles.commentText}>{unreadComments > 9 ? '9+' : unreadComments}</Text>
            </View>
          ) : null}
        </View>
      ) : (
        <View style={[styles.emptyDaySpace, compact && styles.emptyDaySpaceCompact]} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cell: {
    width: '14.285%',
    paddingHorizontal: 2,
    paddingVertical: 3,
  },
  cellCompact: { paddingHorizontal: 1.5, paddingVertical: 2 },
  dateRow: {
    height: 21,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateCircle: {
    width: 21,
    height: 21,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateText: { fontSize: 11, lineHeight: 14, fontWeight: '800', textAlign: 'center' },
  dateMeta: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  progressText: { fontSize: 8, fontWeight: '800' },
  doneDot: { width: 6, height: 6, borderRadius: 3 },
  photoFrame: {
    flex: 1,
    minHeight: 52,
    marginTop: 3,
    borderRadius: 7,
    borderWidth: 1.5,
    overflow: 'hidden',
    position: 'relative',
  },
  photoFrameCompact: { minHeight: 46, borderRadius: 6 },
  photoFrameWithPhoto: { padding: 2 },
  /** 바깥 radius(7/6) - border(1.5) - padding(2) */
  photoInner: { flex: 1, borderRadius: 4, overflow: 'hidden' },
  photoInnerCompact: { borderRadius: 3 },
  photo: { flex: 1, width: '100%', minHeight: 0 },
  noPhotoRecord: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  amount: { maxWidth: '94%', fontSize: 9, fontWeight: '800', letterSpacing: -0.2 },
  checkBadge: {
    position: 'absolute',
    right: 1.5,
    bottom: 1.5,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryEmoji: {
    fontSize: 15,
    lineHeight: 18,
    textAlign: 'center',
  },
  categoryEmojiCompact: {
    fontSize: 13,
    lineHeight: 16,
  },
  emptyDaySpace: { flex: 1, minHeight: 52, marginTop: 3 },
  emptyDaySpaceCompact: { minHeight: 46 },
  moreBadge: {
    position: 'absolute',
    right: 3,
    top: 3,
    minWidth: 21,
    height: 17,
    paddingHorizontal: 4,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(32,53,43,0.72)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  moreText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
  commentBadge: {
    position: 'absolute',
    left: 1.5,
    bottom: 1.5,
    height: 17,
    paddingHorizontal: 3,
    borderRadius: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.72)',
  },
  commentText: { color: '#FFFFFF', fontSize: 9, fontWeight: '900' },
});
