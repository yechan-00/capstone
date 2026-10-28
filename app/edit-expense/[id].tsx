import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import { CATEGORIES, CategoryKey } from '@/lib/expenseOptions';
import {
  ADD_STEP_BAR_LABELS,
  ADD_STEPS,
  LAST_STEP,
  MEAL_TAG_PRESETS,
  QUICK_AMOUNTS_STEP,
  REASON_CHIP_ROWS,
  TAG_PRESETS,
  formatAmountInput,
  formatExpenseFormDateTime as formatDateTime,
  parseAmount,
  toKoreanMoney,
  unformat,
} from '@/lib/expenseForm';
import { scanReceiptImage } from '@/services/geminiService';
import { buildManualExpensePayload } from '@/services/expenseInput/manualExpensePayload';
import { scanResultToFormPatch, type ScanFormPatch } from '@/services/expenseInput/fromScanResult';
import { parsePastedExpenseText } from '@/services/expenseInput/fromPastedText';
import {
  getR2ImageApiBaseUrl,
  saveEditedExpensePhotos,
} from '@/services/storageService';
import {
  cloneEditablePhotos,
  editablePhotosFromExpense,
  expenseHasImageUrlsField,
  localEditablePhotos,
  mergeEditableExpensePhotos,
  remainingEditablePhotoSlots,
  removeEditableExpensePhoto,
  setCoverEditableExpensePhoto,
  type EditableExpensePhoto,
} from '@/utils/editableExpensePhotos';
import { MAX_EXPENSE_PHOTOS } from '@/utils/pendingExpensePhotos';
import { ExpensePhotoStrip } from '@/components/expenseForm/ExpensePhotoStrip';
import { scheduleRiskAwarenessAfterExpense } from '@/services/riskSpendingNotification';
import { useTheme } from '@/theme/ThemeContext';
import { expenseFormStyles } from '@/theme/expenseFormStyles';
import {
  amountKeyboardProps,
  koreanTextInputProps,
  useIosKoreanFieldTransition,
} from '@/lib/koreanTextInput';

export default function EditExpenseScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { user, account } = useAuth();
  const { updateExpense } = useExpenses();
  const [loaded, setLoaded] = React.useState(false);
  const { colors, isDark } = useTheme();
  const amountRef = useRef<TextInput>(null);
  const itemRef = useRef<TextInput>(null);
  const { markFromFocused, handleKoreanFieldFocus } = useIosKoreanFieldTransition(amountRef);

  const [amountText, setAmountText] = useState('');
  const amount = useMemo(() => parseAmount(amountText), [amountText]);

  const [category, setCategory] = useState<CategoryKey>('takeout');
  const [reasons, setReasons] = useState<string[]>([]);
  const [customReason, setCustomReason] = useState('');
  const [reasonDetail, setReasonDetail] = useState('');
  const [step, setStep] = useState(0);
  const [item, setItem] = useState('');
  const [summaryLine, setSummaryLine] = useState('');
  const [tagsText, setTagsText] = useState('');
  const [photos, setPhotos] = useState<EditableExpensePhoto[]>([]);
  const originalPhotosRef = useRef<EditableExpensePhoto[]>([]);
  const hadImageUrlsFieldRef = useRef(false);
  const [spentAt, setSpentAt] = useState(new Date());
  const [tempSpentAt, setTempSpentAt] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerPhase, setDatePickerPhase] = useState<'date' | 'time'>('date');
  const [saving, setSaving] = useState(false);
  const savingLockRef = useRef(false);
  const [scanning, setScanning] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteBuffer, setPasteBuffer] = useState('');
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
      setSpentAt(expense.spentAt ?? new Date());
      setTempSpentAt(expense.spentAt ?? new Date());
      const loadedPhotos = editablePhotosFromExpense(expense);
      originalPhotosRef.current = cloneEditablePhotos(loadedPhotos);
      hadImageUrlsFieldRef.current = expenseHasImageUrlsField(expense);
      setPhotos(loadedPhotos);
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
      mediaTypes: ['images'],
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
      mediaTypes: ['images'],
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
    if (savingLockRef.current) return;
    const remaining = remainingEditablePhotoSlots(photos);
    if (remaining <= 0) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('사진 권한 필요', '설정에서 사진 접근 권한을 허용해 주세요.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      orderedSelection: true,
      quality: 1,
    });
    if (result.canceled) return;

    const incoming: EditableExpensePhoto[] = (result.assets ?? [])
      .filter((asset) => typeof asset.uri === 'string' && asset.uri.length > 0)
      .map((asset) => ({
        id: asset.assetId || asset.uri,
        kind: 'local' as const,
        uri: asset.uri,
      }));
    if (incoming.length === 0) return;
    if (incoming.length > remaining) {
      Alert.alert('사진 제한', '사진은 최대 5장까지 추가할 수 있어요.');
    }
    setPhotos((current) => mergeEditableExpensePhotos(current, incoming));
  };

  const handleRemovePhoto = (id: string) => {
    if (savingLockRef.current) return;
    setPhotos((current) => removeEditableExpensePhoto(current, id));
  };

  const handleSetCoverPhoto = (id: string) => {
    if (savingLockRef.current) return;
    setPhotos((current) => setCoverEditableExpensePhoto(current, id));
  };

  const toggleMealTag = (tag: (typeof MEAL_TAG_PRESETS)[number]) => {
    const parts = tagsText
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    const withoutMeals = parts.filter((t) => !(MEAL_TAG_PRESETS as readonly string[]).includes(t));
    const has = parts.includes(tag);
    const next = has ? withoutMeals : [...withoutMeals, tag];
    setTagsText(next.join(', '));
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
    setDatePickerPhase('date');
    setShowDatePicker(true);
  };

  const handleDatePickerConfirm = () => {
    if (datePickerPhase === 'date') {
      setDatePickerPhase('time');
      return;
    }
    setSpentAt(tempSpentAt);
    setShowDatePicker(false);
  };

  const handleDatePickerCancel = () => {
    if (datePickerPhase === 'time') {
      setDatePickerPhase('date');
      return;
    }
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

  React.useEffect(() => {
    if (step !== 0) return undefined;
    const t = setTimeout(() => amountRef.current?.focus(), 150);
    return () => clearTimeout(t);
  }, [step]);

  const categoryLabel = useMemo(
    () => CATEGORIES.find((c) => c.key === category)?.label ?? category,
    [category],
  );

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
    if (savingLockRef.current) return;
    savingLockRef.current = true;

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

      const payload = buildManualExpensePayload({
        amount,
        category,
        item: item.trim(),
        reason: resolvedReason,
        tags,
        spentAt,
        sourceType: 'manual',
        sourceRef: null,
        summaryLine: summaryLine.trim() || undefined,
      });

      await updateExpense(id, {
        amount: payload.amount,
        category: payload.category,
        item: payload.item,
        reason: payload.reason,
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

      const locals = localEditablePhotos(photos);
      if (locals.length > 0 && !getR2ImageApiBaseUrl()) {
        Alert.alert(
          '사진 서버 없음',
          '다른 수정은 저장됐어요. 사진은 EXPO_PUBLIC_R2_IMAGE_API_URL 설정 후 다시 올려 주세요. 기존 사진은 그대로 두었어요.',
        );
      } else {
        const photoResult = await saveEditedExpensePhotos(
          user?.uid ?? null,
          expenseId,
          photos,
          originalPhotosRef.current,
          hadImageUrlsFieldRef.current,
          updateExpense,
        );
        if (photoResult.status === 'kept-original') {
          Alert.alert(
            '사진 저장 실패',
            '새 사진을 올리지 못해서 기존 사진 목록을 그대로 두었어요. 금액 등 다른 수정은 저장됐어요.',
          );
        } else if (photoResult.status === 'saved' && !photoResult.persisted) {
          Alert.alert(
            '사진 연결 실패',
            '사진은 일부 올라갔을 수 있지만 기록에 연결하지 못했어요. 기존 사진 정보는 그대로입니다. 다른 수정은 저장됐어요.',
          );
        } else if (photoResult.status === 'saved' && photoResult.failedLocalCount > 0) {
          Alert.alert(
            '일부 사진 저장 실패',
            `새 사진 ${photoResult.totalLocal}장 중 ${photoResult.totalLocal - photoResult.failedLocalCount}장만 저장했어요. 기존 사진과 성공한 사진만 반영됐어요.`,
          );
        }
      }

      router.replace('/(tabs)');
    } catch (e) {
      console.error('[expense] create failed', e);
      Alert.alert('저장 실패', `저장하지 못했어요. 오류: ${e instanceof Error ? e.message : '알 수 없는 오류'}`);
    } finally {
      setSaving(false);
      savingLockRef.current = false;
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
                {...amountKeyboardProps}
                onFocus={markFromFocused}
                placeholder="0"
                placeholderTextColor={colors.placeholder}
                blurOnSubmit
                onSubmitEditing={() => handleKoreanFieldFocus(itemRef)}
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
                ref={itemRef}
                value={item}
                onChangeText={setItem}
                placeholder="예: 아메리카노, 치킨 반마리"
                placeholderTextColor={colors.placeholder}
                onFocus={() => handleKoreanFieldFocus(itemRef)}
                {...koreanTextInputProps}
                returnKeyType="done"
                blurOnSubmit
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
              <View style={styles.addSectionLabelRow}>
                <Text style={[styles.labelThemed, { color: colors.textMuted }]}>사진</Text>
                <Text style={[styles.addPhotoCount, { color: colors.textSec }]}>
                  {photos.length}/{MAX_EXPENSE_PHOTOS}장
                </Text>
              </View>
              <Text style={[styles.addPhotoGuide, { color: colors.textMuted }]}>
                사진은 최대 5장까지 추가할 수 있어요.
              </Text>
              <Text style={[styles.addPhotoGuide, { color: colors.textMuted }]}>
                첫 번째 사진이 홈과 목록에 표시돼요.
              </Text>
              {photos.length === 0 ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.addPhotoEmpty,
                    {
                      borderColor: colors.border,
                      backgroundColor: colors.surfaceMuted,
                      opacity: saving ? 0.6 : pressed ? 0.94 : 1,
                    },
                  ]}
                  onPress={handleAttachPhoto}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel="사진 추가"
                >
                  <MaterialIcons name="photo-library" size={22} color={colors.textMuted} />
                  <Text style={[styles.addPhotoEmptyTitle, { color: colors.text }]}>사진 추가</Text>
                  <Text style={[styles.addPhotoEmptyHint, { color: colors.textMuted }]}>
                    선택 사항 · 여러 장 선택 가능
                  </Text>
                </Pressable>
              ) : (
                <ExpensePhotoStrip
                  photos={photos}
                  saving={saving}
                  onAdd={handleAttachPhoto}
                  onRemove={handleRemovePhoto}
                  onSetCover={handleSetCoverPhoto}
                  colors={{
                    border: colors.border,
                    surface: colors.surface,
                    surfaceMuted: colors.surfaceMuted,
                    text: colors.text,
                    textMuted: colors.textMuted,
                    textSecondary: colors.textSec,
                    accent: colors.accentCta,
                    accentText: colors.primary,
                    onAccent: colors.onPrimary,
                    danger: colors.logoutText,
                  }}
                />
              )}
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
                  <Text style={[styles.contextTitle, { color: colors.text, marginTop: 2 }]}>소비 이유</Text>
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
                  {MEAL_TAG_PRESETS.map((tag) => (
                    <Chip
                      key={tag}
                      compact
                      soft
                      style={[styles.equalChipCell, styles.softChipCell]}
                      label={tag}
                      active={tagsText.split(',').some((t) => t.trim() === tag)}
                      onPress={() => toggleMealTag(tag)}
                    />
                  ))}
                </View>
                <View style={[styles.equalChipRow, styles.tagPresetSecondRow]}>
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
                저장하면 다음 날 0시부터 47시간 59분 안에 평가할 수 있어요. 알림은 설정한 시간에 보내드려요.
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
                <Text style={styles.datePickerCancel}>
                  {datePickerPhase === 'time' ? '이전' : '취소'}
                </Text>
              </Pressable>
              <Text style={styles.datePickerTitle}>
                {datePickerPhase === 'date' ? '날짜 선택' : '시간 선택'}
              </Text>
              <Pressable onPress={handleDatePickerConfirm}>
                <Text style={styles.datePickerConfirm}>
                  {datePickerPhase === 'date' ? '다음' : '완료'}
                </Text>
              </Pressable>
            </View>
            <View style={styles.webDateTimeWrap}>
              {datePickerPhase === 'date' ? (
                <>
                  <Text style={styles.webDateTimeLabel}>날짜</Text>
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
                </>
              ) : (
                <>
                  <Text style={styles.webDateTimeLabel}>시간 (24시간)</Text>
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
                </>
              )}
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
                    <Text style={styles.datePickerCancel}>
                      {datePickerPhase === 'time' ? '이전' : '취소'}
                    </Text>
                  </Pressable>
                  <Text style={styles.datePickerTitle}>
                    {datePickerPhase === 'date' ? '날짜 선택' : '시간 선택'}
                  </Text>
                  <Pressable onPress={handleDatePickerConfirm}>
                    <Text style={styles.datePickerConfirm}>
                      {datePickerPhase === 'date' ? '다음' : '완료'}
                    </Text>
                  </Pressable>
                </View>
                <View style={{ paddingBottom: 20 }}>
                  <SpentAtDateTimePickers
                    phase={datePickerPhase}
                    value={tempSpentAt}
                    onChange={setTempSpentAt}
                    textColor={colors.text}
                    themeVariant={isDark ? 'dark' : 'light'}
                  />
                </View>
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

const styles = {
  ...expenseFormStyles,
  ...StyleSheet.create({
    confirmRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      gap: 12,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    confirmVal: { flex: 1, fontSize: 14, fontWeight: '700', textAlign: 'right' },
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
  }),
};
