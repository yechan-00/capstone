import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeContext';
import { expenseService } from '@/services/expenseService';
import { reviewService } from '@/services/reviewService';
import { scheduleService } from '@/services/scheduleService';
import { Expense, Review, ReviewSchedule } from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';
import { EXPENSE_CATEGORIES } from '@/lib/constants';
import { expenseMoodLabel } from '@/lib/expenseMood';
import { regretReasonLabel } from '@/lib/regretReasons';
import { satisfactionLabel } from '@/lib/satisfactionScale';
import { formatDate } from '@/utils/time';
import { scheduleDueLabel } from '@/lib/scheduleLabels';
import { showAlert } from '@/utils/alert';
import { firstParam } from '@/utils/routerParams';

export default function ExpenseDetailScreen() {
  const rawParams = useLocalSearchParams<{ id: string; scheduleId?: string | string[] }>();
  const id = firstParam(rawParams.id);
  const scheduleId = firstParam(rawParams.scheduleId);
  const router = useRouter();
  const { account } = useAuth();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [expense, setExpense] = useState<Expense | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [schedules, setSchedules] = useState<ReviewSchedule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (scheduleId && id) {
      router.replace({ pathname: '/review', params: { expenseId: id, scheduleId } });
    }
  }, [scheduleId, id, router]);

  useEffect(() => {
    if (!id || !account?.id || scheduleId) return;
    void loadData();
  }, [id, account?.id, scheduleId]);

  const loadData = async () => {
    if (!id || !account?.id) return;

    try {
      setLoading(true);
      const expenseData = await expenseService.getById(id);
      if (!expenseData) {
        showAlert('오류', '소비 내역을 찾을 수 없습니다.');
        router.back();
        return;
      }
      setExpense(expenseData);

      const reviewsData = await reviewService.getByExpenseId(id, account.id);
      setReviews(reviewsData);

      try {
        const schedulesData = await scheduleService.getSchedulesByExpenseId(id, account.id);
        setSchedules(schedulesData);
      } catch (scheduleErr) {
        console.warn('[expense detail] schedules load failed', scheduleErr);
        setSchedules([]);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '데이터를 불러오는데 실패했습니다.';
      showAlert('오류', message);
    } finally {
      setLoading(false);
    }
  };

  if (scheduleId) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (!expense) {
    return null;
  }

  const categoryLabel =
    EXPENSE_CATEGORIES.find((c) => c.value === expense.category)?.label || expense.category;
  const moodLabel = expenseMoodLabel(expense.mood, { withEmoji: true });

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.bg }]}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
        >
          <Text style={[styles.backText, { color: colors.primary }]}>{'<'} 뒤로</Text>
        </TouchableOpacity>

        <View style={[styles.expenseSection, { backgroundColor: colors.surface }]}>
          {expense.imageUrl ? (
            <Image source={{ uri: expense.imageUrl }} style={styles.heroImage} resizeMode="cover" />
          ) : null}
          <Text style={[styles.amount, { color: colors.text }]}>{expense.amount.toLocaleString()}원</Text>
          <Text style={[styles.category, { color: colors.textSec }]}>{categoryLabel}</Text>
          {(expense.item ?? expense.content)?.trim() ? (
            <Text style={[styles.itemLine, { color: colors.text }]}>{(expense.item ?? expense.content)!.trim()}</Text>
          ) : null}
          <Text style={[styles.reason, { color: colors.text }]}>{expense.reason}</Text>
          {[expense.summaryEmoji, expense.summaryLine].filter(Boolean).join(' ').trim() ? (
            <Text style={[styles.summaryLine, { color: colors.textSec }]}>
              {[expense.summaryEmoji, expense.summaryLine].filter(Boolean).join(' ')}
            </Text>
          ) : null}
          <View style={styles.meta}>
            <Text style={[styles.metaText, { color: colors.textMuted }]}>{moodLabel}</Text>
            <Text style={[styles.metaText, { color: colors.textMuted }]}>{formatDate(expense.spentAt)}</Text>
          </View>
          {expense.tags.length > 0 && (
            <View style={styles.tags}>
              {expense.tags.map((tag, idx) => (
                <Text key={idx} style={[styles.tag, { color: colors.textSec }]}>
                  #{tag}
                </Text>
              ))}
            </View>
          )}
        </View>

        <View style={styles.reviewsSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>리뷰 내역</Text>
          {reviews.length === 0 ? (
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>아직 리뷰가 없습니다</Text>
          ) : (
            reviews.map((review) => {
              const schedule = schedules.find((s) => s.id === review.scheduleId);
              return (
                <View key={review.id} style={[styles.reviewCard, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.reviewDate, { color: colors.textMuted }]}>
                    {formatDate(review.reviewedAt)}
                    {schedule && ` (${scheduleDueLabel(schedule.type)})`}
                  </Text>
                  <Text style={[styles.reviewSatisfaction, { color: colors.text }]}>
                    만족도: {satisfactionLabel(review.satisfaction) || `${review.satisfaction}/5`}
                  </Text>
                  {review.regretReasons.length > 0 && (
                    <View style={styles.reviewReasons}>
                      {review.regretReasons.map((reason, idx) => (
                        <Text key={idx} style={[styles.reviewReason, { color: colors.textSec }]}>
                          • {regretReasonLabel(reason) ?? reason}
                        </Text>
                      ))}
                    </View>
                  )}
                  {review.notes && (
                    <Text style={[styles.reviewNotes, { color: colors.textSec }]}>{review.notes}</Text>
                  )}
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  scrollView: { flex: 1 },
  content: { padding: 16 },
  backButton: { marginBottom: 8 },
  backText: { fontSize: 16, fontWeight: '600' },
  heroImage: { width: '100%', height: 200, borderRadius: 8, marginBottom: 12 },
  expenseSection: { padding: 16, borderRadius: 8, marginBottom: 24 },
  itemLine: { fontSize: 17, fontWeight: '700', marginBottom: 8 },
  summaryLine: { fontSize: 15, marginBottom: 10, fontWeight: '600' },
  amount: { fontSize: 32, fontWeight: 'bold', marginBottom: 8 },
  category: { fontSize: 16, marginBottom: 12 },
  reason: { fontSize: 18, marginBottom: 12 },
  meta: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  metaText: { fontSize: 14 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  tag: { fontSize: 14 },
  reviewsSection: { marginBottom: 24 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  emptyText: { fontSize: 16, textAlign: 'center', padding: 20 },
  reviewCard: { padding: 16, borderRadius: 8, marginBottom: 12 },
  reviewDate: { fontSize: 14, marginBottom: 8 },
  reviewSatisfaction: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  reviewReasons: { marginTop: 8 },
  reviewReason: { fontSize: 14, marginBottom: 4 },
  reviewNotes: { fontSize: 14, marginTop: 8, fontStyle: 'italic' },
});
