import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import {
  Alert,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { CATEGORIES, CategoryKey } from '@/lib/expenseOptions';
import { BRAND_GREEN, BRAND_GREEN_DARK, BRAND_GREEN_LIGHT, useTheme } from '@/theme/ThemeContext';

export interface QuickPreset {
  id: string;
  label: string;
  amount: number;
  category: CategoryKey;
  item: string;
  color: string;
}

const DEFAULT_COLOR = '#94A3B8';
const LABEL_MAX = 10;
const ITEM_MAX = 30;

export type QuickPresetFormHandle = {
  requestLeave: (destination: 'list' | 'dismiss') => void;
  isDirty: () => boolean;
};

type Props = {
  preset?: QuickPreset | null;
  onBack: () => void;
  onDismissSheet: () => void;
  onSave: (preset: QuickPreset) => void;
  scrollMaxHeight?: number;
};

function digitsOnly(value: string): string {
  return value.replace(/[^0-9]/g, '');
}

function formatGrouped(digits: string): string {
  if (!digits) return '';
  return Number(digits).toLocaleString('ko-KR');
}

export const QuickPresetForm = forwardRef<QuickPresetFormHandle, Props>(function QuickPresetForm(
  { preset, onBack, onDismissSheet, onSave, scrollMaxHeight },
  ref,
) {
  const { colors, isDark } = useTheme();
  const isEdit = Boolean(preset?.id);

  const [label, setLabel] = useState('');
  const [amountDigits, setAmountDigits] = useState('');
  const [category, setCategory] = useState<CategoryKey>('takeout');
  const [item, setItem] = useState('');
  const [focused, setFocused] = useState<'label' | 'amount' | 'item' | null>(null);
  const [nameError, setNameError] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const resetFromPreset = useCallback((next: QuickPreset | null | undefined) => {
    setLabel(next?.label ?? '');
    setAmountDigits(next?.amount ? String(next.amount) : '');
    setCategory(next?.category ?? 'takeout');
    setItem(next?.item ?? '');
    setNameError(false);
    setSubmitting(false);
  }, []);

  useEffect(() => {
    resetFromPreset(preset);
  }, [preset, resetFromPreset]);

  const isDirty = useCallback(() => {
    if (isEdit && preset) {
      const originalAmount = preset.amount ? String(preset.amount) : '';
      return (
        label !== (preset.label ?? '')
        || amountDigits !== originalAmount
        || category !== preset.category
        || item !== (preset.item ?? '')
      );
    }
    return label.trim() !== '' || amountDigits !== '' || item.trim() !== '' || category !== 'takeout';
  }, [amountDigits, category, isEdit, item, label, preset]);

  const leaveTo = useCallback((destination: 'list' | 'dismiss') => {
    Keyboard.dismiss();
    if (destination === 'list') onBack();
    else onDismissSheet();
  }, [onBack, onDismissSheet]);

  const requestLeave = useCallback((destination: 'list' | 'dismiss') => {
    if (!isDirty()) {
      leaveTo(destination);
      return;
    }
    Alert.alert(
      '변경사항을 버릴까요?',
      '저장하지 않은 내용은 사라집니다.',
      [
        { text: '계속 편집', style: 'cancel' },
        { text: '나가기', style: 'destructive', onPress: () => leaveTo(destination) },
      ],
    );
  }, [isDirty, leaveTo]);

  useImperativeHandle(ref, () => ({ requestLeave, isDirty }), [isDirty, requestLeave]);

  const handleSave = () => {
    if (submitting) return;
    if (!label.trim()) {
      setNameError(true);
      return;
    }
    setSubmitting(true);
    onSave({
      id: preset?.id ?? `preset_${Date.now()}`,
      label: label.trim(),
      amount: Number(amountDigits) || 0,
      category,
      item: item.trim(),
      color: preset?.color ?? DEFAULT_COLOR,
    });
  };

  const inputBg = isDark ? colors.inputBg : colors.surfaceMuted;
  const idleBorder = colors.borderInput;
  const focusBorder = BRAND_GREEN;
  const amountText = useMemo(() => formatGrouped(amountDigits), [amountDigits]);

  const fieldBorder = (key: 'label' | 'amount' | 'item', error?: boolean) => ({
    backgroundColor: inputBg,
    borderColor: focused === key ? focusBorder : (error ? colors.logoutText : idleBorder),
  });

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Pressable
          onPress={() => requestLeave('list')}
          style={styles.backHit}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="목록으로"
        >
          <MaterialIcons name="chevron-left" size={24} color={colors.text} />
        </Pressable>
        <View style={styles.headerCopy}>
          <Text style={[styles.title, { color: colors.text }]}>
            {isEdit ? '빠른 입력 수정' : '빠른 입력 추가'}
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSec }]}>
            {isEdit ? '저장된 빠른 입력 정보를 수정해요.' : '자주 기록하는 소비를 등록해요.'}
          </Text>
        </View>
      </View>

      <ScrollView
        style={scrollMaxHeight ? { maxHeight: scrollMaxHeight } : undefined}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.formScroll}
      >
        <View style={styles.fieldBlock}>
          <Text style={[styles.label, { color: colors.textMuted }]}>이름 *</Text>
          <View style={[styles.fieldBox, fieldBorder('label', nameError)]}>
            <TextInput
              style={[styles.fieldInput, { color: colors.text }]}
              placeholder="예: 아메리카노"
              placeholderTextColor={colors.placeholder}
              value={label}
              onChangeText={(value) => {
                setLabel(value);
                if (nameError && value.trim()) setNameError(false);
              }}
              onFocus={() => setFocused('label')}
              onBlur={() => setFocused(null)}
              maxLength={LABEL_MAX}
              returnKeyType="next"
              multiline={false}
              underlineColorAndroid="transparent"
              accessibilityLabel="이름"
              accessibilityHint="필수 항목"
            />
          </View>
          {nameError ? (
            <Text style={[styles.errorText, { color: colors.logoutText }]}>이름을 입력하세요</Text>
          ) : null}
        </View>

        <View style={styles.fieldBlock}>
          <Text style={[styles.label, { color: colors.textMuted }]}>금액 (선택)</Text>
          <View style={[styles.fieldBox, fieldBorder('amount')]}>
            <TextInput
              style={[styles.fieldInput, styles.amountInput, { color: colors.text }]}
              placeholder="0"
              placeholderTextColor={colors.placeholder}
              value={amountText}
              onChangeText={(value) => setAmountDigits(digitsOnly(value))}
              onFocus={() => setFocused('amount')}
              onBlur={() => setFocused(null)}
              keyboardType="number-pad"
              returnKeyType="done"
              multiline={false}
              underlineColorAndroid="transparent"
              accessibilityLabel="금액"
            />
            <Text style={[styles.won, { color: colors.textSec }]}>원</Text>
          </View>
        </View>

        <View style={styles.fieldBlock}>
          <Text style={[styles.label, { color: colors.textMuted }]}>카테고리</Text>
          <View style={styles.chipRow}>
            {CATEGORIES.map((cat) => {
              const active = category === cat.key;
              return (
                <Pressable
                  key={cat.key}
                  onPress={() => setCategory(cat.key)}
                  style={[
                    styles.catChip,
                    {
                      backgroundColor: active
                        ? (isDark ? colors.choiceActiveBg : BRAND_GREEN_LIGHT)
                        : (isDark ? colors.surfaceMuted : colors.surface),
                      borderColor: active ? BRAND_GREEN : colors.border,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={cat.label}
                >
                  <Text style={styles.catEmoji} accessible={false}>{cat.emoji}</Text>
                  <Text
                    style={[
                      styles.catChipText,
                      { color: active ? (isDark ? colors.text : BRAND_GREEN_DARK) : colors.text },
                    ]}
                    numberOfLines={2}
                  >
                    {cat.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.fieldBlock}>
          <Text style={[styles.label, { color: colors.textMuted }]}>품목 (선택)</Text>
          <View style={[styles.fieldBox, fieldBorder('item')]}>
            <TextInput
              style={[styles.fieldInput, { color: colors.text }]}
              placeholder="예: 후라이드 치킨"
              placeholderTextColor={colors.placeholder}
              value={item}
              onChangeText={setItem}
              onFocus={() => setFocused('item')}
              onBlur={() => setFocused(null)}
              maxLength={ITEM_MAX}
              returnKeyType="done"
              multiline={false}
              underlineColorAndroid="transparent"
              accessibilityLabel="품목"
            />
          </View>
        </View>
      </ScrollView>

      <Pressable
        style={[
          styles.saveBtn,
          { backgroundColor: BRAND_GREEN, opacity: !label.trim() || submitting ? 0.45 : 1 },
        ]}
        onPress={handleSave}
        disabled={submitting}
        accessibilityRole="button"
        accessibilityLabel={isEdit ? '변경사항 저장' : '빠른 입력 등록'}
        accessibilityState={{ disabled: submitting }}
      >
        <Text style={styles.saveBtnText}>{isEdit ? '변경사항 저장' : '빠른 입력 등록'}</Text>
      </Pressable>
    </View>
  );
});

/** @deprecated 시트 내부 폼으로 대체됨. 타입 호환용 별칭 */
export const QuickPresetModal = QuickPresetForm;

const styles = StyleSheet.create({
  root: { width: '100%' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 26,
  },
  backHit: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -10,
  },
  headerCopy: { flex: 1, minWidth: 0 },
  title: { fontSize: 21, fontWeight: '700', letterSpacing: -0.3 },
  subtitle: { marginTop: 6, fontSize: 13.5, fontWeight: '500', lineHeight: 18 },
  formScroll: { width: '100%', paddingBottom: 4 },
  fieldBlock: { width: '100%', marginBottom: 22 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  fieldBox: {
    width: '100%',
    height: 54,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldInput: {
    flex: 1,
    margin: 0,
    paddingTop: 0,
    paddingBottom: 0,
    paddingVertical: 0,
    paddingHorizontal: 0,
    fontSize: 16,
    fontWeight: '500',
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  amountInput: {
    paddingRight: 8,
    fontWeight: '600',
  },
  won: { fontSize: 15, fontWeight: '600' },
  errorText: { marginTop: 6, fontSize: 12.5, fontWeight: '600' },
  chipRow: {
    width: '100%',
    flexDirection: 'row',
    gap: 8,
  },
  catChip: {
    flex: 1,
    minWidth: 0,
    height: 48,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  catEmoji: { fontSize: 15 },
  catChipText: {
    flexShrink: 1,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  saveBtn: {
    width: '100%',
    height: 54,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: '#fff' },
});
