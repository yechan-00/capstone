import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeContext';
import { expenseService } from '@/services/expenseService';
import { reviewService } from '@/services/reviewService';
import { scheduleService } from '@/services/scheduleService';
import { Expense, Review, ReviewSchedule, RegretReason } from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';
import { SatisfactionLevelPicker } from '@/components/SatisfactionLevelPicker';
import { EXPENSE_CATEGORIES, EXPENSE_MOODS, REGRET_REASONS } from '@/lib/constants';
import { regretReasonLabel } from '@/lib/regretReasons';
import { satisfactionLabel } from '@/lib/satisfactionScale';
import { decisionAgainFromSatisfaction, needsRegretReasonsFlow } from '@/lib/reviewSatisfaction';
import { formatDate } from '@/utils/time';
import { scheduleDueLabel } from '@/lib/scheduleLabels';

export default function ExpenseDetailScreen() {
  const { id, scheduleId } = useLocalSearchParams<{ id: string; scheduleId?: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const [expense, setExpense] = useState<Expense | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [schedules, setSchedules] = useState<ReviewSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewMode, setReviewMode] = useState(false);

  // Review form state
  const [satisfaction, setSatisfaction] = useState<number | null>(null);
  const [regretReasons, setRegretReasons] = useState<RegretReason[]>([]);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const expenseData = await expenseService.getById(id);
      if (!expenseData) {
        Alert.alert('오류', '소비 내역을 찾을 수 없습니다.');
        router.back();
        return;
      }
      setExpense(expenseData);

      const reviewsData = await reviewService.getByExpenseId(id, `account_${user!.uid}`);
      setReviews(reviewsData);

      const schedulesData = await scheduleService.getSchedulesByExpenseId(id, `account_${user!.uid}`);
      setSchedules(schedulesData);

      // scheduleId가 있으면 리뷰 모드로 시작
      if (scheduleId) {
        setReviewMode(true);
      }
    } catch (error: any) {
      Alert.alert('오류', error.message || '데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const toggleRegretReason = (reason: RegretReason) => {
    setRegretReasons((prev) =>
      prev.includes(reason) ? prev.filter((r) => r !== reason) : [...prev, reason]
    );
  };

  const handleSubmitReview = async () => {
    if (!expense || !user || !scheduleId) {
      Alert.alert('오류', '필수 정보가 없습니다.');
      return;
    }

    if (satisfaction === null) {
      Alert.alert('오류', '만족도를 선택해 주세요.');
      return;
    }

    try {
      setSubmitting(true);
      await reviewService.create({
        expenseId: expense.id,
        scheduleId,
        accountId: expense.accountId,
        reviewerUserId: user.uid,
        reviewType: 'self',
        decisionAgain: decisionAgainFromSatisfaction(satisfaction),
        satisfaction,
        regretReasons: needsRegretReasonsFlow(satisfaction) ? regretReasons : [],
        notes: notes.trim() || undefined,
        reviewedAt: new Date(),
      });

      Alert.alert('성공', '리뷰가 저장되었습니다.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (error: any) {
      Alert.alert('오류', error.message || '리뷰 저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  if (!expense) {
    return null;
  }

  const categoryLabel =
    EXPENSE_CATEGORIES.find((c) => c.value === expense.category)?.label || expense.category;
  const moodLabel = EXPENSE_MOODS.find((m) => m.value === expense.mood)?.label || expense.mood;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top, backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView style={[styles.scrollView, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
        >
          <Text style={[styles.backText, { color: colors.primary }]}>{'<'} 뒤로</Text>
        </TouchableOpacity>
        {!reviewMode ? (
          <>
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

            {scheduleId && (
              <TouchableOpacity
                style={[styles.reviewButton, { backgroundColor: colors.primary }]}
                onPress={() => setReviewMode(true)}
              >
                <Text style={[styles.reviewButtonText, { color: colors.onPrimary }]}>리뷰 작성하기</Text>
              </TouchableOpacity>
            )}
          </>
        ) : (
          <View style={styles.reviewForm}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>리뷰 작성</Text>

            <Text style={[styles.label, { color: colors.text }]}>만족도 *</Text>
            <SatisfactionLevelPicker
              value={satisfaction ?? 0}
              onChange={(stars) => setSatisfaction(stars)}
              isDark={isDark}
            />

            {satisfaction != null && needsRegretReasonsFlow(satisfaction) ? (
              <>
                <Text style={[styles.label, { color: colors.text }]}>아쉬웠던 점 (복수 선택 가능)</Text>
                <View style={styles.options}>
                  {REGRET_REASONS.map((reason) => (
                    <TouchableOpacity
                      key={reason.key}
                      style={[
                        styles.option,
                        { backgroundColor: colors.surface, borderColor: colors.border },
                        regretReasons.includes(reason.key) && { backgroundColor: colors.primary, borderColor: colors.primary },
                      ]}
                      onPress={() => toggleRegretReason(reason.key)}
                    >
                      <Text style={[styles.optionText, { color: colors.text }, regretReasons.includes(reason.key) && { color: colors.onPrimary, fontWeight: 'bold' }]}>
                        {reason.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </>
            ) : null}

            <Text style={[styles.label, { color: colors.text }]}>메모</Text>
            <TextInput
              style={[styles.input, styles.textArea, { backgroundColor: colors.inputBg, borderColor: colors.borderInput, color: colors.text }]}
              placeholder="추가 메모를 입력하세요"
              placeholderTextColor={colors.placeholder}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={4}
            />

            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.cancelButton, { borderColor: colors.border }]}
                onPress={() => setReviewMode(false)}
              >
                <Text style={[styles.cancelButtonText, { color: colors.textSec }]}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitButton, { backgroundColor: colors.primary }, submitting && styles.submitButtonDisabled]}
                onPress={handleSubmitReview}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.onPrimary} />
                ) : (
                  <Text style={[styles.submitButtonText, { color: colors.onPrimary }]}>저장</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
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
  meta: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
  metaText: { fontSize: 14 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 8 },
  tag: { fontSize: 12, marginRight: 8 },
  reviewsSection: { marginBottom: 24 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  emptyText: { fontSize: 14, textAlign: 'center', padding: 32 },
  reviewCard: { padding: 16, borderRadius: 8, marginBottom: 12 },
  reviewDate: { fontSize: 12, marginBottom: 8 },
  reviewSatisfaction: { fontSize: 14, marginBottom: 8 },
  reviewReasons: { marginTop: 8 },
  reviewReason: { fontSize: 14, marginBottom: 4 },
  reviewNotes: { fontSize: 14, marginTop: 8, fontStyle: 'italic' },
  reviewButton: { borderRadius: 8, padding: 16, alignItems: 'center' },
  reviewButtonText: { fontSize: 16, fontWeight: 'bold' },
  reviewForm: { marginTop: 16 },
  label: { fontSize: 16, fontWeight: '500', marginBottom: 8, marginTop: 16 },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 8, marginRight: 8, marginBottom: 8 },
  optionSelected: {},
  optionText: { fontSize: 14 },
  optionTextSelected: { fontWeight: 'bold' },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 16 },
  textArea: { height: 100, textAlignVertical: 'top' },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 24 },
  cancelButton: { flex: 1, borderWidth: 1, borderRadius: 8, padding: 16, alignItems: 'center' },
  cancelButtonText: { fontSize: 16, fontWeight: 'bold' },
  submitButton: { flex: 1, borderRadius: 8, padding: 16, alignItems: 'center' },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { fontSize: 16, fontWeight: 'bold' },
});
