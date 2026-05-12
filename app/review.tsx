import React, { useMemo, useState } from 'react';
import {
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
import { FirebaseError } from 'firebase/app';
import { firstParam } from '@/utils/routerParams';
import { AppCard } from '@/components/AppCard';
import { Chip } from '@/components/Chip';
import { PrimaryButton } from '@/components/PrimaryButton';
import { StarRating } from '@/components/StarRating';
import { REGRET_REASONS, REVIEW_DECISIONS } from '@/lib/reviewOptions';
import { reviewService } from '@/services/reviewService';
import { scheduleService } from '@/services/scheduleService';
import { useAuth } from '@/hooks/useAuth';
import { DecisionAgain, RegretReason } from '@/lib/types';
import { useTheme } from '@/theme/ThemeContext';

type Step = 1 | 2 | 3;

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

  const [step, setStep] = useState<Step>(1);
  const [decision, setDecision] = useState<DecisionAgain | null>(null);
  const [rating, setRating] = useState<number>(0);
  const [reasons, setReasons] = useState<RegretReason[]>([]);
  const [otherReason, setOtherReason] = useState('');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const [skipping, setSkipping] = useState(false);

  const canNextStep1 = decision != null;
  const canNextStep2 = rating >= 1;
  const canSubmit = decision != null && rating >= 1;

  const showReasons = useMemo(() => decision === 'no' || decision === 'maybe', [decision]);

  const onToggleReason = (r: RegretReason) => {
    setReasons((prev) => {
      const next = prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r];
      if (r === 'other' && !next.includes('other')) {
        setOtherReason('');
      }
      return next;
    });
  };

  const onNext = () => {
    if (step === 1 && !canNextStep1) return;
    if (step === 2 && !canNextStep2) return;
    setStep((s) => (s === 3 ? 3 : ((s + 1) as Step)));
  };

  const onBack = () => setStep((s) => (s === 1 ? 1 : ((s - 1) as Step)));

  const onMemoKeyPress = (e: any) => {
    if (Platform.OS !== 'web') return;
    if (e?.nativeEvent?.key !== 'Enter') return;

    const hasShift = Boolean(e?.nativeEvent?.shiftKey);
    if (hasShift) return; // Shift+Enter: 줄바꿈 허용

    e?.preventDefault?.();
    if (canSubmit && !saving) {
      void onSubmit();
    }
  };

  const onSubmit = async () => {
    if (!canSubmit) {
      Alert.alert('입력 확인', '결정과 만족도를 입력해 주세요.');
      return;
    }
    if (!expenseId || !scheduleId || !user || !account) {
      Alert.alert('오류', '필수 정보가 없습니다.');
      return;
    }

    try {
      setSaving(true);
      Keyboard.dismiss();

      await reviewService.create({
        expenseId,
        scheduleId,
        accountId: account.id,
        reviewerUserId: user.uid,
        reviewType: 'self',
        decisionAgain: decision,
        satisfaction: rating,
        regretReasons: showReasons ? reasons : [],
        otherReason: showReasons && reasons.includes('other') && otherReason.trim()
          ? otherReason.trim()
          : undefined,
        notes: memo.trim() || undefined,
        reviewedAt: new Date(),
      });

      if (decision === 'no' || rating <= 2) {
        const tips = [
          '다음엔 주문 전에 "지금 배고픔 점수(1~5)"를 먼저 체크해 보세요.',
          '가격이 아쉬웠다면, 다음엔 같은 메뉴를 2개 앱에서 10초만 비교해 보세요.',
          '맛/양이 아쉬웠다면, 다음엔 소용량 또는 검증된 메뉴로 실험 폭을 줄여 보세요.',
        ];
        const tip = tips[Math.floor(Math.random() * tips.length)];
        Alert.alert('학습 포인트', tip, [{ text: '확인', onPress: () => router.replace('/(tabs)') }]);
        return;
      }
      router.replace('/(tabs)');
    } catch (e) {
      console.error('[review] submit failed', e);
      Alert.alert('저장 실패', '리뷰를 저장하지 못했어요. 네트워크를 확인해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  const onSkip = () => {
    if (!scheduleId) {
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
              router.replace('/(tabs)');
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

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top, backgroundColor: colors.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        style={[styles.container, { backgroundColor: colors.bg }]}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.headerRow}>
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
            style={styles.headerBackBtn}
            accessibilityRole="button"
            accessibilityLabel="뒤로가기"
          >
            <Text style={[styles.headerBackText, { color: colors.primary }]}>{'<'} 뒤로</Text>
          </Pressable>
          <Text style={[styles.h1, { color: colors.text }]}>리뷰</Text>
          <Pressable onPress={onSkip} disabled={skipping}>
            <Text style={[styles.skipText, { color: colors.textSec }, skipping && styles.skipTextDisabled]}>
              스킵
            </Text>
          </Pressable>
        </View>

        <View style={styles.stepRow}>
          <StepPill active={step === 1} label="1 결정" />
          <StepPill active={step === 2} label="2 만족도" />
          <StepPill active={step === 3} label="3 이유/메모" />
        </View>

        {step === 1 && (
          <AppCard>
            <Text style={styles.title}>다시 선택한다면?</Text>
            <Text style={styles.desc}>시간이 지난 지금 기준으로 평가해요.</Text>

            <View style={{ height: 14 }} />

            <View style={{ gap: 10 }}>
              {REVIEW_DECISIONS.map((d) => {
                const active = decision === d.key;
                return (
                  <Pressable
                    key={d.key}
                    onPress={() => {
                      setDecision(d.key);
                      setStep(2);
                    }}
                    style={[styles.choice, active && styles.choiceActive]}
                  >
                    <Text style={styles.choiceEmoji}>{d.emoji}</Text>
                    <Text style={[styles.choiceText, active && styles.choiceTextActive]}>
                      {d.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </AppCard>
        )}

        {step === 2 && (
          <AppCard>
            <Text style={styles.title}>만족도는 어땠나요?</Text>
            <Text style={styles.desc}>1점(별로) ~ 5점(만족)</Text>

            <View style={{ height: 18 }} />

            <View style={{ alignItems: 'center', gap: 10 }}>
              <StarRating
                value={rating}
                onChange={(value) => {
                  setRating(value);
                  setStep(3);
                }}
              />
              <Text style={styles.ratingText}>
                {rating === 0 ? '선택해 주세요' : `${rating} / 5`}
              </Text>
            </View>
          </AppCard>
        )}

        {step === 3 && (
          <View style={{ gap: 16 }}>
            <AppCard>
              <Text style={styles.title}>이유를 남겨볼까요?</Text>
              <Text style={styles.desc}>
                {showReasons
                  ? '후회/애매함의 이유를 선택하면 나중에 패턴이 더 잘 보여요.'
                  : '선택사항이에요. 메모만 남겨도 좋아요.'}
              </Text>

              {showReasons && (
                <>
                  <View style={{ height: 14 }} />
                  <View style={styles.chipWrap}>
                    {REGRET_REASONS.map((r) => (
                      <Chip
                        key={r.key}
                        label={r.label}
                        active={reasons.includes(r.key)}
                        onPress={() => onToggleReason(r.key)}
                      />
                    ))}
                  </View>
                  {reasons.includes('other') && (
                    <TextInput
                      value={otherReason}
                      onChangeText={setOtherReason}
                      placeholder="기타 이유를 직접 입력해 주세요"
                      style={styles.otherInput}
                      maxLength={100}
                    />
                  )}
                </>
              )}
            </AppCard>

            <AppCard>
              <Text style={styles.title}>메모</Text>
              <Text style={styles.desc}>나중에 기억할 한 줄만 적어도 충분해요.</Text>
              <View style={{ height: 10 }} />
              <TextInput
                value={memo}
                onChangeText={setMemo}
                placeholder="예: 배고파서 충동적으로 시켰는데 맛은 그냥 그랬다"
                style={styles.memo}
                multiline
                onKeyPress={onMemoKeyPress}
              />
              <Text style={styles.memoHint}>Enter로 저장, Shift+Enter로 줄바꿈</Text>
            </AppCard>
          </View>
        )}

        <View style={{ height: 90 }} />
      </ScrollView>

      <View style={styles.bottomBar}>
        {step > 1 ? (
          <Pressable onPress={onBack} style={styles.backBtn}>
            <Text style={styles.backText}>이전</Text>
          </Pressable>
        ) : (
          <View style={{ width: 70 }} />
        )}

        {step < 3 ? (
          <PrimaryButton
            label="다음"
            onPress={onNext}
            disabled={(step === 1 && !canNextStep1) || (step === 2 && !canNextStep2)}
            style={{ flex: 1 }}
          />
        ) : (
          <PrimaryButton
            label={saving ? '저장 중...' : '완료'}
            onPress={onSubmit}
            disabled={!canSubmit || saving}
            style={{ flex: 1 }}
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function StepPill({ active, label }: { active: boolean; label: string }) {
  return (
    <View style={[styles.pill, active && styles.pillActive]}>
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 20, gap: 16 },
  h1: { fontSize: 18, fontWeight: '900', color: '#111827' },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerBackBtn: { minWidth: 56 },
  headerBackText: { fontWeight: '800', color: '#4A90E2' },
  skipText: { fontWeight: '800', color: '#6B7280' },
  skipTextDisabled: { opacity: 0.5 },

  stepRow: { flexDirection: 'row', gap: 8 },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pillActive: { backgroundColor: '#E8F1FF', borderColor: '#BFDBFE' },
  pillText: { fontWeight: '900', color: '#6B7280', fontSize: 12 },
  pillTextActive: { color: '#1D4ED8' },

  title: { fontSize: 16, fontWeight: '900', color: '#111827' },
  desc: { marginTop: 8, color: '#6B7280', fontWeight: '700', lineHeight: 20 },

  choice: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  choiceActive: { backgroundColor: '#E8F1FF', borderColor: '#77A7FF' },
  choiceEmoji: { fontSize: 18 },
  choiceText: { fontWeight: '900', color: '#111827' },
  choiceTextActive: { color: '#1D4ED8' },

  ratingText: { fontWeight: '900', color: '#111827' },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  reasonGroupLabel: { fontSize: 13, fontWeight: '600', color: '#555', marginBottom: 2 },
  otherInput: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    backgroundColor: '#F0F7FF',
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginTop: 4,
  },

  memo: {
    minHeight: 110,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: '#fff',
    fontWeight: '800',
    color: '#111827',
    textAlignVertical: 'top',
  },
  memoHint: {
    marginTop: 8,
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },

  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  backBtn: {
    width: 70,
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  backText: { fontWeight: '900', color: '#111827' },
});
