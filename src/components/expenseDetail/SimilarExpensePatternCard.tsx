import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import type { Expense, Review } from '@/lib/types';
import type { SimilarExpensePattern } from '@/lib/similarExpensePattern';
import { expenseCardTitle } from '@/lib/expenseDisplay';
import {
  calendarReviewStatus,
  calendarReviewStatusStyle,
  type CalendarReviewStatus,
} from '@/lib/reviewSentiment';
import { useExpenseDetailPalette } from '@/theme/expenseDetailTheme';

const INITIAL_LIST_COUNT = 5;

const STATUS_BADGE_LABEL: Record<CalendarReviewStatus, string> = {
  satisfied: '만족',
  neutral: '보통',
  regretted: '후회',
  pending: '평가 전',
};

type Props = {
  pattern: SimilarExpensePattern | null;
  currentExpenseId?: string;
  reviewsByExpenseId?: Map<string, Review>;
  reviewsReady?: boolean;
};

function formatListDate(date: Date): string {
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function formatWon(amount: number): string {
  return `${Math.round(amount).toLocaleString()}원`;
}

function formatAmountDiff(current: number, average: number): string {
  const diff = Math.round(current) - Math.round(average);
  const abs = Math.abs(diff).toLocaleString();
  if (diff === 0) return '평균과 같은 금액을 썼어요';
  if (diff < 0) return `평균보다 ${abs}원 적게 썼어요`;
  return `평균보다 ${abs}원 더 썼어요`;
}

export function SimilarExpensePatternCard({
  pattern,
  currentExpenseId,
  reviewsByExpenseId,
  reviewsReady = false,
}: Props) {
  const p = useExpenseDetailPalette();
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    setExpanded(false);
    setShowAll(false);
  }, [currentExpenseId, pattern?.count]);

  if (!pattern) {
    return (
      <View style={styles.wrap}>
        <Text style={[styles.sectionTitle, { color: p.text }]}>비슷한 소비</Text>
        <View style={[styles.emptyBox, { backgroundColor: p.mintSoft, borderColor: p.border }]}>
          <MaterialIcons name="insights" size={18} color={p.textMuted} />
          <Text style={[styles.emptyText, { color: p.textMuted }]}>
            아직 비교할 비슷한 소비가 없어요.
          </Text>
        </View>
      </View>
    );
  }

  const currentLabel = formatWon(pattern.currentAmount);
  const averageLabel = formatWon(pattern.averageAmount);
  const diffLabel = formatAmountDiff(pattern.currentAmount, pattern.averageAmount);
  const a11yLabel = [
    '최근 30일',
    `비슷한 소비 ${pattern.count}건`,
    pattern.label,
    `이번 소비 ${currentLabel}`,
    `평균 소비 ${averageLabel}`,
    diffLabel,
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <View style={styles.wrap}>
      <Text style={[styles.sectionTitle, { color: p.text }]}>비슷한 소비</Text>
      <View
        style={[styles.card, { backgroundColor: p.surface, borderColor: p.border }]}
        accessibilityLabel={a11yLabel}
      >
        <View style={styles.topRow}>
          <Text style={[styles.period, { color: p.textMuted }]}>최근 30일</Text>
          <View style={[styles.countBadge, { backgroundColor: p.mintFill }]}>
            <Text style={[styles.countText, { color: p.mintText }]}>총 {pattern.count}건</Text>
          </View>
        </View>
        {pattern.label ? (
          <Text style={[styles.criteria, { color: p.text }]}>{pattern.label}</Text>
        ) : null}

        <View style={styles.compareRow}>
          <View style={[styles.compareCell, { backgroundColor: p.mintFill }]}>
            <Text style={[styles.compareKey, { color: p.mintText }]}>이번 소비</Text>
            <Text
              style={[styles.compareValue, { color: p.text }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.72}
            >
              {currentLabel}
            </Text>
          </View>
          <View style={[styles.compareCell, { backgroundColor: p.chipBg }]}>
            <Text style={[styles.compareKey, { color: p.textMuted }]}>평균 소비</Text>
            <Text
              style={[styles.compareValue, { color: p.text }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.72}
            >
              {averageLabel}
            </Text>
          </View>
        </View>

        <Text style={[styles.diff, { color: p.text }]}>{diffLabel}</Text>

        {pattern.items.length > 0 ? (
          <>
            <View style={[styles.expandDivider, { backgroundColor: p.divider }]} />
            <Pressable
              onPress={() => {
                setExpanded((prev) => {
                  if (prev) setShowAll(false);
                  return !prev;
                });
              }}
              style={({ pressed }) => [styles.expandBtn, { opacity: pressed ? 0.72 : 1 }]}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              accessibilityLabel={expanded ? '기록 접기' : '비슷한 소비 기록 보기'}
            >
              <Text style={[styles.expandBtnText, { color: p.mintText }]}>
                {expanded ? '기록 접기' : '비슷한 소비 기록 보기'}
              </Text>
              <MaterialIcons
                name={expanded ? 'expand-less' : 'expand-more'}
                size={20}
                color={p.mintText}
              />
            </Pressable>
          </>
        ) : null}

        {expanded ? (
          <View>
            {(showAll ? pattern.items : pattern.items.slice(0, INITIAL_LIST_COUNT)).map((item, index, visible) => (
              <SimilarExpenseRow
                key={item.id}
                item={item}
                isCurrent={item.id === currentExpenseId}
                showDivider={index < visible.length - 1}
                review={reviewsByExpenseId?.get(item.id)}
                reviewsReady={reviewsReady}
                onPress={() => {
                  if (item.id === currentExpenseId) return;
                  router.push(`/expense/${item.id}`);
                }}
              />
            ))}
            {!showAll && pattern.items.length > INITIAL_LIST_COUNT ? (
              <Pressable
                onPress={() => setShowAll(true)}
                style={({ pressed }) => [styles.moreBtn, { opacity: pressed ? 0.72 : 1 }]}
                accessibilityRole="button"
                accessibilityLabel={`나머지 ${pattern.items.length - INITIAL_LIST_COUNT}건 더 보기`}
              >
                <Text style={[styles.moreBtnText, { color: p.mintText }]}>
                  나머지 {pattern.items.length - INITIAL_LIST_COUNT}건 더 보기
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function SimilarExpenseRow({
  item,
  isCurrent,
  showDivider,
  review,
  reviewsReady,
  onPress,
}: {
  item: Expense;
  isCurrent: boolean;
  showDivider: boolean;
  review: Review | undefined;
  reviewsReady: boolean;
  onPress: () => void;
}) {
  const p = useExpenseDetailPalette();
  const title = expenseCardTitle(item);
  const dateLabel = formatListDate(item.spentAt);
  const amountLabel = formatWon(item.amount);
  const status = reviewsReady ? calendarReviewStatus(review) : null;
  const tone = status ? calendarReviewStatusStyle(status, p.isDark) : null;
  const statusLabel = status ? STATUS_BADGE_LABEL[status] : '확인 중';

  return (
    <Pressable
      onPress={onPress}
      disabled={isCurrent}
      style={({ pressed }) => [
        styles.row,
        { borderBottomWidth: showDivider ? StyleSheet.hairlineWidth : 0, borderBottomColor: p.divider },
        pressed && !isCurrent ? { opacity: 0.72 } : null,
      ]}
      accessibilityRole={isCurrent ? 'text' : 'button'}
      accessibilityLabel={`${title}, ${dateLabel}, ${amountLabel}, ${statusLabel}`}
    >
      <View style={styles.rowLeft}>
        <Text style={[styles.rowTitle, { color: p.text }]} numberOfLines={2}>
          {title}
        </Text>
        <Text style={[styles.rowDate, { color: p.textMuted }]}>{dateLabel}</Text>
      </View>
      <View style={styles.rowRight}>
        <Text
          style={[styles.rowAmount, { color: p.text }]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.8}
        >
          {amountLabel}
        </Text>
        {tone ? (
          <View style={[styles.statusBadge, { backgroundColor: tone.bg }]}>
            <Text style={[styles.statusBadgeText, { color: tone.text }]}>{statusLabel}</Text>
          </View>
        ) : (
          <Text style={[styles.statusPending, { color: p.textMuted }]}>{statusLabel}</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 28, gap: 10 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 14,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  period: {
    fontSize: 12,
    fontWeight: '600',
  },
  countBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  countText: {
    fontSize: 11,
    fontWeight: '700',
  },
  criteria: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
    lineHeight: 21,
    marginTop: -6,
  },
  compareRow: {
    flexDirection: 'row',
    gap: 8,
  },
  compareCell: {
    flex: 1,
    minWidth: 0,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  compareKey: {
    fontSize: 12,
    fontWeight: '600',
  },
  compareValue: {
    width: '100%',
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  diff: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
  expandDivider: {
    height: StyleSheet.hairlineWidth,
    marginHorizontal: -16,
  },
  expandBtn: {
    minHeight: 44,
    marginHorizontal: -4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  expandBtnText: {
    fontSize: 14,
    fontWeight: '600',
  },
  row: {
    minHeight: 56,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowLeft: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  rowDate: {
    fontSize: 12,
    fontWeight: '500',
  },
  rowRight: {
    alignItems: 'flex-end',
    gap: 4,
    flexShrink: 0,
    maxWidth: '46%',
  },
  rowAmount: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  statusBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  statusPending: {
    fontSize: 11,
    fontWeight: '600',
  },
  moreBtn: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moreBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  emptyBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  emptyText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '500',
  },
});
