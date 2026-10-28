import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { FirebaseError } from 'firebase/app';
import { firstParam } from '@/utils/routerParams';
import { PrimaryButton } from '@/components/PrimaryButton';
import { PhotoViewerModal } from '@/components/PhotoViewerModal';
import { ReviewContainPhoto } from '@/components/ReviewContainPhoto';
import { SatisfactionLevelPicker } from '@/components/SatisfactionLevelPicker';
import { SuccessOverlay, type SuccessTone } from '@/components/SuccessOverlay';
import { formatSpentShort } from '@/components/reviews/ReviewListCards';
import { expenseCategoryLabel } from '@/lib/expenseCategoryLabel';
import { expenseCardTitle } from '@/lib/expenseDisplay';
import { regretReasonsForReviewUi } from '@/lib/regretReasons';
import { decisionAgainFromSatisfaction, needsRegretReasonsFlow } from '@/lib/reviewSatisfaction';
import { expenseService } from '@/services/expenseService';
import { reviewService } from '@/services/reviewService';
import { scheduleService } from '@/services/scheduleService';
import { useAuth } from '@/hooks/useAuth';
import type { Expense, RegretReason } from '@/lib/types';
import { isDisplayableImageUrl } from '@/utils/expenseImage';
import { useTheme } from '@/theme/ThemeContext';

export default function ReviewScreen() {
  const router = useRouter();
  const { user, account } = useAuth();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const rawParams = useLocalSearchParams<{
    expenseId?: string | string[];
    scheduleId?: string | string[];
  }>();
  const expenseId = firstParam(rawParams.expenseId);
  const scheduleId = firstParam(rawParams.scheduleId);

  const { primary: primaryRegretReasons } = useMemo(() => regretReasonsForReviewUi(), []);

  const [rating, setRating] = useState<number>(0);
  const [reasons, setReasons] = useState<RegretReason[]>([]);
  const [otherReason, setOtherReason] = useState('');
  const [memo, setMemo] = useState('');
  const [memoFocused, setMemoFocused] = useState(false);
  const [otherFocused, setOtherFocused] = useState(false);
  const [saving, setSaving] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [expense, setExpense] = useState<Expense | null>(null);
  const [previewState, setPreviewState] = useState<'loading' | 'ready' | 'error' | 'invalid'>('loading');
  const [previewRetry, setPreviewRetry] = useState(0);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [success, setSuccess] = useState<
    null | { tone: SuccessTone; title: string; subtitle?: string; mode: 'auto' | 'tap' }
  >(null);

  const canSubmit = rating >= 1 && previewState === 'ready';
  const showReasons = useMemo(() => needsRegretReasonsFlow(rating), [rating]);
  const mintFill = colors.choiceActiveBg;
  const mintText = colors.choiceTextActive;
  const mintBorder = colors.choiceActiveBorder;

  useEffect(() => {
    let cancelled = false;
    const loadPreview = async () => {
      if (!account) {
        setPreviewState('loading');
        setExpense(null);
        return;
      }
      if (!expenseId || !scheduleId) {
        setPreviewState('invalid');
        setExpense(null);
        return;
      }
      setPreviewState('loading');
      try {
        const [loaded, schedules] = await Promise.all([
          expenseService.getById(expenseId),
          scheduleService.getSchedulesByExpenseId(expenseId, account.id),
        ]);
        if (cancelled) return;
        const matched = schedules.some((s) => s.id === scheduleId);
        if (!loaded || loaded.accountId !== account.id || !matched) {
          setExpense(null);
          setPreviewState('invalid');
          return;
        }
        setExpense(loaded);
        setPreviewState('ready');
      } catch (err) {
        if (cancelled) return;
        console.error('[review] expense preview failed', err);
        setExpense(null);
        setPreviewState('error');
      }
    };
    void loadPreview();
    return () => {
      cancelled = true;
    };
  }, [expenseId, scheduleId, account?.id, previewRetry]);

  const goHome = () => {
    (globalThis as { __reloadPendingReviewCount?: () => void }).__reloadPendingReviewCount?.();
    (globalThis as { __reloadHomeExpenses?: () => void }).__reloadHomeExpenses?.();
    router.replace('/(tabs)');
  };

  const onToggleReason = (r: RegretReason) => {
    setReasons((prev) => {
      const next = prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r];
      if (r === 'other' && !next.includes('other')) {
        setOtherReason('');
      }
      return next;
    });
  };

  const onMemoKeyPress = (e: any) => {
    if (Platform.OS !== 'web') return;
    if (e?.nativeEvent?.key !== 'Enter') return;

    const hasShift = Boolean(e?.nativeEvent?.shiftKey);
    if (hasShift) return;

    e?.preventDefault?.();
    if (canSubmit && !saving) {
      void onSubmit();
    }
  };

  const onSubmit = async () => {
    if (saving) return;
    if (rating < 1) {
      Alert.alert('입력 확인', '만족도를 선택해 주세요.');
      return;
    }
    if (previewState !== 'ready' || !expenseId || !scheduleId || !user || !account || !expense) {
      Alert.alert('오류', '소비 정보를 확인할 수 없어 리뷰를 저장하지 않았어요.');
      return;
    }

    try {
      setSaving(true);
      Keyboard.dismiss();

      await reviewService.create({
        expenseId,
        scheduleId,
        accountId: account.id,
        userId: user.uid,
        reviewerUserId: user.uid,
        reviewType: 'self',
        decisionAgain: decisionAgainFromSatisfaction(rating),
        satisfaction: rating,
        regretReasons: showReasons ? reasons : [],
        otherReason:
          showReasons && reasons.includes('other') && otherReason.trim()
            ? otherReason.trim()
            : undefined,
        notes: memo.trim() || undefined,
        reviewedAt: new Date(),
      });

      if (rating <= 2) {
        const tips = [
          '다음엔 주문 전에 "지금 배고픔 점수(1~5)"를 먼저 체크해 보세요.',
          '가격이 아쉬웠다면, 다음엔 같은 메뉴를 2개 앱에서 10초만 비교해 보세요.',
          '맛/양이 아쉬웠다면, 다음엔 소용량 또는 검증된 메뉴로 실험 폭을 줄여 보세요.',
        ];
        const tip = tips[Math.floor(Math.random() * tips.length)];
        setSuccess({
          tone: 'regret',
          title: '오늘의 소비를 돌아봤어요.',
          subtitle: tip,
          mode: 'tap',
        });
        return;
      }
      setSuccess({
        tone: 'positive',
        title: '오늘의 소비를 돌아봤어요.',
        subtitle: '작은 기록이 쌓여 나의 소비 패턴이 됩니다.',
        mode: 'auto',
      });
    } catch (e) {
      console.error('[review] submit failed', e);
      Alert.alert('저장 실패', '리뷰를 저장하지 못했어요. 네트워크를 확인해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  const onSkip = () => {
    if (!scheduleId || previewState === 'invalid') {
      Alert.alert('오류', '스케줄 정보를 찾을 수 없습니다.');
      return;
    }
    Alert.alert('리뷰 스킵', '이번 리뷰를 건너뛸까요?', [
      { text: '취소', style: 'cancel' },
      {
        text: '스킵',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            try {
              setSkipping(true);
              await scheduleService.markAsSkipped(scheduleId);
              goHome();
            } catch (e) {
              console.error('[review] skip failed', e);
              const code = e instanceof FirebaseError ? e.code : '';
              const hint =
                code === 'permission-denied'
                  ? '권한이 없거나 로그인이 만료됐을 수 있어요.'
                  : '네트워크를 확인해 주세요.';
              Alert.alert('실패', `스킵 처리에 실패했어요.\n${hint}`);
            } finally {
              setSkipping(false);
            }
          })();
        },
      },
    ]);
  };

  const previewTitle = expenseCardTitle(expense);
  const previewAmount = expense?.amount != null ? `${Number(expense.amount).toLocaleString()}원` : '';
  const previewMeta = expense
    ? `${expenseCategoryLabel(expense.category)} · ${formatSpentShort(expense.spentAt)}`
    : '';
  const previewPhoto = isDisplayableImageUrl(expense?.imageUrl) ? expense!.imageUrl! : null;

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top, backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={styles.nav}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
          style={({ pressed }) => [styles.navIconBtn, { opacity: pressed ? 0.65 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="뒤로가기"
        >
          <MaterialIcons name="arrow-back" size={22} color={colors.text} />
        </Pressable>
        <View style={styles.navCenter}>
          <Text style={[styles.navTitle, { color: colors.text }]}>소비 돌아보기</Text>
          <Text style={[styles.navSub, { color: colors.textMuted }]}>그때의 선택은 어땠나요?</Text>
        </View>
        <Pressable
          onPress={onSkip}
          disabled={skipping || previewState === 'invalid'}
          style={styles.navSkipWrap}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="건너뛰기"
        >
          <Text
            style={[
              styles.navSkip,
              { color: colors.textMuted },
              (skipping || previewState === 'invalid') && styles.skipDisabled,
            ]}
          >
            건너뛰기
          </Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.container}
        contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.previewBlock}>
          {previewState === 'loading' ? (
            <View style={styles.previewLoading}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.previewHint, { color: colors.textMuted }]}>소비 정보를 불러오는 중</Text>
            </View>
          ) : previewState === 'error' ? (
            <View style={styles.previewErrorWrap}>
              <Text style={[styles.previewError, { color: colors.errorText }]}>
                소비 정보를 불러오지 못했어요.
              </Text>
              <Pressable onPress={() => setPreviewRetry((n) => n + 1)} hitSlop={8}>
                <Text style={[styles.retry, { color: colors.primary }]}>다시 시도</Text>
              </Pressable>
            </View>
          ) : previewState === 'invalid' ? (
            <View style={styles.previewErrorWrap}>
              <Text style={[styles.previewError, { color: colors.errorText }]}>
                이 소비를 찾을 수 없어 리뷰를 저장할 수 없어요.
              </Text>
              <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))} hitSlop={8}>
                <Text style={[styles.retry, { color: colors.primary }]}>돌아가기</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.previewTitleRow}>
                <Text style={[styles.previewTitle, { color: colors.text }]} numberOfLines={2}>
                  {previewTitle}
                </Text>
                {previewAmount ? (
                  <Text style={[styles.previewAmount, { color: colors.text }]}>{previewAmount}</Text>
                ) : null}
              </View>
              <Text style={[styles.previewMeta, { color: colors.textMuted }]}>{previewMeta}</Text>
              {previewPhoto ? (
                <View style={styles.previewPhoto}>
                  <ReviewContainPhoto
                    uri={previewPhoto}
                    accessibilityLabel="소비 사진 크게 보기"
                    onPress={() => setPhotoOpen(true)}
                    photoBg={colors.surfaceMuted}
                    muted={colors.textMuted}
                    maxHeight={160}
                    centerInParent
                  />
                </View>
              ) : null}
            </>
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.blockTitle, { color: colors.text }]}>이번 소비는 어땠나요?</Text>
          <Text style={[styles.blockDesc, { color: colors.textSec }]}>가장 가까운 마음을 선택해 주세요.</Text>
          <View style={{ height: 14 }} />
          <SatisfactionLevelPicker value={rating} onChange={setRating} />
        </View>

        {showReasons ? (
          <View style={styles.section}>
            <Text style={[styles.blockTitle, { color: colors.text }]}>아쉬웠던 점이 있나요?</Text>
            <Text style={[styles.blockDesc, { color: colors.textSec }]}>해당하는 이유를 모두 고를 수 있어요.</Text>
            <View style={styles.chipWrap}>
              {primaryRegretReasons.map((r) => {
                const active = reasons.includes(r.key);
                return (
                  <Pressable
                    key={r.key}
                    onPress={() => onToggleReason(r.key)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? mintFill : colors.surface,
                        borderColor: active ? mintBorder : colors.border,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.chipText, { color: active ? mintText : colors.text }]}>{r.label}</Text>
                  </Pressable>
                );
              })}
            </View>
            {reasons.includes('other') ? (
              <TextInput
                value={otherReason}
                onChangeText={setOtherReason}
                placeholder="기타 이유를 짧게"
                placeholderTextColor={colors.placeholder}
                onFocus={() => setOtherFocused(true)}
                onBlur={() => setOtherFocused(false)}
                style={[
                  styles.textIn,
                  {
                    borderColor: otherFocused ? colors.primary : colors.borderInput,
                    backgroundColor: colors.inputBg,
                    color: colors.text,
                  },
                ]}
                maxLength={100}
              />
            ) : null}
          </View>
        ) : null}

        <View style={styles.section}>
          <View style={styles.memoHeader}>
            <Text style={[styles.blockTitle, { color: colors.text }]}>기억하고 싶은 점이 있나요?</Text>
            <Text style={[styles.optional, { color: colors.textMuted }]}>선택</Text>
          </View>
          <Text style={[styles.blockDesc, { color: colors.textSec, marginBottom: 10 }]}>
            그때의 생각을 짧게 남겨보세요.
          </Text>
          <TextInput
            value={memo}
            onChangeText={setMemo}
            placeholder="이번 소비에 대해 남기고 싶은 말을 적어주세요."
            placeholderTextColor={colors.placeholder}
            style={[
              styles.memo,
              {
                borderColor: memoFocused ? colors.primary : colors.borderInput,
                backgroundColor: colors.inputBg,
                color: colors.text,
              },
            ]}
            multiline
            onFocus={() => setMemoFocused(true)}
            onBlur={() => setMemoFocused(false)}
            onKeyPress={onMemoKeyPress}
          />
          {Platform.OS === 'web' ? (
            <Text style={[styles.webHint, { color: colors.textMuted }]}>
              Enter로 저장 · Shift+Enter로 줄바꿈
            </Text>
          ) : null}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          {
            borderTopColor: colors.border,
            backgroundColor: colors.bg,
            paddingBottom: Math.max(insets.bottom, 12),
          },
        ]}
      >
        <PrimaryButton
          label={saving ? '저장 중...' : '리뷰 저장하기'}
          onPress={onSubmit}
          disabled={!canSubmit || saving}
          style={{ flex: 1, height: 52, borderRadius: 14 }}
        />
      </View>

      <SuccessOverlay
        visible={success !== null}
        tone={success?.tone}
        title={success?.title ?? ''}
        subtitle={success?.subtitle}
        mode={success?.mode}
        onDone={() => {
          setSuccess(null);
          goHome();
        }}
      />

      <PhotoViewerModal
        visible={photoOpen && previewPhoto != null}
        uri={previewPhoto}
        accessibilityLabel="소비 사진"
        onClose={() => setPhotoOpen(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 22 },

  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 8,
    minHeight: 52,
  },
  navIconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  navCenter: { flex: 1, alignItems: 'center' },
  navTitle: { fontSize: 16, fontWeight: '800' },
  navSub: { marginTop: 2, fontSize: 12, fontWeight: '600' },
  navSkipWrap: { minWidth: 64, alignItems: 'flex-end', paddingRight: 8 },
  navSkip: { fontSize: 13, fontWeight: '600' },
  skipDisabled: { opacity: 0.45 },

  previewBlock: {
    paddingTop: 4,
  },
  previewLoading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 44,
  },
  previewHint: { fontSize: 13, fontWeight: '600' },
  previewErrorWrap: { gap: 8 },
  previewError: { fontSize: 14, fontWeight: '600', lineHeight: 21 },
  retry: { fontSize: 14, fontWeight: '800' },
  previewTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  previewTitle: { flex: 1, minWidth: 0, fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
  previewAmount: { flexShrink: 0, fontSize: 16, fontWeight: '700', lineHeight: 26, textAlign: 'right' },
  previewMeta: { marginTop: 6, fontSize: 13, fontWeight: '600' },
  previewPhoto: {
    marginTop: 12,
    width: '100%',
    alignItems: 'center',
  },

  section: { gap: 0 },
  blockTitle: { fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  blockDesc: { marginTop: 6, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  memoHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },
  optional: { fontSize: 12, fontWeight: '700' },

  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 14,
  },
  chip: {
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipText: { fontSize: 13, fontWeight: '700' },

  textIn: {
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '600',
  },
  memo: {
    minHeight: 108,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontWeight: '600',
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  webHint: { marginTop: 8, fontSize: 11, fontWeight: '600' },

  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
