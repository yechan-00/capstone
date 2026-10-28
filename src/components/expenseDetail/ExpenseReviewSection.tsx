import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { Review, ReviewSchedule } from '@/lib/types';
import { useExpenseDetailPalette } from '@/theme/expenseDetailTheme';
import { regretReasonLabel } from '@/lib/regretReasons';
import { scheduleDueLabel } from '@/lib/scheduleLabels';
import { formatDate } from '@/utils/time';
import {
  formatReviewWaitHint,
  resolveExpenseReviewState,
} from '@/lib/expenseReviewState';
import {
  calendarReviewStatus,
  calendarReviewStatusStyle,
  reviewSatisfactionStars,
  reviewStatusCopy,
  type CalendarReviewStatus,
} from '@/lib/reviewSentiment';

const STATUS_ICON: Record<CalendarReviewStatus, React.ComponentProps<typeof MaterialIcons>['name']> = {
  satisfied: 'sentiment-satisfied',
  neutral: 'sentiment-neutral',
  regretted: 'sentiment-dissatisfied',
  pending: 'schedule',
};

type Props = {
  reviews: Review[];
  schedules: ReviewSchedule[];
  onReviewPress?: (scheduleId: string) => void;
};

export function ExpenseReviewSection({ reviews, schedules, onReviewPress }: Props) {
  const p = useExpenseDetailPalette();
  const state = useMemo(
    () => resolveExpenseReviewState(reviews, schedules),
    [reviews, schedules],
  );

  return (
    <View style={styles.wrap}>
      <Text style={[styles.sectionTitle, { color: p.text }]}>소비 리뷰</Text>

      {state.kind === 'completed' ? (
        reviews.map((review) => {
          const schedule = schedules.find((s) => s.id === review.scheduleId);
          const status = calendarReviewStatus(review);
          const tone = calendarReviewStatusStyle(status, p.isDark);
          const copy = reviewStatusCopy(status);
          const stars = reviewSatisfactionStars(review);
          const meta = `${formatDate(review.reviewedAt, 'yyyy.MM.dd')}${
            schedule ? ` · ${scheduleDueLabel(schedule.type)}` : ''
          }`;

          return (
            <View
              key={review.id}
              style={[styles.resultCard, { backgroundColor: tone.bg, borderColor: tone.border }]}
            >
              <View
                style={styles.completedTop}
                accessible
                accessibilityLabel={`평가 완료, ${meta}`}
              >
                <View style={styles.doneLabel}>
                  <MaterialIcons name="check-circle" size={15} color={tone.accent} />
                  <Text style={[styles.doneText, { color: tone.text }]}>평가 완료</Text>
                </View>
                <Text style={[styles.reviewMeta, { color: p.textMuted }]} numberOfLines={1}>
                  {meta}
                </Text>
              </View>

              <View
                style={styles.statusRow}
                accessible
                accessibilityLabel={`${copy.title}. ${copy.hint}`}
              >
                <View style={[styles.statusIcon, { backgroundColor: tone.accent }]}>
                  <MaterialIcons name={STATUS_ICON[status]} size={20} color="#FFFFFF" />
                </View>
                <View style={styles.statusTextWrap}>
                  <Text style={[styles.statusTitle, { color: tone.text }]}>{copy.title}</Text>
                  <Text style={[styles.statusHint, { color: p.textSec }]}>{copy.hint}</Text>
                </View>
              </View>

              <View style={[styles.resultDivider, { backgroundColor: tone.border }]} />

              <View
                style={styles.satisfactionRow}
                accessible
                accessibilityLabel={
                  stars != null ? `만족도 5점 만점에 ${stars}점` : '만족도 기록 없음'
                }
              >
                <Text style={[styles.satisfactionLabel, { color: p.textSec }]}>만족도</Text>
                {stars != null ? (
                  <View style={styles.starRow}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <MaterialIcons
                        key={n}
                        name="star"
                        size={16}
                        color={n <= stars ? tone.accent : p.border}
                      />
                    ))}
                  </View>
                ) : (
                  <Text style={[styles.satisfactionEmpty, { color: p.textMuted }]}>기록 없음</Text>
                )}
              </View>

              {review.notes?.trim() ? (
                <Text style={[styles.note, { color: p.textSec }]}>{review.notes.trim()}</Text>
              ) : null}
              {review.regretReasons.length > 0 ? (
                <View style={styles.reasonRow}>
                  {review.regretReasons.map((reason) => (
                    <View key={reason} style={[styles.chip, { backgroundColor: p.chipBg }]}>
                      <Text style={[styles.chipText, { color: p.chipText }]}>
                        {regretReasonLabel(reason) ?? reason}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          );
        })
      ) : (
        <View style={[styles.card, { backgroundColor: p.surface, borderColor: p.border }]}>
          {state.kind === 'open' && state.schedule && onReviewPress ? (
            <>
              <View style={[styles.badge, { backgroundColor: p.mintFill }]}>
                <Text style={[styles.badgeText, { color: p.mintText }]}>평가 가능</Text>
              </View>
              <Text style={[styles.emptyTitle, { color: p.text }]}>이 소비를 돌아볼 시간이에요.</Text>
              <Pressable
                onPress={() => onReviewPress(state.schedule!.id)}
                style={({ pressed }) => [
                  styles.reviewBtn,
                  { backgroundColor: p.mintFill, opacity: pressed ? 0.88 : 1 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="지금 평가하기"
              >
                <Text style={[styles.reviewBtnText, { color: p.mintText }]}>지금 평가하기</Text>
              </Pressable>
            </>
          ) : state.kind === 'evaluable' && state.schedule && onReviewPress ? (
            <>
              <View style={[styles.badge, { backgroundColor: p.chipBg }]}>
                <Text style={[styles.badgeText, { color: p.chipText }]}>평가 기간 종료</Text>
              </View>
              <Text style={[styles.emptyTitle, { color: p.text }]}>
                리뷰 탭 기한은 지났지만 평가는 할 수 있어요.
              </Text>
              <Pressable
                onPress={() => onReviewPress(state.schedule!.id)}
                style={({ pressed }) => [
                  styles.reviewBtn,
                  { backgroundColor: p.mintFill, opacity: pressed ? 0.88 : 1 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="지금 평가하기"
              >
                <Text style={[styles.reviewBtnText, { color: p.mintText }]}>지금 평가하기</Text>
              </Pressable>
            </>
          ) : state.kind === 'waiting' && state.schedule ? (
            <>
              <View style={[styles.badge, { backgroundColor: p.chipBg }]}>
                <Text style={[styles.badgeText, { color: p.chipText }]}>평가 대기</Text>
              </View>
              <Text style={[styles.emptyTitle, { color: p.text }]}>
                조금 뒤에 이 소비를 돌아볼 수 있어요.
              </Text>
              <Text style={[styles.waitHint, { color: p.textMuted }]}>
                {formatReviewWaitHint(state.schedule)}
              </Text>
            </>
          ) : (
            <>
              <View style={[styles.badge, { backgroundColor: p.chipBg }]}>
                <Text style={[styles.badgeText, { color: p.chipText }]}>일정 없음</Text>
              </View>
              <Text style={[styles.waitHint, { color: p.textMuted }]}>
                이 기록에는 평가 일정이 없어요.
              </Text>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 28, gap: 12 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
    gap: 10,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
  },
  waitHint: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 19,
  },
  reviewBtn: {
    alignSelf: 'flex-start',
    minHeight: 44,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  reviewBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
  resultCard: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 16,
    gap: 12,
  },
  completedTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  doneLabel: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 0 },
  doneText: { fontSize: 12, fontWeight: '700' },
  reviewMeta: {
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '500',
    textAlign: 'right',
  },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  statusIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTextWrap: { flex: 1, gap: 2 },
  statusTitle: { fontSize: 18, fontWeight: '800', letterSpacing: -0.4, lineHeight: 24 },
  statusHint: { fontSize: 13, fontWeight: '500', lineHeight: 19 },
  resultDivider: { height: StyleSheet.hairlineWidth, opacity: 0.8 },
  satisfactionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  satisfactionLabel: { fontSize: 13, fontWeight: '600' },
  starRow: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  satisfactionEmpty: { fontSize: 13, fontWeight: '500' },
  note: {
    fontSize: 14,
    lineHeight: 21,
    fontWeight: '400',
  },
  reasonRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  chipText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
