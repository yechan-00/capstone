// @refresh reset
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
import { useRouter, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { useExpenses } from '@/hooks/useExpenses';
import { useAuth } from '@/hooks/useAuth';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SpentAtDateTimePickers } from '@/components/SpentAtDateTimePickers';
import { CATEGORIES, CategoryKey } from '@/lib/expenseOptions';

import {
  ADD_STEP_BAR_LABELS,
  LAST_STEP,
  MEAL_TAG_PRESETS,
  QUICK_AMOUNTS_STEP,
  REASON_CHIP_ROWS,
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
  attachUploadedExpenseImageSlots,
  getR2ImageApiBaseUrl,
} from '@/services/storageService';
import {
  MAX_EXPENSE_PHOTOS,
  mergePendingExpensePhotos,
  remainingExpensePhotoSlots,
  removePendingExpensePhoto,
  setCoverPendingExpensePhoto,
  type PendingExpensePhoto,
} from '@/utils/pendingExpensePhotos';
import { ExpensePhotoStrip } from '@/components/expenseForm/ExpensePhotoStrip';
import { scheduleRiskAwarenessAfterExpense } from '@/services/riskSpendingNotification';
import { useTheme } from '@/theme/ThemeContext';
import { ADD_FORM_COLORS, expenseFormStyles as styles } from '@/theme/expenseFormStyles';
import {
  amountKeyboardProps,
  koreanTextInputProps,
  useIosKoreanFieldTransition,
} from '@/lib/koreanTextInput';

const TAG_ROW_MEAL = ['아침', '점심', '저녁', '야식'] as const;
const TAG_ROW_CONTEXT = ['데이트', '시발비용', '보상', '스트레스'] as const;

function pairsOf<T>(items: readonly T[]): T[][] {
  const rows: T[][] = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2) as T[]);
  return rows;
}

export default function AddExpenseScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ amount?: string; category?: string; item?: string }>();
  const { user, account } = useAuth();
  const { createExpense, updateExpense } = useExpenses();
  const { colors, isDark } = useTheme();
  const addColors = {
    accent: ADD_FORM_COLORS.accent,
    accentText: isDark ? ADD_FORM_COLORS.accent : ADD_FORM_COLORS.accentText,
    cta: isDark ? ADD_FORM_COLORS.accent : ADD_FORM_COLORS.cta,
    selectedMint: isDark ? '#1A2E24' : ADD_FORM_COLORS.selectedMint,
    infoMint: isDark ? colors.surfaceMuted : ADD_FORM_COLORS.infoMint,
    infoBorder: isDark ? colors.border : ADD_FORM_COLORS.infoBorder,
    chipIdle: isDark ? colors.surfaceMuted : ADD_FORM_COLORS.chipIdle,
    inputBorder: isDark ? colors.borderInput : ADD_FORM_COLORS.inputBorder,
    divider: isDark ? colors.border : ADD_FORM_COLORS.divider,
    bg: isDark ? colors.bg : ADD_FORM_COLORS.bg,
    surface: isDark ? colors.surface : ADD_FORM_COLORS.surface,
    text: isDark ? colors.text : ADD_FORM_COLORS.text,
    textSecondary: isDark ? colors.textSec : ADD_FORM_COLORS.textSecondary,
    textMuted: isDark ? colors.textMuted : ADD_FORM_COLORS.textMuted,
    onPrimary: ADD_FORM_COLORS.onPrimary,
    border: isDark ? colors.border : ADD_FORM_COLORS.border,
  };
  const amountRef = useRef<TextInput>(null);
  const itemRef = useRef<TextInput>(null);
  const { markFromFocused, handleKoreanFieldFocus } = useIosKoreanFieldTransition(amountRef);

  const [amountText, setAmountText] = useState(params.amount ?? '');
  const amount = useMemo(() => parseAmount(amountText), [amountText]);

  const [category, setCategory] = useState<CategoryKey>((params.category as CategoryKey) ?? 'takeout');
  const [reasons, setReasons] = useState<string[]>([]);
  const [customReason, setCustomReason] = useState('');
  const [reasonDetail, setReasonDetail] = useState('');
  const [step, setStep] = useState(0);
  const [maxReachedStep, setMaxReachedStep] = useState(0);
  const [item, setItem] = useState(params.item ?? '');
  const [itemFocused, setItemFocused] = useState(false);
  const [memoFocused, setMemoFocused] = useState(false);
  const [tagsFocused, setTagsFocused] = useState(false);
  const [customReasonFocused, setCustomReasonFocused] = useState(false);
  const [summaryLine, setSummaryLine] = useState('');
  const [formNotice, setFormNotice] = useState<string | null>(null);
  const [tagsText, setTagsText] = useState('');
  const [photos, setPhotos] = useState<PendingExpensePhoto[]>([]);
  const [spentAt, setSpentAt] = useState(new Date());
  const [tempSpentAt, setTempSpentAt] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [datePickerPhase, setDatePickerPhase] = useState<'date' | 'time'>('date');
  const [saving, setSaving] = useState(false);
  const savingLockRef = useRef(false);
  const [scanning, setScanning] = useState(false);
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteBuffer, setPasteBuffer] = useState('');
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
    if (savingLockRef.current) return;
    const remaining = remainingExpensePhotoSlots(photos);
    if (remaining <= 0) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('사진 권한 필요', '설정에서 사진 접근 권한을 허용해 주세요.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      orderedSelection: true,
      quality: 1,
    });
    if (result.canceled) return;

    const incoming: PendingExpensePhoto[] = (result.assets ?? [])
      .filter((asset) => typeof asset.uri === 'string' && asset.uri.length > 0)
      .map((asset) => ({
        id: asset.assetId || asset.uri,
        uri: asset.uri,
      }));
    if (incoming.length === 0) return;
    if (incoming.length > remaining) {
      Alert.alert('사진 제한', '사진은 최대 5장까지 추가할 수 있어요.');
    }
    setPhotos((current) => mergePendingExpensePhotos(current, incoming));
  };

  const handleRemovePhoto = (id: string) => {
    if (savingLockRef.current) return;
    setPhotos((current) => removePendingExpensePhoto(current, id));
  };

  const handleSetCoverPhoto = (id: string) => {
    if (savingLockRef.current) return;
    setPhotos((current) => setCoverPendingExpensePhoto(current, id));
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

  const jumpToStep = (target: number) => {
    if (target === LAST_STEP && amount <= 0) {
      setFormNotice('금액을 입력해 주세요.');
      return;
    }
    Keyboard.dismiss();
    setStep(target);
  };

  const renderConfirmEditRow = (
    label: string,
    value: string,
    targetStep: number,
    valueColor: string = addColors.text,
    valueWeight: '600' | '700' | '800' = '600',
  ) => (
    <Pressable
      key={label}
      style={({ pressed }) => [
        styles.addConfirmRow,
        { borderBottomColor: addColors.divider, opacity: pressed ? 0.92 : 1 },
      ]}
      onPress={() => jumpToStep(targetStep)}
      accessibilityRole="button"
      accessibilityLabel={`${label} 수정`}
    >
      <Text style={[styles.addConfirmKey, { color: addColors.textSecondary }]}>{label}</Text>
      <View style={styles.confirmValWrap}>
        <Text
          style={[styles.addConfirmVal, { color: valueColor, fontWeight: valueWeight }]}
          numberOfLines={4}
        >
          {value}
        </Text>
        <MaterialIcons name="chevron-right" size={18} color={addColors.textMuted} />
      </View>
    </Pressable>
  );

  const goNext = () => {
    if (!canAdvanceFromStep(step)) {
      setFormNotice('금액을 입력해 주세요.');
      return;
    }
    Keyboard.dismiss();
    const nextStep = Math.min(step + 1, LAST_STEP);
    setStep(nextStep);
    setMaxReachedStep((prev) => Math.max(prev, nextStep));
  };

  const goBack = () => {
    Keyboard.dismiss();
    setStep((prev) => Math.max(0, prev - 1));
  };

  const renderGridCell = (
    label: string,
    active: boolean,
    onPress: () => void,
    variant: 'reason' | 'tag',
  ) => (
    <Pressable
      key={label}
      onPress={onPress}
      style={({ pressed }) => [
        variant === 'tag' ? styles.addTagCell : styles.addReasonCell,
        {
          backgroundColor: active ? addColors.selectedMint : addColors.chipIdle,
          borderColor: active ? addColors.accent : addColors.border,
          opacity: pressed ? 0.94 : 1,
        },
      ]}
    >
      <Text
        style={[
          variant === 'tag' ? styles.addTagChipText : styles.addFormChipText,
          { color: active ? addColors.accentText : addColors.text },
        ]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
      >
        {label}
      </Text>
    </Pressable>
  );

  const canSave = amount > 0 && !!category;

  const onSave = async () => {
    if (!canSave) {
      setFormNotice('금액과 카테고리를 입력해 주세요.');
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
        imageUrl: null,
        imageUrls: [],
      });

      if (photos.length > 0 && !getR2ImageApiBaseUrl()) {
        Alert.alert(
          '사진 서버 없음',
          '사진이 있어 저장을 중단했어요. EXPO_PUBLIC_R2_IMAGE_API_URL을 설정한 뒤 다시 시도해 주세요.',
        );
        return;
      }

      const createdExpenseId = await createExpense(payload);

      void scheduleRiskAwarenessAfterExpense({
        amount,
        category,
        tags,
        reason: resolvedReason,
        spentAt,
        account,
      });

      if (user?.uid && photos.length > 0) {
        const result = await attachUploadedExpenseImageSlots(
          user.uid,
          createdExpenseId,
          photos.map((photo) => photo.uri),
          updateExpense,
        );
        if (!result.persisted && result.imageUrls.length > 0) {
          Alert.alert(
            '사진 연결 실패',
            '사진은 올라갔지만 기록에 연결하지 못했어요. 소비 기록은 저장됐어요. 수정 화면에서 사진을 다시 올려 주세요.',
          );
        } else if (result.failedCount > 0 && result.imageUrls.length > 0) {
          Alert.alert(
            '일부 사진 저장 실패',
            `사진 ${result.total}장 중 ${result.imageUrls.length}장만 저장됐어요. 소비 기록은 저장됐어요.`,
          );
        } else if (result.total > 0 && result.imageUrls.length === 0) {
          Alert.alert(
            '사진 저장 실패',
            '사진은 저장하지 못했어요. 소비 기록은 저장됐어요. 수정 화면에서 사진을 다시 올려 주세요.',
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

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: addColors.bg }]} edges={['left', 'right']}>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <View style={[styles.addHeader, { backgroundColor: addColors.bg, borderBottomColor: addColors.border }]}>
        <View style={[styles.addHeaderInner, { paddingTop: insets.top + 6 }]}>
          <View style={styles.addHeaderRow}>
            <Text style={[styles.addHeaderTitle, { color: addColors.text }]}>소비 추가</Text>
            <View style={styles.addHeaderActions}>
              <Pressable
                style={({ pressed }) => [
                  styles.addHeaderUtilBtn,
                  {
                    backgroundColor: pressed || scanning ? addColors.selectedMint : addColors.chipIdle,
                    opacity: scanning ? 0.7 : 1,
                  },
                ]}
                onPress={handleScanPress}
                disabled={scanning}
                accessibilityRole="button"
                accessibilityLabel="영수증 스캔"
              >
                {scanning ? (
                  <ActivityIndicator size="small" color={addColors.textMuted} />
                ) : (
                  <>
                    <MaterialIcons name="document-scanner" size={16} color={addColors.textMuted} />
                    <Text style={[styles.addHeaderUtilText, { color: addColors.textMuted }]}>스캔</Text>
                  </>
                )}
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.addHeaderUtilBtn,
                  { backgroundColor: pressed ? addColors.selectedMint : addColors.chipIdle },
                ]}
                onPress={openPasteModal}
                accessibilityRole="button"
                accessibilityLabel="문자 붙여넣기"
              >
                <MaterialIcons name="content-paste" size={16} color={addColors.textMuted} />
                <Text style={[styles.addHeaderUtilText, { color: addColors.textMuted }]}>붙여넣기</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.addHeaderCloseBtn, pressed && { opacity: 0.7 }]}
                onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
                accessibilityRole="button"
                accessibilityLabel="닫기"
              >
                <MaterialIcons name="close" size={18} color={addColors.textMuted} />
              </Pressable>
            </View>
          </View>

          <View style={styles.addStepper}>
            <View style={styles.addStepperVisual} pointerEvents="none">
              <View style={[styles.addStepperTrackBase, { backgroundColor: addColors.border }]} />
              <View
                style={[
                  styles.addStepperTrackFill,
                  {
                    backgroundColor: addColors.accent,
                    width: `${(maxReachedStep / LAST_STEP) * 75}%`,
                  },
                ]}
              />
              {ADD_STEP_BAR_LABELS.map((barLabel, i) => {
                const active = i === step;
                const reachable = i <= maxReachedStep;
                return (
                  <View key={barLabel} style={styles.addStepperCircleCol}>
                    <View
                      style={[
                        styles.addStepperCircle,
                        {
                          borderColor: active || reachable ? addColors.accent : addColors.border,
                          backgroundColor: active ? addColors.accent : addColors.surface,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.addStepperNum,
                          {
                            color: active
                              ? addColors.onPrimary
                              : reachable
                                ? addColors.accent
                                : addColors.textMuted,
                          },
                        ]}
                      >
                        {i + 1}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
            <View style={styles.addStepperLabelRow} pointerEvents="none">
              {ADD_STEP_BAR_LABELS.map((barLabel, i) => {
                const active = i === step;
                const reachable = i <= maxReachedStep;
                return (
                  <View key={barLabel} style={styles.addStepperLabelCell}>
                    <Text
                      style={[
                        styles.addStepperLabel,
                        {
                          color: active
                            ? addColors.accentText
                            : reachable
                              ? addColors.text
                              : addColors.textMuted,
                          fontWeight: active ? '600' : '500',
                        },
                      ]}
                      numberOfLines={1}
                    >
                      {barLabel}
                    </Text>
                  </View>
                );
              })}
            </View>
            <View style={styles.addStepperHitRow}>
              {ADD_STEP_BAR_LABELS.map((barLabel, i) => {
                const reachable = i <= maxReachedStep;
                return (
                  <Pressable
                    key={barLabel}
                    collapsable={false}
                    onPress={() => {
                      if (i <= maxReachedStep) jumpToStep(i);
                    }}
                    disabled={!reachable}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !reachable, selected: i === step }}
                    accessibilityLabel={`${i + 1} ${barLabel}`}
                    style={({ pressed }) => [
                      styles.addStepperHitCell,
                      { opacity: pressed && reachable ? 0.85 : 1 },
                    ]}
                  />
                );
              })}
            </View>
          </View>
        </View>
      </View>

      <View style={[styles.addPageBody, { backgroundColor: addColors.bg }]}>
      <KeyboardAvoidingView
        style={[styles.pageBodyInner, { backgroundColor: addColors.bg }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={[styles.container, { backgroundColor: addColors.bg }]}
        contentContainerStyle={[
          styles.content,
          step === 0 ? styles.amountContent : styles.addStepContent,
          { paddingBottom: 128 + insets.bottom + (step === 2 ? 24 : 0) },
        ]}
        scrollEnabled
        bounces={step !== 0}
        alwaysBounceVertical={false}
        showsVerticalScrollIndicator={false}
      >
        {step === 0 ? (
          <View style={styles.amountStep}>
            <View
              style={[
                styles.addHint,
                {
                  backgroundColor: addColors.infoMint,
                  borderColor: addColors.infoBorder,
                },
              ]}
            >
              <Text style={[styles.addHintTitle, { color: addColors.textSecondary }]}>
                식사·간식 후에 기록해 주세요
              </Text>
              <Text style={[styles.addHintBody, { color: addColors.textMuted }]}>
                한 끼가 끝난 뒤 기록하면 더 정확히 돌아볼 수 있어요.
              </Text>
            </View>

            <View style={styles.amountFieldBlock}>
              <Text style={[styles.amountStepTitle, { color: addColors.text }]}>얼마를 썼나요?</Text>
              <View
                style={[
                  styles.amountHeroRow,
                  { borderBottomColor: addColors.divider },
                ]}
              >
                <TextInput
                  ref={amountRef}
                  value={formatAmountInput(amountText)}
                  onChangeText={(t) => setAmountText(unformat(t))}
                  {...amountKeyboardProps}
                  onFocus={markFromFocused}
                  placeholder="0"
                  placeholderTextColor={addColors.textMuted}
                  blurOnSubmit
                  onSubmitEditing={() => handleKoreanFieldFocus(itemRef)}
                  style={[
                    styles.amountHeroInput,
                    { color: amount > 0 ? addColors.text : addColors.textMuted },
                  ]}
                />
                <Text style={[styles.amountHeroUnit, { color: addColors.textMuted }]}>원</Text>
              </View>
              <View style={styles.amountQuickRow}>
                {QUICK_AMOUNTS_STEP.map((v) => (
                  <Pressable
                    key={v}
                    onPress={() => setAmountText(String(amount + v))}
                    style={({ pressed }) => [
                      styles.amountQuickChip,
                      {
                        backgroundColor: pressed ? addColors.selectedMint : addColors.surface,
                        borderColor: addColors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.amountQuickChipText, { color: addColors.text }]}>
                      +{toKoreanMoney(v)}
                    </Text>
                  </Pressable>
                ))}
                <Pressable
                  onPress={() => setAmountText('')}
                  style={({ pressed }) => [
                    styles.amountQuickChip,
                    {
                      backgroundColor: pressed ? addColors.chipIdle : addColors.surface,
                      borderColor: addColors.border,
                    },
                  ]}
                >
                  <Text style={[styles.amountQuickChipText, { color: addColors.textMuted }]}>초기화</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.amountFieldBlock}>
              <Text style={[styles.amountFieldLabel, { color: addColors.text }]}>어떤 소비였나요?</Text>
              <TextInput
                ref={itemRef}
                value={item}
                onChangeText={setItem}
                placeholder="아메리카노, 치킨 반마리"
                placeholderTextColor={addColors.textMuted}
                onFocus={() => {
                  handleKoreanFieldFocus(itemRef);
                  setItemFocused(true);
                }}
                onBlur={() => setItemFocused(false)}
                {...koreanTextInputProps}
                returnKeyType="done"
                blurOnSubmit
                style={[
                  styles.amountItemInput,
                  {
                    borderColor: itemFocused ? addColors.accent : addColors.inputBorder,
                    backgroundColor: addColors.surface,
                    color: addColors.text,
                  },
                ]}
              />
            </View>

            <View style={styles.amountFieldBlock}>
              <Text style={[styles.amountFieldLabel, { color: addColors.text }]}>유형</Text>
              <View style={styles.amountCategoryRow}>
                {CATEGORIES.map((c) => {
                  const active = c.key === category;
                  return (
                    <Pressable
                      key={c.key}
                      style={({ pressed }) => [
                        styles.amountCategoryPill,
                        {
                          backgroundColor: active ? addColors.selectedMint : addColors.surface,
                          borderColor: active ? addColors.accent : addColors.border,
                          opacity: pressed ? 0.94 : 1,
                        },
                      ]}
                      onPress={() => setCategory(c.key)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      accessibilityLabel={c.label}
                    >
                      <Text style={styles.amountCategoryEmoji} accessible={false}>{c.emoji}</Text>
                      <Text
                        style={[
                          styles.amountCategoryText,
                          { color: active ? addColors.accentText : addColors.text },
                        ]}
                        numberOfLines={2}
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
              styles.addSheet,
              { borderColor: addColors.border, backgroundColor: addColors.surface },
            ]}
          >
            <View>
              <Text style={[styles.addStepTitle, { color: addColors.text }]}>언제 결제했나요?</Text>
              <Text style={[styles.addStepHelper, { color: addColors.textSecondary }]}>
                사진은 선택이에요.
              </Text>
            </View>

            <View style={styles.addSection}>
              <Text style={[styles.addSectionLabel, { color: addColors.text }]}>거래 시간</Text>
              <Pressable
                style={({ pressed }) => [
                  styles.addTimeRow,
                  {
                    borderColor: addColors.inputBorder,
                    backgroundColor: addColors.surface,
                    opacity: pressed ? 0.94 : 1,
                  },
                ]}
                onPress={handleDatePickerOpen}
              >
                <Text style={[styles.addTimeValue, { color: addColors.text }]}>
                  {formatDateTime(spentAt).replace(/-/g, '.')}
                </Text>
                <MaterialIcons name="chevron-right" size={20} color={addColors.textMuted} />
              </Pressable>
            </View>

            <View style={styles.addSection}>
              <View style={styles.addSectionLabelRow}>
                <Text style={[styles.addSectionLabel, { color: addColors.text }]}>사진</Text>
                <Text style={[styles.addPhotoCount, { color: addColors.textSecondary }]}>
                  {photos.length}/{MAX_EXPENSE_PHOTOS}장
                </Text>
              </View>
              <Text style={[styles.addPhotoGuide, { color: addColors.textMuted }]}>
                사진은 최대 5장까지 추가할 수 있어요.
              </Text>
              <Text style={[styles.addPhotoGuide, { color: addColors.textMuted }]}>
                첫 번째 사진이 홈과 목록에 표시돼요.
              </Text>
              {photos.length === 0 ? (
                <Pressable
                  style={({ pressed }) => [
                    styles.addPhotoEmpty,
                    {
                      borderColor: addColors.border,
                      backgroundColor: addColors.chipIdle,
                      opacity: saving ? 0.6 : pressed ? 0.94 : 1,
                    },
                  ]}
                  onPress={handleAttachPhoto}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel="사진 추가"
                >
                  <MaterialIcons name="photo-library" size={22} color={addColors.textMuted} />
                  <Text style={[styles.addPhotoEmptyTitle, { color: addColors.text }]}>사진 추가</Text>
                  <Text style={[styles.addPhotoEmptyHint, { color: addColors.textMuted }]}>
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
                    border: addColors.border,
                    surface: addColors.surface,
                    surfaceMuted: addColors.chipIdle,
                    text: addColors.text,
                    textMuted: addColors.textMuted,
                    textSecondary: addColors.textSecondary,
                    accent: addColors.cta,
                    accentText: addColors.accentText,
                    onAccent: addColors.onPrimary,
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
              styles.addSheet,
              { borderColor: addColors.border, backgroundColor: addColors.surface },
            ]}
          >
            <View style={styles.addSection}>
              <View style={styles.addSectionLabelRow}>
                <Text style={[styles.addReasonQuestion, { color: addColors.text }]}>왜 샀나요?</Text>
                <Text style={[styles.addOptionalHint, { color: addColors.textMuted }]}>
                  선택 사항
                </Text>
              </View>
              <View style={styles.addGrid}>
                {pairsOf(REASON_CHIP_ROWS.flat()).map((row) => (
                  <View key={row.join('-')} style={styles.addGridRow}>
                    {row.map((reasonItem) =>
                      renderGridCell(reasonItem, reasons.includes(reasonItem), () => {
                        const selected = reasons.includes(reasonItem);
                        if (selected) {
                          setReasons((prev) => prev.filter((r) => r !== reasonItem));
                          if (reasonItem === '기타') setCustomReason('');
                        } else {
                          setReasons((prev) => [...prev, reasonItem]);
                          if (reasonItem !== '기타') setCustomReason('');
                        }
                      }, 'reason'),
                    )}
                  </View>
                ))}
              </View>
              {reasons.includes('기타') ? (
                <TextInput
                  value={customReason}
                  onChangeText={setCustomReason}
                  placeholder="기타 내용"
                  placeholderTextColor={addColors.textMuted}
                  onFocus={() => setCustomReasonFocused(true)}
                  onBlur={() => setCustomReasonFocused(false)}
                  {...koreanTextInputProps}
                  style={[
                    styles.addMemoInput,
                    {
                      borderColor: customReasonFocused ? addColors.accent : addColors.inputBorder,
                      backgroundColor: addColors.surface,
                      color: addColors.text,
                    },
                  ]}
                />
              ) : null}
            </View>

            <View style={styles.addSection}>
              <View style={styles.addSectionLabelRow}>
                <Text style={[styles.addSectionLabel, { color: addColors.text }]}>상황 메모</Text>
                <Text style={[styles.addOptionalHint, { color: addColors.textMuted }]}>선택</Text>
              </View>
              <TextInput
                value={reasonDetail}
                onChangeText={setReasonDetail}
                placeholder="예: 친구들과 저녁 약속이 있어서"
                placeholderTextColor={addColors.textMuted}
                onFocus={() => setMemoFocused(true)}
                onBlur={() => setMemoFocused(false)}
                {...koreanTextInputProps}
                style={[
                  styles.addMemoInput,
                  {
                    borderColor: memoFocused ? addColors.accent : addColors.inputBorder,
                    backgroundColor: addColors.surface,
                    color: addColors.text,
                  },
                ]}
              />
            </View>

            <View style={styles.addSection}>
              <Text style={[styles.addSectionLabel, { color: addColors.text }]}>태그</Text>
              <View style={styles.addGrid}>
                <View style={styles.addGridRow}>
                  {TAG_ROW_MEAL.map((tag) =>
                    renderGridCell(
                      tag,
                      tagsText.split(',').some((t) => t.trim() === tag),
                      () => {
                        if ((MEAL_TAG_PRESETS as readonly string[]).includes(tag)) {
                          toggleMealTag(tag as (typeof MEAL_TAG_PRESETS)[number]);
                        } else {
                          togglePresetTag(tag);
                        }
                      },
                      'tag',
                    ),
                  )}
                </View>
                <View style={styles.addGridRow}>
                  {TAG_ROW_CONTEXT.map((tag) =>
                    renderGridCell(
                      tag,
                      tagsText.split(',').some((t) => t.trim() === tag),
                      () => togglePresetTag(tag),
                      'tag',
                    ),
                  )}
                </View>
              </View>
              <TextInput
                value={tagsText}
                onChangeText={setTagsText}
                placeholder="직접 입력 · 쉼표로 구분"
                placeholderTextColor={addColors.textMuted}
                onFocus={() => setTagsFocused(true)}
                onBlur={() => setTagsFocused(false)}
                {...koreanTextInputProps}
                style={[
                  styles.addMemoInput,
                  {
                    borderColor: tagsFocused ? addColors.accent : addColors.inputBorder,
                    backgroundColor: addColors.surface,
                    color: addColors.text,
                  },
                ]}
              />
            </View>
          </View>
        ) : null}

        {step === 3 ? (
          <View
            style={[
              styles.addSheet,
              { borderColor: addColors.border, backgroundColor: addColors.surface },
            ]}
          >
            <View>
              <Text style={[styles.addStepTitle, { color: addColors.text }]}>이대로 저장할까요?</Text>
              <Text style={[styles.addStepHelper, { color: addColors.textSecondary }]}>
                수정할 항목을 누르면 해당 단계로 이동해요.
              </Text>
            </View>
            <View>
              {renderConfirmEditRow('금액', `₩${amount.toLocaleString()}`, 0, addColors.text, '700')}
              {renderConfirmEditRow('품목', item.trim() || '—', 0, addColors.text)}
              {renderConfirmEditRow('카테고리', categoryLabel, 0, addColors.text, '600')}
              {renderConfirmEditRow('시간', formatDateTime(spentAt), 1, addColors.text)}
              {renderConfirmEditRow(
                '사진',
                photos.length > 0 ? `${photos.length}장 · 첫 장이 대표` : '없음',
                1,
                addColors.text,
              )}
              {renderConfirmEditRow('이유', reasonPreview, 2, addColors.text)}
              {summaryLine.trim()
                ? renderConfirmEditRow('한줄평', summaryLine.trim(), 2, addColors.text)
                : null}
              {renderConfirmEditRow('태그', tagsText.trim() || '—', 2, addColors.text)}
            </View>
            <View
              style={[
                styles.addInfoNote,
                { backgroundColor: addColors.infoMint, borderColor: addColors.infoBorder },
              ]}
            >
              <Text style={[styles.addInfoNoteText, { color: addColors.textSecondary }]}>
                저장하면 다음 날 0시부터 47시간 59분 안에 평가할 수 있어요. 알림은 설정한 시간에 보내드려요.
              </Text>
            </View>
          </View>
        ) : null}

        <View style={{ height: 24 }} />
      </ScrollView>

      {showDatePicker && Platform.OS === 'web' && (
          <View style={[styles.webDatePanel, { backgroundColor: addColors.surface, borderColor: addColors.border }]}>
            <View style={[styles.datePickerHeader, { backgroundColor: addColors.surface, borderBottomColor: addColors.border }]}>
              <Pressable onPress={handleDatePickerCancel}>
                <Text style={[styles.datePickerCancel, { color: addColors.textMuted }]}>
                  {datePickerPhase === 'time' ? '이전' : '취소'}
                </Text>
              </Pressable>
              <Text style={[styles.datePickerTitle, { color: addColors.text }]}>
                {datePickerPhase === 'date' ? '날짜 선택' : '시간 선택'}
              </Text>
              <Pressable onPress={handleDatePickerConfirm}>
                <Text style={[styles.datePickerConfirm, { color: addColors.accent }]}>
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
              <View style={[styles.datePickerContent, { backgroundColor: addColors.surface }]}>
                <View style={[styles.datePickerHeader, { backgroundColor: addColors.surface, borderBottomColor: addColors.border }]}>
                  <Pressable onPress={handleDatePickerCancel}>
                    <Text style={[styles.datePickerCancel, { color: addColors.textMuted }]}>
                      {datePickerPhase === 'time' ? '이전' : '취소'}
                    </Text>
                  </Pressable>
                  <Text style={[styles.datePickerTitle, { color: addColors.text }]}>
                    {datePickerPhase === 'date' ? '날짜 선택' : '시간 선택'}
                  </Text>
                  <Pressable onPress={handleDatePickerConfirm}>
                    <Text style={[styles.datePickerConfirm, { color: addColors.accent }]}>
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
                    accentColor={addColors.accent}
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
                <Pressable
                  style={[styles.pasteModalPrimary, { backgroundColor: addColors.cta }]}
                  onPress={applyPaste}
                >
                  <Text style={styles.pasteModalPrimaryText}>적용</Text>
                </Pressable>
              </View>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal
        visible={formNotice != null}
        transparent
        animationType="fade"
        onRequestClose={() => setFormNotice(null)}
      >
        <View style={styles.addNoticeBackdrop}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setFormNotice(null)} />
          <View style={[styles.addNoticeCard, { backgroundColor: addColors.surface }]}>
            <Text style={[styles.addNoticeTitle, { color: addColors.text }]}>입력 확인</Text>
            <Text style={[styles.addNoticeMessage, { color: addColors.textSecondary }]}>
              {formNotice}
            </Text>
            <Pressable
              onPress={() => setFormNotice(null)}
              style={({ pressed }) => [
                styles.addNoticeButton,
                { backgroundColor: addColors.cta, opacity: pressed ? 0.92 : 1 },
              ]}
            >
              <Text style={[styles.addNoticeButtonText, { color: addColors.onPrimary }]}>확인</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <View
        style={[
          styles.bottomBar,
          {
            borderTopColor: addColors.border,
            backgroundColor: addColors.bg,
            paddingBottom: Math.max(insets.bottom, 10),
          },
        ]}
      >
        {step > 0 ? (
          <Pressable
            onPress={goBack}
            style={({ pressed }) => [
              styles.navGhost,
              { borderColor: addColors.border, backgroundColor: addColors.surface, opacity: pressed ? 0.94 : 1 },
            ]}
          >
            <Text style={[styles.navGhostText, { color: addColors.text }]}>이전</Text>
          </Pressable>
        ) : null}
        {step > 0 ? (
          <View style={{ flex: 1, minWidth: 0, paddingHorizontal: 8 }}>
            <Text style={[styles.addFooterHint, { color: addColors.text }]} numberOfLines={1}>
              {step === LAST_STEP
                ? '확인 후 저장'
                : amount > 0
                  ? `₩${amount.toLocaleString()}`
                  : ''}
            </Text>
            {item.trim() && step !== LAST_STEP ? (
              <Text style={[styles.addFooterSub, { color: addColors.textSecondary }]} numberOfLines={1}>
                {item.trim()}
              </Text>
            ) : null}
          </View>
        ) : null}
        <PrimaryButton
          label={step === LAST_STEP ? (saving ? '저장 중...' : '저장') : '다음'}
          onPress={step === LAST_STEP ? onSave : goNext}
          disabled={step === LAST_STEP ? saving || !canSave : saving}
          textColor={addColors.onPrimary}
          style={{
            minWidth: 112,
            height: 48,
            borderRadius: 12,
            flex: step === 0 ? 1 : undefined,
            flexShrink: 0,
            backgroundColor: addColors.cta,
          }}
        />
      </View>
      </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}
