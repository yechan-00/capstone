import React, { useEffect, useState } from 'react';
import {
  Modal, View, Text, TextInput, TouchableOpacity,
  StyleSheet, ScrollView, KeyboardAvoidingView, Platform, Pressable,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';
import { CATEGORIES, CategoryKey } from '@/lib/expenseOptions';
import { ColorPickerModal } from '@/components/ColorPickerModal';

export interface QuickPreset {
  id: string;
  label: string;
  amount: number;
  category: CategoryKey;
  item: string;
  color: string;
}

const DEFAULT_COLOR = '#94A3B8';

interface Props {
  visible: boolean;
  preset?: QuickPreset | null;
  onClose: () => void;
  onSave: (preset: QuickPreset) => void;
}

export function QuickPresetModal({ visible, preset, onClose, onSave }: Props) {
  const { colors, isDark } = useTheme();
  const [label, setLabel] = useState('');
  const [amountText, setAmountText] = useState('');
  const [category, setCategory] = useState<CategoryKey>('takeout');
  const [item, setItem] = useState('');
  const [selectedColor, setSelectedColor] = useState(DEFAULT_COLOR);
  const [showColorPicker, setShowColorPicker] = useState(false);

  useEffect(() => {
    if (visible) {
      setLabel(preset?.label ?? '');
      setAmountText(preset?.amount ? String(preset.amount) : '');
      setCategory(preset?.category ?? 'takeout');
      setItem(preset?.item ?? '');
      setSelectedColor(preset?.color ?? DEFAULT_COLOR);
    }
  }, [visible, preset]);

  const handleSave = () => {
    if (!label.trim()) return;
    onSave({
      id: preset?.id ?? `preset_${Date.now()}`,
      label: label.trim(),
      amount: Number(amountText.replace(/[^0-9]/g, '')) || 0,
      category,
      item: item.trim(),
      color: selectedColor,
    });
    onClose();
  };

  const isDefaultColor = selectedColor === DEFAULT_COLOR;

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <TouchableOpacity style={s.backdrop} activeOpacity={1} onPress={onClose} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={s.kavWrap}>
          <View style={[s.sheet, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
            <Text style={[s.title, { color: colors.text }]}>{preset ? '프리셋 편집' : '빠른 입력 추가'}</Text>

            {/* 버튼 이름 */}
            <Text style={[s.label, { color: colors.textMuted }]}>버튼 이름 *</Text>
            <TextInput
              style={[s.input, { borderColor: colors.borderInput, backgroundColor: colors.inputBg, color: colors.text }]}
              placeholder="예: 아메리카노, 점심 배달"
              placeholderTextColor={colors.placeholder}
              value={label}
              onChangeText={setLabel}
              maxLength={10}
            />

            {/* 금액 */}
            <Text style={[s.label, { color: colors.textMuted }]}>금액 (선택)</Text>
            <TextInput
              style={[s.input, { borderColor: colors.borderInput, backgroundColor: colors.inputBg, color: colors.text }]}
              placeholder="0"
              placeholderTextColor={colors.placeholder}
              value={amountText}
              onChangeText={(t) => setAmountText(t.replace(/[^0-9]/g, ''))}
              keyboardType="number-pad"
            />

            {/* 카테고리 */}
            <Text style={[s.label, { color: colors.textMuted }]}>카테고리</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {CATEGORIES.map((cat) => {
                  const active = category === cat.key;
                  return (
                    <TouchableOpacity
                      key={cat.key}
                      style={[s.catChip, { borderColor: colors.border, backgroundColor: colors.surfaceMuted },
                        active && { backgroundColor: colors.accentCta, borderColor: colors.accentCta }]}
                      onPress={() => setCategory(cat.key as CategoryKey)}
                    >
                      <Text style={[s.catChipText, { color: colors.text }, active && { color: '#fff', fontWeight: '800' }]}>
                        {cat.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            {/* 품목 */}
            <Text style={[s.label, { color: colors.textMuted }]}>품목 (선택)</Text>
            <TextInput
              style={[s.input, { borderColor: colors.borderInput, backgroundColor: colors.inputBg, color: colors.text }]}
              placeholder="예: 아이스 아메리카노"
              placeholderTextColor={colors.placeholder}
              value={item}
              onChangeText={setItem}
              maxLength={30}
            />

            {/* 버튼 색상 */}
            <Text style={[s.label, { color: colors.textMuted }]}>버튼 색상</Text>
            <View style={s.colorRow}>
              {/* 미리보기 원 */}
              <View style={[s.previewBtn, { backgroundColor: selectedColor }]}>
                <Text style={[s.previewLabel, { color: isDefaultColor ? colors.text : '#fff' }]} numberOfLines={1}>
                  {label || '미리보기'}
                </Text>
              </View>
              {/* 색상 선택 버튼 */}
              <Pressable
                style={[s.colorPickerBtn, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
                onPress={() => setShowColorPicker(true)}
              >
                <View style={[s.colorDot, { backgroundColor: selectedColor }]} />
                <Text style={[s.colorPickerBtnText, { color: colors.textSec }]}>
                  {selectedColor.toUpperCase()}
                </Text>
                <MaterialIcons name="colorize" size={16} color={colors.textMuted} />
              </Pressable>
              {/* 기본으로 리셋 */}
              {!isDefaultColor && (
                <Pressable
                  style={[s.resetBtn, { borderColor: colors.border }]}
                  onPress={() => setSelectedColor(DEFAULT_COLOR)}
                >
                  <MaterialIcons name="refresh" size={16} color={colors.textMuted} />
                </Pressable>
              )}
            </View>

            {/* 저장/취소 */}
            <View style={s.btnRow}>
              <TouchableOpacity style={[s.cancelBtn, { borderColor: colors.border }]} onPress={onClose}>
                <Text style={[s.cancelBtnText, { color: colors.textSec }]}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.saveBtn, { backgroundColor: colors.accentCta }, !label.trim() && { opacity: 0.4 }]}
                onPress={handleSave}
                disabled={!label.trim()}
              >
                <Text style={s.saveBtnText}>저장</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* 컬러피커 */}
      <ColorPickerModal
        visible={showColorPicker}
        initialColor={selectedColor}
        onClose={() => setShowColorPicker(false)}
        onSelect={(hex) => setSelectedColor(hex)}
        isDark={isDark}
      />
    </>
  );
}

const s = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  kavWrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    borderTopWidth: 1, padding: 24, paddingBottom: 36, gap: 4,
  },
  title: { fontSize: 18, fontWeight: '900', marginBottom: 8 },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 6, marginTop: 4 },
  input: {
    height: 48, borderRadius: 12, borderWidth: 1.5,
    paddingHorizontal: 14, fontSize: 15, marginBottom: 4,
  },
  catChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1.5 },
  catChipText: { fontSize: 13, fontWeight: '600' },
  colorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 },
  previewBtn: {
    width: 52, height: 52, borderRadius: 26,
    alignItems: 'center', justifyContent: 'center',
  },
  previewLabel: { fontSize: 10, fontWeight: '700', textAlign: 'center', paddingHorizontal: 4 },
  colorPickerBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingHorizontal: 12, paddingVertical: 10, borderRadius: 12, borderWidth: 1.5,
  },
  colorDot: { width: 20, height: 20, borderRadius: 10 },
  colorPickerBtnText: { flex: 1, fontSize: 13, fontWeight: '700' },
  resetBtn: {
    width: 40, height: 40, borderRadius: 12, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  btnRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelBtn: {
    flex: 1, height: 50, borderRadius: 14, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  cancelBtnText: { fontSize: 15, fontWeight: '700' },
  saveBtn: { flex: 2, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '900', color: '#fff' },
});
