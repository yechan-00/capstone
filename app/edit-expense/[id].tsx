import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { expenseService } from '@/services/expenseService';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { useExpenses } from '@/hooks/useExpenses';
import { useAuth } from '@/hooks/useAuth';
import { Chip } from '@/components/Chip';
import { AppCard } from '@/components/AppCard';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SpentAtDateTimePickers } from '@/components/SpentAtDateTimePickers';
import { CATEGORIES, MOODS, QUICK_AMOUNTS, REASON_GROUPS, CategoryKey } from '@/lib/expenseOptions';
import { ExpenseMood } from '@/lib/types';
import { scanReceiptImage } from '@/services/geminiService';
import { buildManualExpensePayload } from '@/services/expenseInput/manualExpensePayload';
import { scanResultToFormPatch, type ScanFormPatch } from '@/services/expenseInput/fromScanResult';
import { parsePastedExpenseText } from '@/services/expenseInput/fromPastedText';
import { uploadExpenseImage } from '@/services/storageService';
import { scheduleRiskAwarenessAfterExpense } from '@/services/riskSpendingNotification';
import { useTheme } from '@/theme/ThemeContext';

const TAG_PRESETS = ['야식', '데이트', '시발비용', '보상', '스트레스'] as const;

const ADD_STEPS = ['금액·유형', '시간·사진', '이유·기분', '확인'] as const;
/** 상단 스텝 바: 한 줄용 짧은 라벨 */
const ADD_STEP_BAR_LABELS = ['금액', '시간·사진', '이유·기분', '확인'] as const;
const LAST_STEP = ADD_STEPS.length - 1;
/** +2만(20000) 칩은 한 줄에 초기화까지 넣기 위해 제외 */
const QUICK_AMOUNTS_STEP = QUICK_AMOUNTS.filter((v) => v !== 20000);
const PHOTO_PREVIEW_MAX_HEIGHT = 320;
const REASON_CHIP_ROWS = [
  REASON_GROUPS[0].items.slice(0, 4),
  REASON_GROUPS[0].items.slice(4),
] as const;

/** 원본 비율 유지하며 박스 안에 전체가 들어가도록 크기 계산 */
function fitImageInBox(srcW: number, srcH: number, maxW: number, maxH: number) {
  if (srcW <= 0 || srcH <= 0) return { width: maxW, height: Math.min(maxH, maxW * 0.75) };
  let width = maxW;
  let height = (srcH / srcW) * width;
  if (height > maxH) {
    height = maxH;
    width = (srcW / srcH) * height;
  }
  return { width: Math.round(width), height: Math.round(height) };
}

export default function EditExpenseScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user, account } = useAuth();
  const { updateExpense } = useExpenses();
  const [loaded, setLoaded] = React.useState(false);
  const { colors, isDark } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const amountRef = useRef<TextInput>(null);
  /** 카드 좌우 패딩·액센트 바 제외한 미리보기 최대 너비 */
  const photoPreviewMaxWidth = windowWidth - 56;
  const [photoPreviewSize, setPhotoPreviewSize] = useState<{ width: number; height: number } | null>(
    null,
  );

  const [amountText, setAmountText] = useState('');
  const amount = useMemo(() => parseAmount(amountText), [amountText]);

  const [category, setCategory] = useState<CategoryKey>('takeout');
  const [reasons, setReasons] = useState<string[]>([]);
  const [customReason, setCustomReason] = useState('');
  const [reasonDetail, setReasonDetail] = useState('');
  const [step, setStep] = useState(0);
  const [mood, setMood] = useState<(typeof MOODS)[number]['key'] | null>(null);
  const [item, setItem] = useState('');
  const [summaryLine, setSummaryLine] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [localImageUri, setLocalImageUri] = useState<string | null>(null);
  const [spentAt, setSpentAt] = useState(new Date());
  const [tempSpentAt, setTempSpentAt] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteBuffer, setPasteBuffer] = useState('');
  const reviewDelayDays = Array.isArray(account?.reviewDelayDays) ? account!.reviewDelayDays : [account?.reviewDelayDays ?? 3].filter(Boolean) as any;

  // 기존 소비 데이터 불러오기
  React.useEffect(() => {
    if (!id) return;
    expenseService.getById(id).then(expense => {
      if (!expense) return;
      setAmountText(String(expense.amount));
      setCategory((expense.category as CategoryKey) ?? 'takeout');
      setItem(expense.item ?? expense.content ?? '');
      setReasonDetail(expense.reason ?? '');
      setSummaryLine(expense.summaryLine ?? '');
      setTagsText((expense.tags ?? []).join(', '));
      setMood((expense.mood as any) ?? null);
      setSpentAt(expense.spentAt ?? new Date());
      setTempSpentAt(expense.spentAt ?? new Date());
      setLoaded(true);
    });
  }, [id]);

  const applyScanFormPatch = (patch: ScanFormPatch): string[] => {
    const updates: string[] = [];
    if (patch.amountText) {
      setAmountText(patch.amountText);
      updates.push(`금액: ₩${Number(patch.amountText).toLocaleString()}`);
    }
    if (patch.category) {
      setCategory(patch.category);
      updates.push('카테고리 반영');
    }
    if (patch.item) {
      setItem(patch.item);
      updates.push(`품목: ${patch.item}`);
    }
    if (patch.memo) {
      setReasonDetail((d) => (d ? `${d}\n${patch.memo}` : patch.memo!));
      updates.push('원문 메모 반영');
    }
    if (patch.spentAt) {
      setSpentAt(patch.spentAt);
      setTempSpentAt(patch.spentAt);
    }
    if (patch.tagsText) setTagsText(patch.tagsText);
    return updates;
  };

  const handleScanImage = async (base64: string) => {
    try {
      setScanning(true);
      const result = await scanReceiptImage(base64, 'image/jpeg');
      const patch = scanResultToFormPatch(result);
      const updates = applyScanFormPatch(patch);

      setTimeout(() => {
        Alert.alert('스캔 완료 ✅', updates.length > 0 ? updates.join('\n') : '확인 후 수정해 주세요.');
      }, 100);
    } catch (e) {
      Alert.alert('스캔 실패', `이미지를 인식하지 못했어요.\n${e instanceof Error ? e.message : ''}`);
    } finally {
      setScanning(false);
    }
  };

  const handleCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('카메라 권한 필요', '설정에서 카메라 권한을 허용해 주세요.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      handleScanImage(result.assets[0].base64);
    }
  };

  const handleGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('사진 권한 필요', '설정에서 사진 접근 권한을 허용해 주세요.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: true,
    });
    if (!result.canceled && result.assets[0]?.base64) {
      handleScanImage(result.assets[0].base64);
    }
  };

  const handleScanPress = () => {
    Alert.alert('영수증 스캔', '영수증이나 카드 문자를 스캔해서\n자동으로 정보를 입력해요.', [
      { text: '카메라로 촬영', onPress: handleCamera },
      { text: '갤러리에서 선택', onPress: handleGallery },
      { text: '취소', style: 'cancel' },
    ]);
  };

  const openPasteModal = () => {
    setPasteBuffer('');
    setShowPasteModal(true);
  };

  const fillPasteFromClipboard = async () => {
    try {
      const t = await Clipboard.getStringAsync();
      setPasteBuffer(t ?? '');
    } catch {
      Alert.alert('클립보드', '내용을 읽지 못했어요.');
    }
  };

  const applyPaste = () => {
    const patch = parsePastedExpenseText(pasteBuffer);
    const updates = applyScanFormPatch(patch);
    setShowPasteModal(false);
    setPasteBuffer('');
    Alert.alert(
      '붙여넣기 반영',
      updates.length > 0 ? `${updates.join('\n')}\n\n자동 추출은 틀릴 수 있어요. 금액·품목을 꼭 확인해 주세요.` : '인식된 정보가 없어요. 금액·품목을 직접 입력해 주세요.'
    );
  };

  const handleAttachPhoto = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('사진 권한 필요', '설정에서 사진 접근 권한을 허용해 주세요.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setLocalImageUri(result.assets[0].uri);
    }
  };

  const togglePresetTag = (tag: string) => {
    const parts = tagsText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const has = parts.includes(tag);
    const next = has ? parts.filter((t) => t !== tag) : [...parts, tag];
    setTagsText(next.join(', '));
  };

  const handleDatePickerOpen = () => {
    setTempSpentAt(spentAt);
    setShowDatePicker(true);
  };

  const handleDatePickerConfirm = () => {
    setSpentAt(tempSpentAt);
    setShowDatePicker(false);
  };

  const handleDatePickerCancel = () => {
    setShowDatePicker(false);
  };

  const webDateValue = (() => {
    const y = tempSpentAt.getFullYear();
    const m = String(tempSpentAt.getMonth() + 1).padStart(2, '0');
    const d = String(tempSpentAt.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  })();

  const webTimeValue = (() => {
    const h = String(tempSpentAt.getHours()).padStart(2, '0');
    const m = String(tempSpentAt.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  })();

  const handleWebDateChange = (value: string) => {
    if (!value) return;
    const [y, m, d] = value.split('-').map((v) => Number(v));
    if ([y, m, d].some((v) => Number.isNaN(v))) return;
    const next = new Date(tempSpentAt);
    next.setFullYear(y, m - 1, d);
    setTempSpentAt(next);
  };

  const handleWebTimeChange = (value: string) => {
    if (!value) return;
    const [h, m] = value.split(':').map((v) => Number(v));
    if ([h, m].some((v) => Number.isNaN(v))) return;
    const next = new Date(tempSpentAt);
    next.setHours(h, m, 0, 0);
    setTempSpentAt(next);
  };

  const formatDateTime = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}`;
  };

  React.useEffect(() => {
    if (step !== 0) return undefined;
    const t = setTimeout(() => amountRef.current?.focus(), 150);
    return () => clearTimeout(t);
  }, [step]);

  useEffect(() => {
    if (!localImageUri) {
      setPhotoPreviewSize(null);
      return;
    }
    Image.getSize(
      localImageUri,
      (w, h) => {
        setPhotoPreviewSize(fitImageInBox(w, h, photoPreviewMaxWidth, PHOTO_PREVIEW_MAX_HEIGHT));
      },
      () => setPhotoPreviewSize(fitImageInBox(4, 3, photoPreviewMaxWidth, PHOTO_PREVIEW_MAX_HEIGHT)),
    );
  }, [localImageUri, photoPreviewMaxWidth]);

  const categoryLabel = useMemo(
    () => CATEGORIES.find((c) => c.key === category)?.label ?? category,
    [category],
  );

  const moodLabel = useMemo(() => {
    if (!mood) return '선택 없음 → 저장 시「보통」으로 기록';
    const m = MOODS.find((x) => x.key === mood);
    return m ? `${m.emoji} ${m.label}` : mood;
  }, [mood]);

  const reasonPreview = useMemo(() => {
    const chipPart =
      reasons.length > 0
        ? reasons.map((r: string) => (r === '기타' ? customReason.trim() || '기타' : r)).join(', ')
        : '';
    const line = [chipPart, reasonDetail.trim()].filter(Boolean).join(' · ');
    return line || '—';
  }, [reasons, customReason, reasonDetail]);

  const canAdvanceFromStep = (s: number) => {
    if (s === 0) return amount > 0;
    return true;
  };

  const goNext = () => {
    if (!canAdvanceFromStep(step)) {
      Alert.alert('입력 확인', '금액을 입력해 주세요.');
      return;
    }
    Keyboard.dismiss();
    setStep((prev) => Math.min(prev + 1, LAST_STEP));
  };

  const goBack = () => {
    Keyboard.dismiss();
    setStep((prev) => Math.max(0, prev - 1));
  };

  const canSave = amount > 0 && !!category;

  const onSave = async () => {
    if (!canSave) {
      Alert.alert('입력 확인', '금액과 카테고리를 입력해 주세요.');
      return;
    }

    try {
      setSaving(true);
      Keyboard.dismiss();

      const tags = tagsText
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean)
        .slice(0, 8);

      const chipPart =
        reasons.length > 0
          ? reasons
              .map((r: string) => (r === '기타' ? customReason.trim() || '기타' : r))
              .join(', ')
          : '';
      const resolvedReason =
        [chipPart, reasonDetail.trim()].filter(Boolean).join(' · ') || '기록 없음';
      const resolvedMood = (mood ?? 'normal') as ExpenseMood;

      const payload = buildManualExpensePayload({
        amount,
        category,
        item: item.trim(),
        reason: resolvedReason,
        mood: resolvedMood,
        tags,
        spentAt,
        sourceType: 'manual',
        sourceRef: null,
        summaryLine: summaryLine.trim() || undefined,
        imageUrl: null,
      });

      await updateExpense(id, {
        amount: payload.amount,
        category: payload.category,
        item: payload.item,
        reason: payload.reason,
        mood: payload.mood,
        tags: payload.tags,
        spentAt: payload.spentAt,
        summaryLine: payload.summaryLine,
        summaryEmoji: payload.summaryEmoji,
      });
      const expenseId = id;

      void scheduleRiskAwarenessAfterExpense({
        amount,
        category,
        tags,
        reason: resolvedReason,
        spentAt,
        account,
      });

      if (user?.uid && localImageUri) {
        try {
          const url = await uploadExpenseImage(user.uid, expenseId, localImageUri);
          await updateExpense(expenseId, { imageUrl: url });
        } catch (err) {
          console.warn('[expense] image upload failed', err);
        }
      }

      router.replace('/(tabs)');
    } catch (e) {
      console.error('[expense] create failed', e);
      Alert.alert('저장 실패', `저장하지 못했어요. 오류: ${e instanceof Error ? e.message : '알 수 없는 오류'}`);
    } finally {
      setSaving(false);
    }
  };

  const headerTitleColor = isDark ? colors.onPrimary : colors.onPrimary;
  const headerSubColor = 'rgba(255,255,255,0.78)';
  const headerActionBorder = 'rgba(255,255,255,0.28)';
  const headerActionBg = 'rgba(255,255,255,0.12)';

  if (!loaded) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['left', 'right']}>
      <StatusBar style="light" />
      <View style={styles.screenHeader}>
        {isDark ? (
          <LinearGradient
            colors={[colors.headerGradientStart, colors.headerGradientEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.accentCta }]} />
        )}
        <View style={[styles.screenHeaderInner, { paddingTop: insets.top + 8 }]}>
          <View style={styles.headerRow}>
            <Text style={[styles.h1, { color: headerTitleColor }]}>소비 추가</Text>
            <View style={styles.headerActions}>
              <Pressable
                style={[
                  styles.headerActionBtn,
                  { borderColor: headerActionBorder, backgroundColor: headerActionBg },
                  scanning && { opacity: 0.6 },
                ]}
                onPress={handleScanPress}
                disabled={scanning}
                accessibilityRole="button"
                accessibilityLabel="영수증 스캔"
              >
                {scanning ? (
                  <ActivityIndicator size="small" color={headerTitleColor} />
                ) : (
                  <>
                    <MaterialIcons name="document-scanner" size={15} color={headerTitleColor} />
                    <Text style={[styles.headerActionText, { color: headerTitleColor }]}>스캔</Text>
                  </>
                )}
              </Pressable>
              <Pressable
                style={[styles.headerActionBtn, { borderColor: headerActionBorder, backgroundColor: headerActionBg }]}
                onPress={openPasteModal}
                accessibilityRole="button"
                accessibilityLabel="문자 붙여넣기"
              >
                <MaterialIcons name="content-paste" size={15} color={headerSubColor} />
                <Text style={[styles.headerActionText, { color: headerSubColor }]}>붙여넣기</Text>
              </Pressable>
              <Pressable
                style={[styles.headerActionBtn, { borderColor: headerActionBorder, backgroundColor: headerActionBg }]}
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
                accessibilityRole="button"
                accessibilityLabel="닫기"
              >
                <MaterialIcons name="close" size={16} color={headerSubColor} />
                <Text style={[styles.headerActionText, { color: headerSubColor }]}>닫기</Text>
              </Pressable>
            </View>
          </View>

          <View style={[styles.stepStripOnHeader, { backgroundColor: 'rgba(255,255,255,0.14)' }]}>
            {ADD_STEP_BAR_LABELS.map((barLabel, i) => {
              const active = i === step;
              const done = i < step;
              return (
                <Pressable
                  key={barLabel}
                  onPress={() => {
                    if (i < step) setStep(i);
                  }}
                  disabled={i > step}
                  style={({ pressed }) => [
                    styles.stepChip,
                    {
                      borderColor: active ? colors.onPrimary : 'transparent',
                      backgroundColor: active
                        ? colors.onPrimary
                        : done
                          ? 'rgba(255,255,255,0.22)'
                          : 'transparent',
                      opacity: pressed && i < step ? 0.88 : 1,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.stepChipNum,
                      {
                        color: active
                          ? colors.accentCta
                          : done
                            ? colors.onPrimary
                            : headerSubColor,
                      },
                    ]}
                  >
                    {i + 1}
                  </Text>
                  <Text
                    style={[
                      styles.stepChipLabel,
                      {
                        color: active ? colors.accentCta : done ? colors.onPrimary : headerSubColor,
                      },
                    ]}
                    numberOfLines={1}
                  >
                    {barLabel}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      <View style={[styles.pageBody, { backgroundColor: colors.bg }]}>
      <KeyboardAvoidingView
        style={styles.pageBodyInner}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={styles.container}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 120 + insets.bottom },
          (step === 0 || step === 2) && styles.contentNoScroll,
        ]}
        scrollEnabled={step !== 0 && step !== 2}
        bounces={step !== 0 && step !== 2}
        alwaysBounceVertical={false}
        showsVerticalScrollIndicator={false}
      >
        {step === 0 ? (
          <AppCard
            style={{
              paddingVertical: 10,
              paddingHorizontal: 12,
              backgroundColor: colors.surfaceMuted,
              borderColor: colors.border,
            }}
          >
            <Text style={[styles.timingTitle, { color: colors.text }]}>식사·간식 후에 기록해 주세요</Text>
            <Text style={[styles.timingBody, { color: colors.textSec }]}>
              한 끼가 끝난 뒤 차분할 때 적으면 후회·만족을 더 잘 떠올릴 수 있어요.
            </Text>
          </AppCard>
        ) : null}

        {step === 0 ? (
          <View
            style={[
              styles.contextCardShell,
              { borderColor: colors.border, backgroundColor: colors.surface },
              !isDark && styles.contextCardShadow,
            ]}
          >
            <View style={[styles.contextAccent, { backgroundColor: colors.primary }]} />
            <View style={styles.contextCardBody}>
              <Text style={[styles.contextKicker, { color: colors.textMuted }]}>1단계</Text>
              <Text style={[styles.contextTitle, { color: colors.text }]}>얼마를 썼나요?</Text>
              <Text style={[styles.contextHint, { color: colors.textSec }]}>금액은 필수예요.</Text>
              <Text style={[styles.labelThemed, { color: colors.textMuted }]}>금액</Text>
              <TextInput
                ref={amountRef}
                value={formatAmountInput(amountText)}
                onChangeText={(t) => setAmountText(unformat(t))}
                keyboardType="number-pad"
                placeholder="0"
                placeholderTextColor={colors.placeholder}
                style={[
                  styles.amountInput,
                  {
                    borderColor: colors.borderInput,
                    backgroundColor: colors.inputBg,
                    color: colors.text,
                  },
                ]}
              />
              <View style={styles.quickRow}>
                {QUICK_AMOUNTS_STEP.map((v) => (
                  <Chip
                    key={v}
                    label={`+${toKoreanMoney(v)}`}
                    onPress={() => setAmountText(String(amount + v))}
                  />
                ))}
                <Chip label="초기화" onPress={() => setAmountText('')} />
              </View>
              <Text style={[styles.labelThemed, { color: colors.textMuted }]}>메뉴</Text>
              <TextInput
                value={item}
                onChangeText={setItem}
                placeholder="예: 아메리카노, 치킨 반마리"
                placeholderTextColor={colors.placeholder}
                style={[
                  styles.input,
                  {
                    borderColor: colors.borderInput,
                    backgroundColor: colors.inputBg,
                    color: colors.text,
                  },
                ]}
              />
              <Text style={[styles.labelThemed, { color: colors.textMuted }]}>유형</Text>
              <View style={styles.categoryRowCompact}>
                {CATEGORIES.map((c) => {
                  const active = c.key === category;
                  return (
                    <Pressable
                      key={c.key}
                      style={[
                        styles.categoryPill,
                        {
                          backgroundColor: colors.surface,
                          borderColor: active ? colors.choiceActiveBorder : colors.border,
                        },
                        active && { backgroundColor: colors.choiceActiveBg },
                      ]}
                      onPress={() => setCategory(c.key)}
                    >
                      <Text style={styles.categoryPillEmoji}>{c.emoji}</Text>
                      <Text
                        style={[
                          styles.categoryPillText,
                          { color: colors.textSec },
                          active && { color: colors.choiceTextActive, fontWeight: '800' },
                        ]}
                        numberOfLines={1}
                      >
                        {c.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>
        ) : null}

        {step === 1 ? (
          <View
            style={[
              styles.contextCardShell,
              { borderColor: colors.border, backgroundColor: colors.surface },
              !isDark && styles.contextCardShadow,
            ]}
          >
            <View style={[styles.contextAccent, { backgroundColor: colors.primary }]} />
            <View style={styles.contextCardBody}>
              <Text style={[styles.contextKicker, { color: colors.textMuted }]}>2단계</Text>
              <Text style={[styles.contextTitle, { color: colors.text }]}>언제 결제했나요?</Text>
              <Text style={[styles.contextHint, { color: colors.textSec }]}>사진은 선택이에요.</Text>
              <Text style={[styles.labelThemed, { color: colors.textMuted }]}>거래 시간</Text>
              <Pressable
                style={[
                  styles.dateButton,
                  { borderColor: colors.border, backgroundColor: colors.inputBg },
                ]}
                onPress={handleDatePickerOpen}
              >
                <Text style={[styles.dateButtonText, { color: colors.text }]}>{formatDateTime(spentAt)}</Text>
              </Pressable>
              <Text style={[styles.labelThemed, { color: colors.textMuted }]}>사진</Text>
              <View style={styles.photoAttachRow}>
                <Pressable
                  style={[styles.attachButton, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
                  onPress={handleAttachPhoto}
                >
                  <MaterialIcons name="photo-library" size={16} color={colors.textSec} />
                  <Text style={[styles.attachButtonText, { color: colors.text }]}>
                    {localImageUri ? '사진 바꾸기' : '갤러리에서 첨부'}
                  </Text>
                </Pressable>
                {localImageUri ? (
                  <Pressable
                    style={[styles.photoDeleteBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
                    onPress={() => setLocalImageUri(null)}
                    accessibilityRole="button"
                    accessibilityLabel="첨부 사진 삭제"
                  >
                    <Text style={[styles.clearPhoto, { color: colors.logoutText }]}>삭제</Text>
                  </Pressable>
                ) : null}
              </View>
              {localImageUri ? (
                <View
                  style={[
                    styles.photoPreviewWrap,
                    { borderColor: colors.border, backgroundColor: colors.surfaceMuted },
                  ]}
                >
                  {photoPreviewSize ? (
                    <Image
                      source={{ uri: localImageUri }}
                      style={{
                        width: photoPreviewSize.width,
                        height: photoPreviewSize.height,
                      }}
                      resizeMode="contain"
                    />
                  ) : (
                    <ActivityIndicator size="small" color={colors.primary} style={styles.photoPreviewLoading} />
                  )}
                </View>
              ) : null}
            </View>
          </View>
        ) : null}

        {step === 2 ? (
          <View
            style={[
              styles.contextCardShell,
              { borderColor: colors.border, backgroundColor: colors.surface },
              !isDark && styles.contextCardShadow,
            ]}
          >
            <View style={[styles.contextAccent, { backgroundColor: colors.primary }]} />
            <View style={[styles.contextCardBody, styles.contextCardBodySpacious]}>
              <View style={styles.stepTitleRow}>
                <View style={styles.stepTitleMain}>
                  <Text style={[styles.contextKicker, { color: colors.textMuted }]}>3단계</Text>
                  <Text style={[styles.contextTitle, { color: colors.text, marginTop: 2 }]}>이유 · 기분</Text>
                </View>
                <Text style={[styles.contextHintRight, { color: colors.textMuted }]}>
                  모두 선택{'\n'}건너뛰기 가능
                </Text>
              </View>

              <View style={styles.fieldBlock}>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>왜 썼나요</Text>
                {REASON_CHIP_ROWS.map((row, rowIdx) => (
                  <View key={rowIdx} style={styles.equalChipRow}>
                    {row.map((reasonItem) => (
                      <Chip
                        key={reasonItem}
                        compact
                        soft
                        style={[styles.equalChipCell, styles.softChipCell]}
                        label={reasonItem}
                        active={reasons.includes(reasonItem)}
                        onPress={() => {
                          const selected = reasons.includes(reasonItem);
                          if (selected) {
                            setReasons((prev) => prev.filter((r) => r !== reasonItem));
                            if (reasonItem === '기타') setCustomReason('');
                          } else {
                            setReasons((prev) => [...prev, reasonItem]);
                            if (reasonItem !== '기타') setCustomReason('');
                          }
                        }}
                      />
                    ))}
                  </View>
                ))}
                {reasons.includes('기타') ? (
                  <TextInput
                    value={customReason}
                    onChangeText={setCustomReason}
                    placeholder="기타 내용"
                    placeholderTextColor={colors.placeholder}
                    style={[
                      styles.input,
                      {
                        borderColor: colors.borderInput,
                        backgroundColor: colors.inputBg,
                        color: colors.text,
                      },
                    ]}
                  />
                ) : null}
                <TextInput
                  value={reasonDetail}
                  onChangeText={setReasonDetail}
                  placeholder="상황을 한 줄로"
                  placeholderTextColor={colors.placeholder}
                  style={[
                    styles.input,
                    {
                      borderColor: colors.borderInput,
                      backgroundColor: colors.inputBg,
                      color: colors.text,
                    },
                  ]}
                />
              </View>

              <View style={styles.fieldBlock}>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>당시 기분</Text>
                <View style={styles.equalChipRow}>
                  {MOODS.map((m) => (
                    <Chip
                      key={m.key}
                      compact
                      soft
                      style={[styles.equalChipCell, styles.softChipCell]}
                      label={m.label}
                      active={mood === m.key}
                      onPress={() => setMood(mood === m.key ? null : m.key)}
                    />
                  ))}
                </View>
              </View>

              <View style={styles.fieldBlock}>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>한줄평</Text>
                <TextInput
                  value={summaryLine}
                  onChangeText={setSummaryLine}
                  placeholder="예: 배부른데 시켜서 후회"
                  placeholderTextColor={colors.placeholder}
                  style={[
                    styles.input,
                    {
                      borderColor: colors.borderInput,
                      backgroundColor: colors.inputBg,
                      color: colors.text,
                    },
                  ]}
                />
              </View>

              <View style={styles.fieldBlock}>
                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>태그</Text>
                <View style={styles.equalChipRow}>
                  {TAG_PRESETS.map((tag) => (
                    <Chip
                      key={tag}
                      compact
                      soft
                      style={[styles.equalChipCell, styles.softChipCell]}
                      label={tag}
                      active={tagsText.split(',').some((t) => t.trim() === tag)}
                      onPress={() => togglePresetTag(tag)}
                    />
                  ))}
                </View>
                <TextInput
                  value={tagsText}
                  onChangeText={setTagsText}
                  placeholder="쉼표로 구분"
                  placeholderTextColor={colors.placeholder}
                  style={[
                    styles.input,
                    {
                      borderColor: colors.borderInput,
                      backgroundColor: colors.inputBg,
                      color: colors.text,
                    },
                  ]}
                />
              </View>
            </View>
          </View>
        ) : null}

        {step === 3 ? (
          <View
            style={[
              styles.contextCardShell,
              { borderColor: colors.border, backgroundColor: colors.surface },
              !isDark && styles.contextCardShadow,
            ]}
          >
            <View style={[styles.contextAccent, { backgroundColor: colors.success }]} />
            <View style={styles.contextCardBody}>
              <Text style={[styles.contextKicker, { color: colors.textMuted }]}>확인</Text>
              <Text style={[styles.contextTitle, { color: colors.text }]}>이대로 저장할까요?</Text>
              <View style={{ height: 16 }} />
              <View style={[styles.confirmRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.confirmKey, { color: colors.textMuted }]}>금액</Text>
                <Text style={[styles.confirmVal, { color: colors.text }]}>₩{amount.toLocaleString()}</Text>
              </View>
              <View style={[styles.confirmRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.confirmKey, { color: colors.textMuted }]}>품목</Text>
                <Text style={[styles.confirmVal, { color: colors.text }]}>{item.trim() || '—'}</Text>
              </View>
              <View style={[styles.confirmRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.confirmKey, { color: colors.textMuted }]}>카테고리</Text>
                <Text style={[styles.confirmVal, { color: colors.text }]}>{categoryLabel}</Text>
              </View>
              <View style={[styles.confirmRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.confirmKey, { color: colors.textMuted }]}>시간</Text>
                <Text style={[styles.confirmVal, { color: colors.textSec }]}>{formatDateTime(spentAt)}</Text>
              </View>
              <View style={[styles.confirmRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.confirmKey, { color: colors.textMuted }]}>이유</Text>
                <Text style={[styles.confirmVal, { color: colors.textSec }]}>{reasonPreview}</Text>
              </View>
              <View style={[styles.confirmRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.confirmKey, { color: colors.textMuted }]}>기분</Text>
                <Text style={[styles.confirmVal, { color: colors.textSec }]}>{moodLabel}</Text>
              </View>
              {summaryLine.trim() ? (
                <View style={[styles.confirmRow, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.confirmKey, { color: colors.textMuted }]}>한줄평</Text>
                  <Text style={[styles.confirmVal, { color: colors.textSec }]}>{summaryLine.trim()}</Text>
                </View>
              ) : null}
              <View style={[styles.confirmRow, { borderBottomColor: colors.border }]}>
                <Text style={[styles.confirmKey, { color: colors.textMuted }]}>태그</Text>
                <Text style={[styles.confirmVal, { color: colors.textSec }]}>
                  {tagsText.trim() || '—'}
                </Text>
              </View>
              <Text style={[styles.bottomSub, { color: colors.textMuted, marginTop: 14 }]}>
                저장하면 리뷰 알림이 D+{reviewDelayDays.join(', ')} 에 잡혀요.
              </Text>
            </View>
          </View>
        ) : null}

        <View style={{ height: 24 }} />
      </ScrollView>

      {showDatePicker && Platform.OS === 'web' && (
          <View style={styles.webDatePanel}>
            <View style={styles.datePickerHeader}>
              <Pressable onPress={handleDatePickerCancel}>
                <Text style={styles.datePickerCancel}>취소</Text>
              </Pressable>
              <Text style={styles.datePickerTitle}>날짜 및 시간 선택</Text>
              <Pressable onPress={handleDatePickerConfirm}>
                <Text style={styles.datePickerConfirm}>완료</Text>
              </Pressable>
            </View>
            <View style={styles.webDateTimeWrap}>
              <Text style={styles.webDateTimeLabel}>날짜 (연도 → 월 → 일)</Text>
              {React.createElement('input', {
                type: 'date',
                lang: 'ko-KR',
                value: webDateValue,
                onChange: (e: any) => handleWebDateChange(e?.target?.value ?? ''),
                style: {
                  height: 40,
                  borderRadius: 10,
                  border: '1px solid #D1D5DB',
                  padding: '0 10px',
                  fontSize: 14,
                  color: '#111827',
                  background: '#fff',
                },
              })}
              <Text style={[styles.webDateTimeLabel, { marginTop: 12 }]}>시간 (24시간)</Text>
              {React.createElement('input', {
                type: 'time',
                lang: 'ko-KR',
                value: webTimeValue,
                onChange: (e: any) => handleWebTimeChange(e?.target?.value ?? ''),
                style: {
                  height: 40,
                  borderRadius: 10,
                  border: '1px solid #D1D5DB',
                  padding: '0 10px',
                  fontSize: 14,
                  color: '#111827',
                  background: '#fff',
                },
              })}
              <Text style={styles.webDatePreview}>
                {tempSpentAt.toLocaleString('ko-KR', { dateStyle: 'full', timeStyle: 'short' })}
              </Text>
            </View>
          </View>
        )}

        {showDatePicker && Platform.OS !== 'web' && (
          <Modal transparent animationType="slide" onRequestClose={handleDatePickerCancel}>
            <View style={styles.datePickerContainer}>
              <Pressable style={styles.datePickerBackdrop} onPress={handleDatePickerCancel} />
              <View style={styles.datePickerContent}>
                <View style={styles.datePickerHeader}>
                  <Pressable onPress={handleDatePickerCancel}>
                    <Text style={styles.datePickerCancel}>취소</Text>
                  </Pressable>
                  <Text style={styles.datePickerTitle}>날짜 및 시간 선택</Text>
                  <Pressable onPress={handleDatePickerConfirm}>
                    <Text style={styles.datePickerConfirm}>완료</Text>
                  </Pressable>
                </View>
                <ScrollView
                  style={{ maxHeight: 440 }}
                  contentContainerStyle={{ paddingBottom: 20 }}
                  keyboardShouldPersistTaps="handled"
                >
                  <SpentAtDateTimePickers
                    value={tempSpentAt}
                    onChange={setTempSpentAt}
                    textColor={colors.text}
                    themeVariant={isDark ? 'dark' : 'light'}
                  />
                </ScrollView>
              </View>
            </View>
          </Modal>
        )}

      <Modal visible={showPasteModal} transparent animationType="slide" onRequestClose={() => setShowPasteModal(false)}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.pasteModalBackdrop}>
            <View style={styles.pasteModalSheet}>
              <Text style={styles.pasteModalTitle}>카드·은행 문자 붙여넣기</Text>
              <Text style={styles.pasteModalHint}>
                결제 문자 전체를 붙여 넣으면 금액·가맹점·카테고리를 추정해요. (휴리스틱·오류 가능)
              </Text>
              <TextInput
                value={pasteBuffer}
                onChangeText={setPasteBuffer}
                placeholder="여기에 길게 붙여 넣기…"
                placeholderTextColor="#9CA3AF"
                style={styles.pasteModalInput}
                multiline
                textAlignVertical="top"
              />
              <View style={styles.pasteModalActions}>
                <Pressable style={styles.pasteModalSecondary} onPress={() => setShowPasteModal(false)}>
                  <Text style={styles.pasteModalSecondaryText}>닫기</Text>
                </Pressable>
                <Pressable style={styles.pasteModalSecondary} onPress={fillPasteFromClipboard}>
                  <Text style={styles.pasteModalSecondaryText}>클립보드</Text>
                </Pressable>
                <Pressable style={styles.pasteModalPrimary} onPress={applyPaste}>
                  <Text style={styles.pasteModalPrimaryText}>적용</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <View
        style={[
          styles.bottomBar,
          {
            borderTopColor: colors.border,
            backgroundColor: colors.surface,
            paddingBottom: Math.max(insets.bottom, 10),
          },
        ]}
      >
        {step > 0 ? (
          <Pressable
            onPress={goBack}
            style={({ pressed }) => [
              styles.navGhost,
              { borderColor: colors.border, backgroundColor: colors.surfaceMuted, opacity: pressed ? 0.88 : 1 },
            ]}
          >
            <Text style={[styles.navGhostText, { color: colors.text }]}>이전</Text>
          </Pressable>
        ) : (
          <View style={{ width: 76 }} />
        )}
        <View style={{ flex: 1, minWidth: 0, paddingHorizontal: 8 }}>
          <Text style={[styles.bottomHint, { color: colors.text }]} numberOfLines={1}>
            {step === LAST_STEP
              ? '확인 후 저장'
              : amount > 0
                ? `${ADD_STEPS[step].replace("추가", "수정")} · ₩${amount.toLocaleString()}`
                : ADD_STEPS[step].replace("추가", "수정")}
          </Text>
          {item.trim() && step !== LAST_STEP ? (
            <Text style={[styles.bottomSub, { color: colors.textSec }]} numberOfLines={1}>
              {item.trim()}
            </Text>
          ) : null}
        </View>
        <PrimaryButton
          label={step === LAST_STEP ? (saving ? '저장 중...' : '저장') : '다음'}
          onPress={step === LAST_STEP ? onSave : goNext}
          disabled={step === LAST_STEP ? saving || !canSave : saving}
          style={{ minWidth: 112, height: 48, borderRadius: 14 }}
        />
      </View>
      </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

function parseAmount(raw: string) {
  const cleaned = raw.replace(/[^\d]/g, '');
  if (!cleaned) return 0;
  return Number(cleaned);
}

function unformat(s: string) {
  return s.replace(/[^\d]/g, '');
}

function formatAmountInput(s: string) {
  const n = parseAmount(s);
  if (!s) return '';
  return n.toLocaleString();
}

function toKoreanMoney(v: number) {
  if (v >= 10000) return `${v / 10000}만`;
  return `${v.toLocaleString()}`;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  container: { flex: 1 },
  screenHeader: {
    overflow: 'hidden',
    zIndex: 10,
    ...Platform.select({
      android: { elevation: 8 },
      default: {},
    }),
  },
  screenHeaderInner: { paddingHorizontal: 14, paddingBottom: 14 },
  pageBody: {
    flex: 1,
    marginTop: 8,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#0f172a',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
      },
      android: { elevation: 6 },
      default: {},
    }),
  },
  pageBodyInner: { flex: 1 },
  stepStripOnHeader: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: 12,
    padding: 4,
    gap: 2,
    marginTop: 10,
  },
  content: { paddingHorizontal: 14, paddingTop: 16, paddingBottom: 20, gap: 12 },
  contentNoScroll: { flexGrow: 1, justifyContent: 'flex-start' },
  h1: { fontSize: 17, fontWeight: '900' },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  headerActionText: { fontSize: 11, fontWeight: '800' },

  label: { fontSize: 13, fontWeight: '900', color: '#6B7280', marginBottom: 8 },
  amountInput: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    fontSize: 20,
    fontWeight: '900',
    color: '#111827',
  },

  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: '#111827' },
  sectionTitleSmall: { fontSize: 14, fontWeight: '900', color: '#6B7280' },
  timingTitle: { fontWeight: '900', fontSize: 13, marginBottom: 4 },
  timingBody: { fontWeight: '600', fontSize: 11, lineHeight: 16 },
  fieldHint: { fontSize: 12, fontWeight: '600', color: '#9CA3AF' },

  categoryRowCompact: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 12,
    borderWidth: 1,
    maxWidth: '32%',
    flexGrow: 1,
  },
  categoryPillActive: {
    borderColor: '#77A7FF',
    backgroundColor: '#E8F1FF',
  },
  categoryPillEmoji: { fontSize: 14 },
  categoryPillText: { fontWeight: '800', color: '#111827', fontSize: 12, flexShrink: 1 },
  categoryPillTextActive: { color: '#1D4ED8' },

  // 기존 grid 스타일 (하위호환)
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  gridItem: {
    width: '31%', minHeight: 72, backgroundColor: '#fff',
    borderRadius: 16, borderWidth: 1, borderColor: '#E5E7EB',
    alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  gridItemActive: { borderColor: '#77A7FF', backgroundColor: '#E8F1FF' },
  gridEmoji: { fontSize: 22 },
  gridText: { fontWeight: '900', color: '#111827', fontSize: 13 },
  gridTextActive: { color: '#1D4ED8' },

  moreToggle: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 14,
    alignItems: 'center',
  },
  moreText: { fontWeight: '900', color: '#2563EB' },

  contextCardShell: {
    flexDirection: 'row',
    borderRadius: 20,
    borderWidth: 1,
    overflow: 'hidden',
  },
  contextCardShadow: Platform.select({
    ios: {
      shadowColor: '#0f172a',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.07,
      shadowRadius: 18,
    },
    android: { elevation: 4 },
    default: {},
  }),
  contextAccent: { width: 4 },
  contextCardBody: { flex: 1, padding: 12, gap: 8 },
  contextCardBodySpacious: { paddingVertical: 14, paddingHorizontal: 14, gap: 4 },
  contextKicker: { fontSize: 11, fontWeight: '800' },
  contextTitle: { marginTop: 2, fontSize: 18, fontWeight: '900' },
  contextHint: { marginTop: 2, fontSize: 11, fontWeight: '600', lineHeight: 16 },
  stepTitleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
    marginBottom: 6,
  },
  stepTitleMain: { flex: 1, minWidth: 0 },
  contextHintRight: {
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 14,
    textAlign: 'right',
    flexShrink: 0,
    maxWidth: 96,
    marginTop: 2,
  },

  fieldBlock: { gap: 10, marginTop: 14 },
  fieldLabel: { fontSize: 12, fontWeight: '800', letterSpacing: -0.2, marginBottom: 2 },
  equalChipRow: { flexDirection: 'row', alignItems: 'stretch', gap: 8 },
  equalChipCell: { flex: 1, minWidth: 0 },
  softChipCell: { borderRadius: 16 },
  stepChip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderRadius: 999,
    borderWidth: 1,
    minWidth: 0,
  },
  stepChipNum: { fontSize: 10, fontWeight: '900' },
  stepChipLabel: { fontSize: 10, fontWeight: '800', letterSpacing: -0.3, flexShrink: 1 },

  labelThemed: { fontSize: 11, fontWeight: '800', marginBottom: 4, marginTop: 2 },

  confirmRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  confirmKey: { fontSize: 13, fontWeight: '700', width: 72 },
  confirmVal: { flex: 1, fontSize: 14, fontWeight: '700', textAlign: 'right' },

  extrasToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
  },
  extrasToggleTitle: { fontSize: 15, fontWeight: '900' },
  extrasToggleSub: { marginTop: 2, fontSize: 12, fontWeight: '600' },

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  photoAttachRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  attachButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  attachButtonText: { fontWeight: '800', color: '#374151', fontSize: 13 },
  photoDeleteBtn: {
    paddingVertical: 9,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  clearPhoto: { fontWeight: '800', color: '#DC2626', fontSize: 13 },
  photoPreviewWrap: {
    marginTop: 2,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  photoPreviewLoading: { height: 80 },

  input: {
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    fontWeight: '700',
    color: '#111827',
  },

  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  navGhost: {
    width: 76,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navGhostText: { fontSize: 15, fontWeight: '800' },
  bottomHint: { fontWeight: '900', color: '#111827', fontSize: 16 },
  bottomSub: { marginTop: 4, color: '#6B7280', fontWeight: '700', fontSize: 12 },
  reasonGroupTitle: {
    fontWeight: '900',
    color: '#4B5563',
    fontSize: 13,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  closeButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
  },
  closeButtonText: {
    fontWeight: '900',
    color: '#2563EB',
    fontSize: 14,
  },
  scanButton: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#E8F1FF',
    borderWidth: 1,
    borderColor: '#77A7FF',
    minWidth: 72,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scanButtonText: {
    fontWeight: '900',
    color: '#2563EB',
    fontSize: 14,
  },
  pasteButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  pasteButtonText: {
    fontWeight: '900',
    color: '#374151',
    fontSize: 13,
  },
  pasteModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  pasteModalSheet: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 28,
    maxHeight: '88%',
  },
  pasteModalTitle: { fontSize: 17, fontWeight: '900', color: '#111827', marginBottom: 8 },
  pasteModalHint: { fontSize: 13, color: '#6B7280', fontWeight: '600', marginBottom: 12, lineHeight: 18 },
  pasteModalInput: {
    minHeight: 160,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 12,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  pasteModalActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'flex-end' },
  pasteModalSecondary: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  pasteModalSecondaryText: { fontWeight: '800', color: '#4B5563', fontSize: 14 },
  pasteModalPrimary: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#2563EB',
  },
  pasteModalPrimaryText: { fontWeight: '900', color: '#fff', fontSize: 14 },
  dateButton: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
  dateButtonText: {
    fontWeight: '800',
    color: '#111827',
    fontSize: 14,
  },
  datePickerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  datePickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  datePickerContent: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 20,
  },
  datePickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  datePickerCancel: {
    fontWeight: '700',
    color: '#6B7280',
    fontSize: 14,
  },
  datePickerTitle: {
    fontWeight: '900',
    color: '#111827',
    fontSize: 16,
  },
  datePickerConfirm: {
    fontWeight: '900',
    color: '#2563EB',
    fontSize: 14,
  },
  webDateTimeWrap: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  webDateTimeLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#6B7280',
    marginBottom: 6,
  },
  webDatePreview: {
    marginTop: 14,
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    lineHeight: 20,
  },
  webDatePanel: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
});
