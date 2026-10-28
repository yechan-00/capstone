import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  QuickPresetForm,
  type QuickPreset,
  type QuickPresetFormHandle,
} from '@/components/QuickPresetModal';
import { categoryDisplay } from '@/lib/expenseOptions';
import { buildManualExpensePayload } from '@/services/expenseInput/manualExpensePayload';
import { BRAND_GREEN, BRAND_GREEN_DARK, BRAND_GREEN_LIGHT, useTheme } from '@/theme/ThemeContext';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const DISMISS_FROM_HANDLE_ONLY = true;

/** 빠른 입력 전용 기본 이유. 기존 선택지 '충동·습관'과 구분하며, reason은 string 필드. */
const QUICK_ADD_REASON = '습관';

const OPEN_MS = 280;
const CLOSE_MS = 240;
const DISMISS_DY = 88;

type AccountLike = { id: string } | null | undefined;

export type QuickPresetLoadState = 'loading' | 'ready' | 'error' | 'parse_error';

type Props = {
  visible: boolean;
  onClose: () => void;
  quickPresets: QuickPreset[];
  presetLoadState?: QuickPresetLoadState;
  onRetryLoad?: () => void;
  handleDeletePreset: (id: string) => void;
  handleAddPreset: (preset: QuickPreset) => void;
  onSaved?: () => void;
  account: AccountLike;
  createExpense: (payload: any) => Promise<unknown>;
};

function formatAmount(amount: number): string {
  return `${amount.toLocaleString('ko-KR')}원`;
}

function categoryMeta(category: QuickPreset['category']) {
  return categoryDisplay(category);
}

function presetA11yLabel(preset: QuickPreset): string {
  const cat = categoryMeta(preset.category);
  const parts = [preset.label];
  if (cat?.label) parts.push(cat.label);
  if (typeof preset.amount === 'number') parts.push(formatAmount(preset.amount));
  return parts.join(', ');
}

function digitsOnly(value: string): string {
  return value.replace(/[^0-9]/g, '');
}

function formatGrouped(digits: string): string {
  if (!digits) return '';
  return Number(digits).toLocaleString('ko-KR');
}

function presetAmount(preset: QuickPreset): number {
  return typeof preset.amount === 'number' && Number.isFinite(preset.amount) ? preset.amount : 0;
}

export function QuickInputSheet({
  visible,
  onClose,
  quickPresets,
  presetLoadState = 'ready',
  onRetryLoad,
  handleDeletePreset,
  handleAddPreset,
  onSaved,
  account,
  createExpense,
}: Props) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const { animationsEnabled, isDark, colors } = useTheme();

  const [amountPreset, setAmountPreset] = useState<QuickPreset | null>(null);
  const [amountDigits, setAmountDigits] = useState('');
  const [amountFocused, setAmountFocused] = useState(false);
  const [amountError, setAmountError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingPresetId, setSavingPresetId] = useState<string | null>(null);
  const [manageMode, setManageMode] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingPreset, setEditingPreset] = useState<QuickPreset | null>(null);
  const [render, setRender] = useState(visible);

  const savingRef = useRef(false);
  const formRef = useRef<QuickPresetFormHandle>(null);
  const keyboardOpenRef = useRef(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const sheetOpen = useSharedValue(visible ? 1 : 0);
  const backdropOpacity = useSharedValue(visible ? 1 : 0);
  const dragY = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setRender(true);
      dragY.value = 0;
      if (!animationsEnabled) {
        sheetOpen.value = 1;
        backdropOpacity.value = 1;
        return;
      }
      sheetOpen.value = 0;
      backdropOpacity.value = 0;
      backdropOpacity.value = withTiming(1, { duration: OPEN_MS, easing: Easing.out(Easing.cubic) });
      sheetOpen.value = withTiming(1, { duration: OPEN_MS, easing: Easing.out(Easing.cubic) });
    } else {
      if (!animationsEnabled) {
        setRender(false);
        return;
      }
      backdropOpacity.value = withTiming(0, { duration: CLOSE_MS, easing: Easing.in(Easing.cubic) });
      sheetOpen.value = withTiming(
        0,
        { duration: CLOSE_MS, easing: Easing.in(Easing.cubic) },
        (finished) => {
          if (finished) runOnJS(setRender)(false);
        },
      );
    }
  }, [visible, animationsEnabled, sheetOpen, backdropOpacity, dragY]);

  useEffect(() => {
    if (!render) {
      setAmountPreset(null);
      setAmountDigits('');
      setAmountFocused(false);
      setAmountError(false);
      setManageMode(false);
      setSavingPresetId(null);
      setShowForm(false);
      setEditingPreset(null);
      setSaving(false);
      savingRef.current = false;
      setKeyboardHeight(0);
      keyboardOpenRef.current = false;
    }
  }, [render]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const show = Keyboard.addListener(showEvent, (e) => {
      keyboardOpenRef.current = true;
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hide = Keyboard.addListener(hideEvent, () => {
      keyboardOpenRef.current = false;
      setKeyboardHeight(0);
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    if (quickPresets.length === 0) setManageMode(false);
  }, [quickPresets.length]);

  const closeFormToList = useCallback(() => {
    Keyboard.dismiss();
    setShowForm(false);
    setEditingPreset(null);
  }, []);

  const requestClose = useCallback(() => {
    if (savingRef.current) return;
    if (keyboardOpenRef.current) {
      Keyboard.dismiss();
      return;
    }
    if (showForm) {
      formRef.current?.requestLeave('dismiss');
      return;
    }
    onClose();
  }, [onClose, showForm]);

  const handleAndroidBack = useCallback(() => {
    if (savingRef.current) return;
    if (showForm) {
      if (formRef.current) formRef.current.requestLeave('list');
      else closeFormToList();
      return;
    }
    if (amountPreset) {
      setAmountPreset(null);
      setAmountDigits('');
      setAmountError(false);
      return;
    }
    onClose();
  }, [onClose, amountPreset, showForm]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => DISMISS_FROM_HANDLE_ONLY,
        onMoveShouldSetPanResponder: (_, g) => g.dy > 6 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderMove: (_, g) => {
          dragY.value = Math.max(0, g.dy);
        },
        onPanResponderRelease: (_, g) => {
          if (keyboardOpenRef.current) {
            dragY.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) });
            Keyboard.dismiss();
            return;
          }
          if (g.dy > DISMISS_DY || g.vy > 1.1) {
            requestClose();
            return;
          }
          dragY.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) });
        },
        onPanResponderTerminate: () => {
          dragY.value = withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) });
        },
      }),
    [dragY, requestClose],
  );

  const sheetAnim = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - sheetOpen.value) * windowHeight + dragY.value }],
  }));

  const backdropAnim = useAnimatedStyle(() => ({ opacity: backdropOpacity.value }));

  const executePreset = async (preset: QuickPreset, amount: number) => {
    if (savingRef.current) return;
    if (!account) {
      Alert.alert('오류', '계정 정보가 없습니다.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setAmountError(true);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setSavingPresetId(preset.id);
    try {
      const payload = buildManualExpensePayload({
        amount,
        category: preset.category as never,
        item: preset.item || preset.label,
        reason: QUICK_ADD_REASON,
        tags: [],
        spentAt: new Date(),
        sourceType: 'manual',
      });
      await createExpense({ ...payload, accountId: account?.id ?? '' } as any);
      onSaved?.();
      onClose();
    } catch {
      Alert.alert('저장 실패', '다시 시도해주세요.');
    } finally {
      savingRef.current = false;
      setSaving(false);
      setSavingPresetId(null);
    }
  };

  const onPresetPress = (preset: QuickPreset) => {
    if (savingRef.current) return;
    if (manageMode) return;
    const amount = presetAmount(preset);
    if (amount > 0) {
      void executePreset(preset, amount);
      return;
    }
    setAmountPreset(preset);
    setAmountDigits('');
    setAmountError(false);
  };

  const onAmountSave = () => {
    if (!amountPreset) return;
    const amount = Number(amountDigits) || 0;
    if (amount <= 0) {
      setAmountError(true);
      return;
    }
    void executePreset(amountPreset, amount);
  };

  const openAddForm = () => {
    if (savingRef.current) return;
    setAmountPreset(null);
    setEditingPreset(null);
    setShowForm(true);
  };

  const openEditForm = (preset: QuickPreset) => {
    if (savingRef.current) return;
    setAmountPreset(null);
    setEditingPreset(preset);
    setShowForm(true);
  };

  const handlePresetFormSave = (preset: QuickPreset) => {
    handleAddPreset(preset);
    closeFormToList();
  };

  const confirmDelete = (preset: QuickPreset) => {
    Alert.alert(
      '삭제 확인',
      `'${preset.label}'을(를) 삭제하시겠습니까?`,
      [
        { text: '취소', style: 'cancel' },
        { text: '삭제', style: 'destructive', onPress: () => handleDeletePreset(preset.id) },
      ],
    );
  };

  if (!render) return null;

  const sheetMaxHeight = Math.min(
    windowHeight * (showForm ? 0.9 : 0.85),
    windowHeight - keyboardHeight - (keyboardHeight > 0 ? 8 : 0),
  );
  const listMaxHeight = Math.max(128, sheetMaxHeight - insets.bottom - 248);
  const handleColor = isDark ? colors.border : '#D5DAD7';
  const dimColor = isDark ? 'rgba(0,0,0,0.48)' : 'rgba(0,0,0,0.24)';
  const addTint = isDark ? colors.surfaceMuted : BRAND_GREEN_LIGHT;
  const addText = isDark ? BRAND_GREEN : BRAND_GREEN_DARK;

  return (
    <Modal
      visible={render}
      transparent
      animationType="none"
      onRequestClose={handleAndroidBack}
      statusBarTranslucent
    >
      <View style={styles.root} pointerEvents="box-none">
        <AnimatedPressable
          style={[styles.backdrop, { backgroundColor: dimColor }, backdropAnim]}
          onPress={requestClose}
          accessibilityRole="button"
          accessibilityLabel="빠른 입력 닫기"
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' || showForm || Boolean(amountPreset) ? 'padding' : undefined}
          style={styles.kav}
          pointerEvents="box-none"
        >
          <Animated.View
            style={[
              styles.sheet,
              sheetAnim,
              {
                backgroundColor: colors.surface,
                maxHeight: sheetMaxHeight,
                paddingBottom: Math.max(insets.bottom, 12),
              },
            ]}
          >
            <View
              style={styles.handleHit}
              {...panResponder.panHandlers}
              accessibilityRole="adjustable"
              accessibilityLabel="아래로 내려 닫기"
            >
              <View style={[styles.handle, { backgroundColor: handleColor }]} />
            </View>

            {showForm ? (
              <QuickPresetForm
                ref={formRef}
                preset={editingPreset}
                onBack={closeFormToList}
                onDismissSheet={onClose}
                onSave={handlePresetFormSave}
                scrollMaxHeight={Math.max(160, sheetMaxHeight - insets.bottom - 220)}
              />
            ) : amountPreset ? (
              <>
                <View style={styles.header}>
                  <Pressable
                    onPress={() => {
                      if (saving) return;
                      setAmountPreset(null);
                      setAmountDigits('');
                      setAmountError(false);
                    }}
                    style={styles.backHit}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="프리셋 목록으로"
                    disabled={saving}
                  >
                    <MaterialIcons name="chevron-left" size={22} color={colors.text} />
                    <View style={styles.headerCopy}>
                      <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                        금액 입력
                      </Text>
                      <Text style={[styles.subtitle, { color: colors.textSec }]} numberOfLines={1}>
                        {amountPreset.label}
                      </Text>
                    </View>
                  </Pressable>
                </View>

                <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>금액 *</Text>
                <View
                  style={[
                    styles.amountBox,
                    {
                      backgroundColor: isDark ? colors.inputBg : colors.surfaceMuted,
                      borderColor: amountFocused
                        ? BRAND_GREEN
                        : (amountError ? colors.logoutText : colors.borderInput),
                    },
                  ]}
                >
                  <TextInput
                    style={[styles.amountField, { color: colors.text }]}
                    placeholder="0"
                    placeholderTextColor={colors.placeholder}
                    value={formatGrouped(amountDigits)}
                    onChangeText={(value) => {
                      setAmountDigits(digitsOnly(value));
                      if (amountError) setAmountError(false);
                    }}
                    onFocus={() => setAmountFocused(true)}
                    onBlur={() => setAmountFocused(false)}
                    keyboardType="number-pad"
                    returnKeyType="done"
                    multiline={false}
                    underlineColorAndroid="transparent"
                    editable={!saving}
                    accessibilityLabel="금액"
                  />
                  <Text style={[styles.won, { color: colors.textSec }]}>원</Text>
                </View>
                {amountError ? (
                  <Text style={[styles.amountError, { color: colors.logoutText }]}>금액을 입력하세요</Text>
                ) : (
                  <Text style={[styles.amountHint, { color: colors.textMuted }]}>
                    이번 소비에만 적용되고, 빠른 입력 항목은 바뀌지 않아요.
                  </Text>
                )}

                <Pressable
                  style={[styles.saveBtn, { backgroundColor: BRAND_GREEN, opacity: saving ? 0.6 : 1 }]}
                  onPress={onAmountSave}
                  disabled={saving}
                  accessibilityRole="button"
                  accessibilityLabel="소비 저장"
                  accessibilityState={{ disabled: saving, busy: saving }}
                >
                  {saving
                    ? <ActivityIndicator color="#fff" />
                    : <Text style={styles.saveBtnText}>저장</Text>}
                </Pressable>
              </>
            ) : (
              <>
                <View style={styles.header}>
                  <View style={styles.headerCopy}>
                    <Text style={[styles.title, { color: colors.text }]}>빠른 소비 기록</Text>
                    <Text style={[styles.subtitle, { color: colors.textSec }]}>
                      자주 기록하는 소비를 바로 추가해요
                    </Text>
                  </View>
                  {quickPresets.length > 0 && (
                    <Pressable
                      onPress={() => { if (!saving) setManageMode((v) => !v); }}
                      style={styles.manageHit}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel={manageMode ? '관리 완료' : '프리셋 관리'}
                    >
                      <MaterialIcons
                        name={manageMode ? 'check' : 'tune'}
                        size={16}
                        color={colors.text}
                      />
                      <Text style={[styles.manageText, { color: colors.text }]}>
                        {manageMode ? '완료' : '관리'}
                      </Text>
                    </Pressable>
                  )}
                </View>

                {presetLoadState === 'loading' ? (
                  <View style={styles.emptyWrap}>
                    <ActivityIndicator color={BRAND_GREEN} />
                    <Text style={[styles.emptyDesc, { color: colors.textSec }]}>
                      빠른 입력을 불러오는 중이에요
                    </Text>
                  </View>
                ) : presetLoadState === 'error' || presetLoadState === 'parse_error' ? (
                  <View style={styles.emptyWrap}>
                    <MaterialIcons name="error-outline" size={22} color={colors.emptyIcon} />
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>
                      빠른 입력을 불러오지 못했어요
                    </Text>
                    <Text style={[styles.emptyDesc, { color: colors.textSec }]}>
                      {presetLoadState === 'parse_error'
                        ? '저장된 목록을 읽지 못했습니다. 기존 값은 그대로 두었어요.'
                        : '저장소를 읽지 못했습니다. 기존 값은 변경하지 않았습니다.'}
                    </Text>
                    {onRetryLoad ? (
                      <Pressable
                        style={[styles.addBtn, { backgroundColor: addTint }]}
                        onPress={onRetryLoad}
                        accessibilityRole="button"
                        accessibilityLabel="다시 불러오기"
                      >
                        <Text style={[styles.addBtnText, { color: addText }]}>다시 불러오기</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ) : quickPresets.length === 0 ? (
                  <View style={styles.emptyWrap}>
                    <MaterialIcons name="add-circle-outline" size={22} color={colors.emptyIcon} />
                    <Text style={[styles.emptyTitle, { color: colors.text }]}>
                      아직 등록된 빠른 입력이 없어요
                    </Text>
                    <Text style={[styles.emptyDesc, { color: colors.textSec }]}>
                      자주 기록하는 소비를 등록해 보세요.
                    </Text>
                    <Pressable
                      style={[styles.addBtn, { backgroundColor: addTint }]}
                      onPress={openAddForm}
                      disabled={saving}
                      accessibilityRole="button"
                      accessibilityLabel="빠른 입력 항목 추가"
                    >
                      <Text style={[styles.addBtnText, { color: addText }]}>+ 빠른 입력 항목 추가</Text>
                    </Pressable>
                  </View>
                ) : (
                  <>
                    <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>자주 사용하는 항목</Text>
                    <ScrollView
                        style={{ maxHeight: listMaxHeight }}
                        showsVerticalScrollIndicator={false}
                        keyboardShouldPersistTaps="handled"
                        bounces
                        contentContainerStyle={styles.listContent}
                      >
                        {quickPresets.map((preset) => {
                          const cat = categoryMeta(preset.category);
                          return (
                            <Pressable
                              key={preset.id}
                              style={({ pressed }) => [
                                styles.card,
                                {
                                  backgroundColor: colors.surfaceMuted,
                                  borderColor: isDark ? colors.border : 'transparent',
                                  opacity: saving && savingPresetId !== preset.id ? 0.5 : (pressed && !saving ? 0.82 : 1),
                                },
                              ]}
                              onPress={() => onPresetPress(preset)}
                              disabled={saving}
                              accessibilityRole="button"
                              accessibilityLabel={presetA11yLabel(preset)}
                              accessibilityHint={manageMode ? undefined : '바로 소비를 기록합니다'}
                              accessibilityState={{ disabled: saving, busy: savingPresetId === preset.id }}
                            >
                              <View style={[styles.iconWrap, { backgroundColor: isDark ? colors.bg : BRAND_GREEN_LIGHT }]}>
                                {cat?.emoji ? (
                                  <Text style={styles.emoji}>{cat.emoji}</Text>
                                ) : (
                                  <MaterialIcons name="receipt" size={18} color={colors.textMuted} />
                                )}
                              </View>
                              <View style={styles.cardBody}>
                                <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={1}>
                                  {preset.label}
                                </Text>
                                {(manageMode || cat?.label) ? (
                                  <Text style={[styles.cardSub, { color: colors.textSec }]} numberOfLines={1}>
                                    {manageMode
                                      ? [cat?.label, typeof preset.amount === 'number' ? formatAmount(preset.amount) : null]
                                          .filter(Boolean)
                                          .join(' · ')
                                      : cat?.label}
                                  </Text>
                                ) : null}
                              </View>
                              {manageMode ? (
                                <View style={styles.manageActions}>
                                  <Pressable
                                    onPress={() => openEditForm(preset)}
                                    style={styles.actionHit}
                                    accessibilityRole="button"
                                    accessibilityLabel={`${preset.label} 수정`}
                                  >
                                    <Text style={[styles.actionEdit, { color: colors.textSec }]}>수정</Text>
                                  </Pressable>
                                  <Pressable
                                    onPress={() => confirmDelete(preset)}
                                    style={styles.actionHit}
                                    accessibilityRole="button"
                                    accessibilityLabel={`${preset.label} 삭제`}
                                  >
                                    <Text style={[styles.actionDelete, { color: colors.logoutText }]}>삭제</Text>
                                  </Pressable>
                                </View>
                              ) : (
                                <View style={styles.amountRow}>
                                  {savingPresetId === preset.id ? (
                                    <ActivityIndicator color={BRAND_GREEN} />
                                  ) : (
                                    <>
                                      {typeof preset.amount === 'number' && preset.amount > 0 && (
                                        <Text style={[styles.amount, { color: colors.text }]}>
                                          {formatAmount(preset.amount)}
                                        </Text>
                                      )}
                                      <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
                                    </>
                                  )}
                                </View>
                              )}
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    <Pressable
                      style={[styles.addBtn, { backgroundColor: addTint, marginTop: 10, opacity: saving ? 0.5 : 1 }]}
                      onPress={openAddForm}
                      disabled={saving}
                      accessibilityRole="button"
                      accessibilityLabel="빠른 입력 항목 추가"
                    >
                      <Text style={[styles.addBtnText, { color: addText }]}>+ 빠른 입력 항목 추가</Text>
                    </Pressable>
                  </>
                )}
              </>
            )}
          </Animated.View>
        </KeyboardAvoidingView>
      </View>

    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  kav: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    width: '100%',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    paddingHorizontal: 22,
    paddingTop: 8,
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: -4 },
    elevation: 18,
  },
  handleHit: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    minHeight: 28,
  },
  handle: {
    width: 40,
    height: 5,
    borderRadius: 999,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 14,
    gap: 12,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  subtitle: { marginTop: 4, fontSize: 13.5, fontWeight: '500', lineHeight: 18 },
  manageHit: {
    minWidth: 44,
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 6,
  },
  manageText: { fontSize: 15, fontWeight: '600' },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  listContent: { gap: 8, paddingBottom: 2 },
  card: {
    minHeight: 72,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  emoji: { fontSize: 18 },
  cardBody: { flex: 1, minWidth: 0 },
  cardTitle: { fontSize: 15.5, fontWeight: '600' },
  cardSub: { marginTop: 2, fontSize: 12.5, fontWeight: '500' },
  amountRow: { flexDirection: 'row', alignItems: 'center', marginLeft: 8, gap: 2 },
  amount: { fontSize: 15.5, fontWeight: '700' },
  manageActions: { flexDirection: 'row', alignItems: 'center', marginLeft: 4 },
  actionHit: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  actionEdit: { fontSize: 13.5, fontWeight: '600' },
  actionDelete: { fontSize: 13.5, fontWeight: '700' },
  addBtn: {
    height: 50,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: { fontSize: 15, fontWeight: '700' },
  emptyWrap: {
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 8,
    gap: 8,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', textAlign: 'center', marginTop: 4 },
  emptyDesc: { fontSize: 13.5, fontWeight: '500', textAlign: 'center', marginBottom: 8 },
  backHit: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    minHeight: 44,
    flex: 1,
  },
  fieldLabel: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  amountBox: {
    width: '100%',
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  amountField: {
    flex: 1,
    margin: 0,
    paddingTop: 0,
    paddingBottom: 0,
    paddingVertical: 0,
    paddingHorizontal: 0,
    paddingRight: 8,
    fontSize: 16,
    fontWeight: '600',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  won: { fontSize: 15, fontWeight: '600' },
  amountError: { marginTop: 6, fontSize: 12.5, fontWeight: '600' },
  amountHint: { marginTop: 6, fontSize: 12.5, fontWeight: '500' },
  saveBtn: {
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
  },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
