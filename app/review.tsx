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
import { MaterialIcons } from '@expo/vector-icons';
import { FirebaseError } from 'firebase/app';
import { firstParam } from '@/utils/routerParams';
import { Chip } from '@/components/Chip';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SatisfactionLevelPicker } from '@/components/SatisfactionLevelPicker';
import { regretReasonsForReviewUi } from '@/lib/regretReasons';
import { decisionAgainFromSatisfaction, needsRegretReasonsFlow } from '@/lib/reviewSatisfaction';
import { reviewService } from '@/services/reviewService';
import { scheduleService } from '@/services/scheduleService';
import { useAuth } from '@/hooks/useAuth';
import { RegretReason } from '@/lib/types';
import { useTheme } from '@/theme/ThemeContext';

const cardShadow = (isDark: boolean) =>
  Platform.select({
    ios: {
      shadowColor: '#0c1220',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: isDark ? 0.45 : 0.06,
      shadowRadius: 16,
    },
    android: { elevation: isDark ? 6 : 2 },
    default: {},
  });

export default function ReviewScreen() {
  const router = useRouter();
  const { user, account } = useAuth();
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const rawParams = useLocalSearchParams<{
    expenseId?: string | string[];
    scheduleId?: string | string[];
  }>();
  const expenseId = firstParam(rawParams.expenseId);
  const scheduleId = firstParam(rawParams.scheduleId);

  const { primary: primaryRegretReasons, rest: restRegretReasons } = useMemo(() => regretReasonsForReviewUi(), []);

  const [rating, setRating] = useState<number>(0);
  const [reasons, setReasons] = useState<RegretReason[]>([]);
  const [otherReason, setOtherReason] = useState('');
  const [memo, setMemo] = useState('');
  const [saving, setSaving] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [showAllRestReasons, setShowAllRestReasons] = useState(false);

  const canSubmit = rating >= 1;
  const showReasons = useMemo(() => needsRegretReasonsFlow(rating), [rating]);

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
    if (!canSubmit) {
      Alert.alert('입력 확인', '만족도를 선택해 주세요.');
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
        contentContainerStyle={[styles.content, { paddingBottom: 24 + insets.bottom }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.hero,
            { backgroundColor: colors.surface, borderColor: colors.border },
            cardShadow(isDark),
          ]}
        >
          <Pressable
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
            style={({ pressed }) => [styles.heroIconBtn, { opacity: pressed ? 0.65 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel="뒤로가기"
          >
            <MaterialIcons name="arrow-back" size={24} color={colors.text} />
          </Pressable>
          <View style={styles.heroCenter}>
            <Text style={[styles.heroTitle, { color: colors.text }]}>소비 리뷰</Text>
            <Text style={[styles.heroSub, { color: colors.textSec }]}>잠깐만 남겨 두면 패턴이 보여요</Text>
          </View>
          <Pressable onPress={onSkip} disabled={skipping} style={styles.heroSkipWrap} hitSlop={8}>
            <Text style={[styles.heroSkip, { color: colors.textMuted }, skipping && styles.skipDisabled]}>
              건너뛰기
            </Text>
          </Pressable>
        </View>

        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, borderColor: colors.border },
            cardShadow(isDark),
          ]}
        >
          <View style={[styles.sheetAccent, { backgroundColor: colors.primary }]} />
          <View style={styles.sheetInner}>
            <Text style={[styles.kicker, { color: colors.textMuted }]}>만족도</Text>
            <Text style={[styles.blockTitle, { color: colors.text }]}>이번 소비는 어땠나요?</Text>
            <Text style={[styles.blockDesc, { color: colors.textSec }]}>
              위에서 아래로, 가장 가까운 쪽을 골라 주세요.
            </Text>
            <View style={{ height: 18 }} />
            <SatisfactionLevelPicker value={rating} onChange={setRating} isDark={isDark} />
          </View>
        </View>

        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, borderColor: colors.border },
            cardShadow(isDark),
          ]}
        >
          <View style={[styles.sheetAccentMuted, { backgroundColor: colors.textMuted }]} />
          <View style={styles.sheetInner}>
            <Text style={[styles.kicker, { color: colors.textMuted }]}>메모 · 이유</Text>
            <Text style={[styles.blockTitle, { color: colors.text }]}>
              {showReasons ? '아쉬웠던 점이 있나요?' : '추가로 남기고 싶은 말'}
            </Text>
            <Text style={[styles.blockDesc, { color: colors.textSec }]}>
              {showReasons
                ? '자주 고르는 이유만 보여요. 더 필요하면 펼칠 수 있어요.'
                : '선택이에요. 적지 않아도 괜찮아요.'}
            </Text>

            {showReasons && (
              <>
                <View style={{ height: 14 }} />
                <View style={styles.chipWrap}>
                  {primaryRegretReasons.map((r) => (
                    <Chip
                      key={r.key}
                      label={r.label}
                      active={reasons.includes(r.key)}
                      onPress={() => onToggleReason(r.key)}
                    />
                  ))}
                </View>
                {restRegretReasons.length > 0 ? (
                  <>
                    <Pressable
                      onPress={() => setShowAllRestReasons((v) => !v)}
                      style={({ pressed }) => [
                        styles.moreRow,
                        { borderColor: colors.border, opacity: pressed ? 0.85 : 1 },
                      ]}
                    >
                      <Text style={[styles.moreRowText, { color: colors.primary }]}>
                        {showAllRestReasons ? '접기' : `다른 이유 ${restRegretReasons.length}개`}
                      </Text>
                      <MaterialIcons
                        name={showAllRestReasons ? 'expand-less' : 'expand-more'}
                        size={22}
                        color={colors.primary}
                      />
                    </Pressable>
                    {showAllRestReasons ? (
                      <View style={[styles.chipWrap, { marginTop: 4 }]}>
                        {restRegretReasons.map((r) => (
                          <Chip
                            key={r.key}
                            label={r.label}
                            active={reasons.includes(r.key)}
                            onPress={() => onToggleReason(r.key)}
                          />
                        ))}
                      </View>
                    ) : null}
                  </>
                ) : null}
                {reasons.includes('other') && (
                  <TextInput
                    value={otherReason}
                    onChangeText={setOtherReason}
                    placeholder="기타 이유를 짧게"
                    placeholderTextColor={colors.placeholder}
                    style={[
                      styles.textIn,
                      {
                        marginTop: 12,
                        borderColor: colors.borderInput,
                        backgroundColor: colors.inputBg,
                        color: colors.text,
                      },
                    ]}
                    maxLength={100}
                  />
                )}
              </>
            )}

            <View style={{ height: 16 }} />
            <Text style={[styles.memoLabel, { color: colors.textSec }]}>한 줄 메모 (선택)</Text>
            <TextInput
              value={memo}
              onChangeText={setMemo}
              placeholder="예: 배고파서 시켰는데 생각보다 비쌌다"
              placeholderTextColor={colors.placeholder}
              style={[
                styles.memo,
                {
                  borderColor: colors.borderInput,
                  backgroundColor: colors.inputBg,
                  color: colors.text,
                },
              ]}
              multiline
              onKeyPress={onMemoKeyPress}
            />
            {Platform.OS === 'web' ? (
              <Text style={[styles.webHint, { color: colors.textMuted }]}>
                Enter로 저장 · Shift+Enter로 줄바꿈
              </Text>
            ) : null}
          </View>
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      <View
        style={[
          styles.bottomBar,
          {
            borderTopColor: colors.border,
            backgroundColor: colors.surface,
            paddingBottom: Math.max(insets.bottom, 12),
          },
          cardShadow(isDark),
        ]}
      >
        <PrimaryButton
          label={saving ? '저장 중...' : '완료하고 닫기'}
          onPress={onSubmit}
          disabled={!canSubmit || saving}
          style={{ flex: 1, height: 52, borderRadius: 14 }}
        />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },
  content: { paddingHorizontal: 18, gap: 18 },

  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    gap: 4,
  },
  heroIconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  heroCenter: { flex: 1, alignItems: 'center' },
  heroTitle: { fontSize: 17, fontWeight: '900' },
  heroSub: { marginTop: 3, fontSize: 12, fontWeight: '600' },
  heroSkipWrap: { minWidth: 72, alignItems: 'flex-end', paddingRight: 4 },
  heroSkip: { fontSize: 13, fontWeight: '800' },
  skipDisabled: { opacity: 0.45 },

  sheet: {
    flexDirection: 'row',
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  sheetAccent: { width: 5 },
  sheetAccentMuted: { width: 5, opacity: 0.85 },
  sheetInner: { flex: 1, padding: 18 },
  kicker: { fontSize: 11, fontWeight: '800', letterSpacing: 0.6 },
  blockTitle: { marginTop: 6, fontSize: 18, fontWeight: '900' },
  blockDesc: { marginTop: 8, fontSize: 14, fontWeight: '600', lineHeight: 21 },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  moreRow: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  moreRowText: { fontSize: 13, fontWeight: '800' },

  textIn: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    fontWeight: '600',
  },
  memoLabel: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  memo: {
    minHeight: 100,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontWeight: '700',
    fontSize: 15,
    lineHeight: 22,
    textAlignVertical: 'top',
  },
  webHint: { marginTop: 8, fontSize: 11, fontWeight: '600' },

  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 18,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
