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
import { SafeAreaView } from 'react-native-safe-area-context';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import * as Clipboard from 'expo-clipboard';
import { useExpenses } from '@/hooks/useExpenses';
import { useAuth } from '@/hooks/useAuth';
import { Chip } from '@/components/Chip';
import { AppCard } from '@/components/AppCard';
import { PrimaryButton } from '@/components/PrimaryButton';
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

export default function AddExpenseScreen() {
  const router = useRouter();
  const { user, account } = useAuth();
  const { createExpense, updateExpense } = useExpenses();
  const { colors } = useTheme();
  const amountRef = useRef<TextInput>(null);

  const [amountText, setAmountText] = useState('');
  const amount = useMemo(() => parseAmount(amountText), [amountText]);

  const [category, setCategory] = useState<CategoryKey>('takeout');
  const [reasons, setReasons] = useState<string[]>([]);
  const [customReason, setCustomReason] = useState('');
  const [reasonDetail, setReasonDetail] = useState('');
  const [mood, setMood] = useState<(typeof MOODS)[number]['key'] | null>(null);
  const [item, setItem] = useState('');
  const [summaryLine, setSummaryLine] = useState('');
  const [summaryEmoji, setSummaryEmoji] = useState('');
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

  const handleDateChange = (event: any, selectedDate?: Date) => {
    if (selectedDate) {
      setTempSpentAt(selectedDate);
    }
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
        summaryEmoji: summaryEmoji.trim() || undefined,
        imageUrl: null,
      });

      const expenseId = await createExpense(payload);

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

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={[styles.root, { backgroundColor: colors.bg }]}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={0}
      >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        style={[styles.container, { backgroundColor: colors.bg }]}
        contentContainerStyle={styles.content}
      >
        <AppCard style={{ paddingVertical: 12, backgroundColor: colors.surfaceMuted, borderColor: colors.border }}>
          <Text style={[styles.timingTitle, { color: colors.text }]}>식사·간식을 마친 뒤에 기록해 주세요</Text>
          <Text style={[styles.timingBody, { color: colors.textSec }]}>
            후회·만족은 보통 소비 직후나 잠시 지나야 드러나요. 가능하면 한 끼(또는 간식)가 끝난 뒤, 차분할 때
            적어 주세요.
          </Text>
        </AppCard>

        <View style={styles.headerRow}>
          <Text style={[styles.h1, { color: colors.text }]}>소비 추가</Text>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Pressable
              style={[styles.scanButton, scanning && { opacity: 0.6 }]}
              onPress={handleScanPress}
              disabled={scanning}
              accessibilityRole="button"
              accessibilityLabel="영수증 스캔"
            >
              {scanning ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.scanButtonText, { color: colors.primary }]}>📷 스캔</Text>
              )}
            </Pressable>
            <Pressable style={styles.pasteButton} onPress={openPasteModal} accessibilityRole="button" accessibilityLabel="문자 붙여넣기">
              <Text style={[styles.pasteButtonText, { color: colors.textSec }]}>📋 붙여넣기</Text>
            </Pressable>
            <Pressable
              style={styles.closeButton}
              onPress={() => (router.canGoBack() ? router.back() : router.replace('/(tabs)'))}
              accessibilityRole="button"
              accessibilityLabel="닫기"
            >
              <Text style={[styles.closeButtonText, { color: colors.primary }]}>닫기</Text>
            </Pressable>
          </View>
        </View>

        <AppCard style={{ paddingVertical: 14 }}>
          <Text style={styles.label}>금액</Text>
          <TextInput
            ref={amountRef}
            value={formatAmountInput(amountText)}
            onChangeText={(t) => setAmountText(unformat(t))}
            keyboardType="number-pad"
            placeholder="0"
            placeholderTextColor="#D1D5DB"
            style={styles.amountInput}
            autoFocus
          />

          <View style={styles.quickRow}>
            {QUICK_AMOUNTS.map((v) => (
              <Chip
                key={v}
                label={`+${toKoreanMoney(v)}`}
                onPress={() => setAmountText(String(amount + v))}
              />
            ))}
            <Chip label="초기화" onPress={() => setAmountText('')} />
          </View>

          <View style={{ gap: 10, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#E5E7EB' }}>
            <Text style={styles.label}>무엇을 샀는지 (품목)</Text>
            <TextInput
              value={item}
              onChangeText={setItem}
              placeholder="예: 아메리카노, 치킨 반마리, 편의점 도시락"
              placeholderTextColor="#D1D5DB"
              style={styles.input}
            />
          </View>

          <View style={{ gap: 10, marginTop: 14 }}>
            <Text style={styles.label}>사진 (선택)</Text>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
              <Pressable style={styles.attachButton} onPress={handleAttachPhoto}>
                <Text style={styles.attachButtonText}>{localImageUri ? '사진 바꾸기' : '갤러리에서 첨부'}</Text>
              </Pressable>
              {localImageUri ? (
                <Pressable onPress={() => setLocalImageUri(null)}>
                  <Text style={styles.clearPhoto}>삭제</Text>
                </Pressable>
              ) : null}
            </View>
            {localImageUri ? (
              <Text style={styles.photoHint} numberOfLines={1}>
                첨부됨 · 저장 시 클라우드에 올라가요
              </Text>
            ) : null}
          </View>

          <View style={{ gap: 10, marginTop: 16, paddingTop: 16, borderTopWidth: 1, borderTopColor: '#E5E7EB' }}>
            <Text style={styles.label}>거래 시간</Text>
            <Pressable
              style={styles.dateButton}
              onPress={handleDatePickerOpen}
            >
              <Text style={styles.dateButtonText}>{formatDateTime(spentAt)}</Text>
            </Pressable>
          </View>
        </AppCard>

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
              <Text style={styles.webDateTimeLabel}>날짜</Text>
              {React.createElement('input', {
                type: 'date',
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
              <Text style={[styles.webDateTimeLabel, { marginTop: 12 }]}>시간</Text>
              {React.createElement('input', {
                type: 'time',
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
                <DateTimePicker
                  value={tempSpentAt}
                  mode="datetime"
                  display="spinner"
                  onChange={handleDateChange}
                  textColor="#111827"
                />
              </View>
            </View>
          </Modal>
        )}

        <View style={{ gap: 8 }}>
          <Text style={styles.sectionTitleSmall}>카테고리</Text>
          <View style={styles.categoryRowCompact}>
            {CATEGORIES.map((c) => {
              const active = c.key === category;
              return (
                <Pressable
                  key={c.key}
                  style={[styles.categoryPill, active && styles.categoryPillActive]}
                  onPress={() => setCategory(c.key)}
                >
                  <Text style={styles.categoryPillEmoji}>{c.emoji}</Text>
                  <Text style={[styles.categoryPillText, active && styles.categoryPillTextActive]} numberOfLines={1}>
                    {c.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={{ gap: 16 }}>
            <View style={{ gap: 10 }}>
              <Text style={styles.sectionTitle}>소비 이유</Text>
              <Text style={styles.fieldHint}>칩을 고르고, 아래 칸에 상황을 자유롭게 적어 주세요.</Text>
              {REASON_GROUPS.map((group) => (
                <View key={group.title} style={{ gap: 8 }}>
                  <Text style={styles.reasonGroupTitle}>{group.title}</Text>
                  <View style={styles.chipWrap}>
                    {group.items.map((reasonItem) => (
                      <Chip
                        key={reasonItem}
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
                </View>
              ))}
              {reasons.includes('기타') && (
                <View style={{ gap: 10 }}>
                  <Text style={styles.sectionTitle}>기타 입력</Text>
                  <TextInput
                    value={customReason}
                    onChangeText={setCustomReason}
                    placeholder="예: 오늘 힘들었으니까 보상"
                    placeholderTextColor="#D1D5DB"
                    style={styles.input}
                  />
                </View>
              )}
              <TextInput
                value={reasonDetail}
                onChangeText={setReasonDetail}
                placeholder="소비 이유를 넉넉히 적어 보세요. 감정·상황이 섞여도 괜찮아요."
                placeholderTextColor="#D1D5DB"
                style={styles.reasonMultiline}
                multiline
                textAlignVertical="top"
              />
            </View>

            <View style={{ gap: 10 }}>
              <Text style={styles.sectionTitle}>당시 기분</Text>
              <View style={styles.chipWrap}>
                {MOODS.map((m) => (
                  <Chip
                    key={m.key}
                    label={`${m.emoji} ${m.label}`}
                    active={mood === m.key}
                    onPress={() => setMood(mood === m.key ? null : m.key)}
                  />
                ))}
              </View>
            </View>

            <View style={{ gap: 10 }}>
              <Text style={styles.sectionTitle}>한줄평 + 이모티콘</Text>
              <Text style={styles.fieldHint}>식후에 떠오른 한마디를 남겨 보세요.</Text>
              <View style={styles.inlineRow}>
                <TextInput
                  value={summaryEmoji}
                  onChangeText={setSummaryEmoji}
                  placeholder="😮"
                  placeholderTextColor="#D1D5DB"
                  style={styles.emojiInput}
                  maxLength={8}
                />
                <TextInput
                  value={summaryLine}
                  onChangeText={setSummaryLine}
                  placeholder="예: 배부른데 시켜서 후회"
                  placeholderTextColor="#D1D5DB"
                  style={[styles.input, styles.inlineFlex]}
                />
              </View>
            </View>

            <View style={{ gap: 10 }}>
              <Text style={styles.sectionTitle}>태그 (직접 입력 또는 빠른 선택)</Text>
              <View style={styles.chipWrap}>
                {TAG_PRESETS.map((tag) => (
                  <Chip
                    key={tag}
                    label={tag}
                    active={tagsText.split(',').some((t) => t.trim() === tag)}
                    onPress={() => togglePresetTag(tag)}
                  />
                ))}
              </View>
              <TextInput
                value={tagsText}
                onChangeText={setTagsText}
                placeholder="쉼표로 구분 · 예: 야식,데이트,충동"
                placeholderTextColor="#D1D5DB"
                style={styles.input}
              />
            </View>
          </View>

        <View style={{ height: 90 }} />
      </ScrollView>

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

      <View style={styles.bottomBar}>
        <View style={{ flex: 1 }}>
          <Text style={styles.bottomHint}>
            {amount > 0 ? `₩${amount.toLocaleString()}` : '금액 입력'}
            {item.trim() ? `  ${item.trim()}` : ''}
          </Text>
          <Text style={styles.bottomSub}>저장하면 3일 뒤 리뷰 알림이 잡혀요 (시각은 설정에서)</Text>
          <Text style={styles.bottomSub}>현재 리뷰 주기: D+{reviewDelayDays.join(', ')}</Text>
        </View>

        <PrimaryButton
          label={saving ? '저장 중...' : '저장'}
          onPress={onSave}
          disabled={saving}
          style={{ width: 120 }}
        />
      </View>
    </KeyboardAvoidingView>
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
  content: { padding: 16, paddingBottom: 20, gap: 16 },
  h1: { fontSize: 18, fontWeight: '900' },

  label: { fontSize: 13, fontWeight: '900', color: '#6B7280', marginBottom: 8 },
  amountInput: {
    height: 56,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 14,
    backgroundColor: '#fff',
    fontSize: 22,
    fontWeight: '900',
    color: '#111827',
  },

  quickRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  sectionTitle: { fontSize: 16, fontWeight: '900', color: '#111827' },
  sectionTitleSmall: { fontSize: 14, fontWeight: '900', color: '#6B7280' },
  timingTitle: { fontWeight: '900', fontSize: 15, marginBottom: 6 },
  timingBody: { fontWeight: '600', fontSize: 13, lineHeight: 20 },
  fieldHint: { fontSize: 12, fontWeight: '600', color: '#9CA3AF' },

  categoryRowCompact: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E5E7EB',
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

  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },

  reasonMultiline: {
    minHeight: 120,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 12,
    backgroundColor: '#fff',
    fontWeight: '700',
    color: '#111827',
    fontSize: 15,
    lineHeight: 22,
  },

  inlineRow: { flexDirection: 'row', gap: 10, alignItems: 'center' },
  emojiInput: {
    width: 52,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    textAlign: 'center',
    backgroundColor: '#fff',
    fontSize: 22,
    fontWeight: '800',
  },
  inlineFlex: { flex: 1, height: 48 },

  attachButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  attachButtonText: { fontWeight: '900', color: '#374151', fontSize: 14 },
  clearPhoto: { fontWeight: '900', color: '#DC2626', fontSize: 14 },
  photoHint: { fontSize: 12, color: '#6B7280', fontWeight: '600' },

  input: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
    backgroundColor: '#fff',
    fontWeight: '800',
    color: '#111827',
  },

  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    backgroundColor: '#fff',
  },
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
    marginBottom: 16,
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
  webDatePanel: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    backgroundColor: '#fff',
    overflow: 'hidden',
  },
});
