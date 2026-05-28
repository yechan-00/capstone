import { Tabs, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import React, { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QuickPresetModal, type QuickPreset } from '@/components/QuickPresetModal';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/hooks/useAuth';
import { useExpenses } from '@/hooks/useExpenses';
import { MOODS, REASON_GROUPS } from '@/lib/expenseOptions';
import { buildManualExpensePayload } from '@/services/expenseInput/manualExpensePayload';

// ── FAB ───────────────────────────────────────────────────
function AddTabButton({
  onPress, onLongPress, fabColor, labelColor,
}: { onPress: () => void; onLongPress: () => void; fabColor: string; labelColor: string }) {
  return (
    <Pressable
      style={styles.addTabButton}
      onPress={onPress}
      onLongPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onLongPress();
      }}
      delayLongPress={400}
    >
      <View style={[styles.addTabInner, { backgroundColor: fabColor }]}>
        <MaterialIcons name="add" size={32} color="#fff" />
      </View>
      <Text style={[styles.addTabLabel, { color: labelColor }]}>추가</Text>
    </Pressable>
  );
}

function TabHeaderBackground({
  isDark, gradientStart, gradientEnd, solid,
}: { isDark: boolean; gradientStart: string; gradientEnd: string; solid: string }) {
  if (isDark) {
    return (
      <LinearGradient
        colors={[gradientStart, gradientEnd]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    );
  }
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: solid }]} />;
}

const TAG_PRESETS = ['야식', '데이트', '시발비용', '보상', '스트레스'] as const;
const REASON_CHIPS = REASON_GROUPS[0].items;

// ── 빠른 입력 바텀시트 ────────────────────────────────────
function QuickInputSheet({
  visible, onClose, quickPresets, handleDeletePreset, handleAddPreset,
  colors, width, onSaved, account, createExpense,
}: any) {
  const insets = useSafeAreaInsets();

  const [selectedPreset, setSelectedPreset] = useState<QuickPreset | null>(null);
  const [reasons, setReasons] = useState<string[]>([]);
  const [mood, setMood] = useState<string | null>(null);
  const [tagsText, setTagsText] = useState('');
  const [saving, setSaving] = useState(false);
  const [customReason, setCustomReason] = useState('');
  const [quickEditMode, setQuickEditMode] = useState<'edit' | 'delete' | null>(null);
  const [presetModalVisible, setPresetModalVisible] = useState(false);
  const [editingPreset, setEditingPreset] = useState<QuickPreset | null>(null);

  // 시트 닫힐 때 초기화
  useEffect(() => {
    if (!visible) {
      setSelectedPreset(null);
      setReasons([]);
      setMood(null);
      setTagsText('');
      setCustomReason('');
      setQuickEditMode(null);
      setPresetModalVisible(false);
      setEditingPreset(null);
    }
  }, [visible]);

  if (!visible) return null;

  const btnSize = Math.floor((width - 32 - 40) / 5);

  const handleSave = async () => {
    if (!selectedPreset || !account) { Alert.alert('오류', '계정 정보가 없습니다.'); return; }
    try {
      setSaving(true);
      const tags = tagsText.split(',').map(t => t.trim()).filter(Boolean);
      const payload = buildManualExpensePayload({
        amount: selectedPreset.amount || 0,
        category: selectedPreset.category as any,
        item: selectedPreset.item || selectedPreset.label,
        reason: [...reasons.filter(r => r !== '기타'), ...(reasons.includes('기타') && customReason.trim() ? ['기타: ' + customReason.trim()] : reasons.includes('기타') ? ['기타'] : [])].join(', '),
        mood: (mood ?? 'normal') as any,
        tags,
        spentAt: new Date(),
        sourceType: 'manual',
      });
      await createExpense({ ...payload, accountId: account?.id ?? "" } as any);
      onSaved?.();
      onClose();
    } catch (e) {
      Alert.alert('저장 실패', '다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetRoot}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={() => { setQuickEditMode(null); setSelectedPreset(null); onClose(); }} />
      <View style={[
        styles.sheet,
        { backgroundColor: colors.surface, paddingBottom: insets.bottom + 16 },
      ]}>
        {/* 핸들 */}
        <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />

        {selectedPreset ? (
          // ── 2단계: 이유/기분/태그 입력 ──
          <>
            <View style={styles.quickHeader}>
              <Pressable onPress={() => setSelectedPreset(null)} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <MaterialIcons name="chevron-left" size={20} color={colors.textSec} />
                <Text style={[styles.quickTitle, { color: colors.text }]}>{selectedPreset.label}</Text>
              </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 8 }}>
              {/* 이유 */}
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>왜 썼나요</Text>
              <View style={styles.chipRow}>
                {/* 1줄 */}
                <View style={styles.chipLine}>
                  {['배고파서', '스트레스·피로', '기분 전환·보상', '할인·혜택'].map((r) => {
                    const active = reasons.includes(r);
                    return (
                      <Pressable
                        key={r}
                        style={[styles.chipCell, styles.chip, {
                          backgroundColor: active ? colors.accentCta : colors.surfaceMuted,
                          borderColor: active ? colors.accentCta : colors.border,
                        }]}
                        onPress={() => setReasons(prev =>
                          prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]
                        )}
                      >
                        <Text style={[styles.chipTextSm, { color: active ? '#fff' : colors.text }]} numberOfLines={1}>{r}</Text>
                      </Pressable>
                    );
                  })}
                </View>
                {/* 2줄 */}
                <View style={styles.chipLine}>
                  {['시간 없음·귀찮음', '사람들과', '충동·습관', '기타'].map((r) => {
                    const active = reasons.includes(r);
                    return (
                      <Pressable
                        key={r}
                        style={[styles.chipCell, styles.chip, {
                          backgroundColor: active ? colors.accentCta : colors.surfaceMuted,
                          borderColor: active ? colors.accentCta : colors.border,
                        }]}
                        onPress={() => setReasons(prev =>
                          prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]
                        )}
                      >
                        <Text style={[styles.chipTextSm, { color: active ? '#fff' : colors.text }]} numberOfLines={1}>{r}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
              {/* 기타 선택 시 추가 입력 */}
              {reasons.includes('기타') && (
                <TextInput
                  style={[styles.tagInput, { borderColor: colors.borderInput, backgroundColor: colors.inputBg, color: colors.text, marginTop: 6 }]}
                  placeholder="기타 이유를 입력하세요"
                  placeholderTextColor={colors.placeholder}
                  value={customReason}
                  onChangeText={setCustomReason}
                />
              )}

              {/* 기분 */}
              <Text style={[styles.fieldLabel, { color: colors.textMuted, marginTop: 10 }]}>당시 기분</Text>
              <View style={styles.chipLine}>
                {MOODS.map((m) => {
                  const active = mood === m.key;
                  return (
                    <Pressable
                      key={m.key}
                      style={[styles.chipCell, styles.chip, {
                        backgroundColor: active ? colors.accentCta : colors.surfaceMuted,
                        borderColor: active ? colors.accentCta : colors.border,
                      }]}
                      onPress={() => setMood(prev => prev === m.key ? null : m.key)}
                    >
                      <Text style={[styles.chipTextSm, { color: active ? '#fff' : colors.text }]} numberOfLines={1}>{m.label}</Text>
                    </Pressable>
                  );
                })}
              </View>

              {/* 태그 */}
              <Text style={[styles.fieldLabel, { color: colors.textMuted, marginTop: 12 }]}>태그</Text>
              <View style={styles.chipLine}>
                {TAG_PRESETS.map((t) => {
                  const active = tagsText.split(',').map(x => x.trim()).includes(t);
                  return (
                    <Pressable
                      key={t}
                      style={[styles.chipCell, styles.chip, {
                        backgroundColor: active ? colors.accentCta : colors.surfaceMuted,
                        borderColor: active ? colors.accentCta : colors.border,
                      }]}
                      onPress={() => {
                        const tags = tagsText.split(',').map(x => x.trim()).filter(Boolean);
                        const next = active ? tags.filter(x => x !== t) : [...tags, t];
                        setTagsText(next.join(', '));
                      }}
                    >
                      <Text style={[styles.chipTextSm, { color: active ? '#fff' : colors.text }]} numberOfLines={1}>{t}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <TextInput
                style={[styles.tagInput, { borderColor: colors.borderInput, backgroundColor: colors.inputBg, color: colors.text }]}
                placeholder="쉼표로 구분"
                placeholderTextColor={colors.placeholder}
                value={tagsText}
                onChangeText={setTagsText}
              />
            </ScrollView>

            {/* 저장 버튼 */}
            <Pressable
              style={[styles.saveBtn, { backgroundColor: colors.accentCta, opacity: saving ? 0.6 : 1 }]}
              onPress={handleSave}
              disabled={saving}
            >
              {saving
                ? <ActivityIndicator color="#fff" />
                : <Text style={styles.saveBtnText}>저장</Text>
              }
            </Pressable>
          </>
        ) : (
          // ── 1단계: 프리셋 선택 ──
          <>
            <View style={styles.quickHeader}>
              <Text style={[styles.quickTitle, { color: colors.text }]}>빠른 입력</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {quickPresets.length > 0 && (
                  <>
                    <Pressable
                      style={[styles.quickAddBtn, {
                        borderColor: quickEditMode === 'edit' ? colors.accentCta : colors.border,
                        backgroundColor: quickEditMode === 'edit' ? colors.accentCta : colors.surfaceMuted,
                      }]}
                      onPress={() => setQuickEditMode(quickEditMode === 'edit' ? null : 'edit')}
                    >
                      <MaterialIcons name="edit" size={13} color={quickEditMode === 'edit' ? '#fff' : colors.textSec} />
                      <Text style={[styles.quickAddBtnText, { color: quickEditMode === 'edit' ? '#fff' : colors.textSec }]}>수정</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.quickAddBtn, {
                        borderColor: quickEditMode === 'delete' ? colors.logoutText : colors.border,
                        backgroundColor: quickEditMode === 'delete' ? colors.logoutText : colors.surfaceMuted,
                      }]}
                      onPress={() => setQuickEditMode(quickEditMode === 'delete' ? null : 'delete')}
                    >
                      <MaterialIcons name="delete-outline" size={13} color={quickEditMode === 'delete' ? '#fff' : colors.textSec} />
                      <Text style={[styles.quickAddBtnText, { color: quickEditMode === 'delete' ? '#fff' : colors.textSec }]}>삭제</Text>
                    </Pressable>
                  </>
                )}
                <Pressable
                  style={[styles.quickAddBtn, { borderColor: colors.border, backgroundColor: colors.surfaceMuted }]}
                  onPress={() => { setQuickEditMode(null); setEditingPreset(null); setPresetModalVisible(true); }}
                >
                  <MaterialIcons name="add" size={15} color={colors.textSec} />
                  <Text style={[styles.quickAddBtnText, { color: colors.textSec }]}>추가</Text>
                </Pressable>
              </View>
            </View>

            {quickEditMode && (
              <Text style={{ fontSize: 12, color: colors.textMuted, fontWeight: '600' }}>
                {quickEditMode === 'edit' ? '수정할 항목을 선택하세요' : '삭제할 항목을 선택하세요'}
              </Text>
            )}

            {quickPresets.length === 0 ? (
              <Pressable
                style={[styles.quickEmpty, { borderColor: colors.border }]}
                onPress={() => { setEditingPreset(null); setPresetModalVisible(true); }}
              >
                <MaterialIcons name="add-circle-outline" size={20} color={colors.emptyIcon} />
                <Text style={[styles.quickEmptyText, { color: colors.textMuted }]}>
                  자주 쓰는 소비를 등록해보세요
                </Text>
              </Pressable>
            ) : (
              <View style={styles.quickPresetGrid}>
                {quickPresets.map((preset: QuickPreset) => (
                  <Pressable
                    key={preset.id}
                    style={({ pressed }: any) => [
                      styles.quickPresetBtn,
                      { width: btnSize, height: btnSize, borderRadius: btnSize / 2 },
                      {
                        backgroundColor: quickEditMode === 'delete'
                          ? '#fee2e2'
                          : quickEditMode === 'edit'
                            ? '#e0f2fe'
                            : (preset.color ?? colors.surfaceMuted),
                        opacity: pressed ? 0.75 : 1,
                        borderWidth: quickEditMode ? 1.5 : 0,
                        borderColor: quickEditMode === 'delete'
                          ? colors.logoutText
                          : quickEditMode === 'edit'
                            ? colors.accentCta
                            : 'transparent',
                      },
                    ]}
                    onPress={() => {
                      if (quickEditMode === 'edit') {
                        setEditingPreset(preset);
                        setPresetModalVisible(true);
                        setQuickEditMode(null);
                      } else if (quickEditMode === 'delete') {
                        Alert.alert(
                          '삭제 확인',
                          `'${preset.label}'을(를) 삭제하시겠습니까?`,
                          [
                            { text: '취소', style: 'cancel' },
                            { text: '삭제', style: 'destructive', onPress: () => handleDeletePreset(preset.id) },
                          ]
                        );
                      } else {
                        // 2단계로 이동
                        setSelectedPreset(preset);
                      }
                    }}
                  >
                    <Text style={[styles.quickPresetLabel, {
                      color: (preset.color && preset.color !== '#94A3B8' && !quickEditMode) ? '#fff' : colors.text
                    }]} numberOfLines={2}>
                      {preset.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}
          </>
        )}
      </View>
      </View>

      <QuickPresetModal
        visible={presetModalVisible}
        preset={editingPreset}
        onClose={() => { setPresetModalVisible(false); setEditingPreset(null); }}
        onSave={(preset: QuickPreset) => {
          handleAddPreset(preset);
          setPresetModalVisible(false);
          setEditingPreset(null);
        }}
      />
    </Modal>
  );
}

// ── 메인 레이아웃 ─────────────────────────────────────────
export default function TabsLayout() {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();
  const headerTitleColor = isDark ? colors.headerTint : colors.onPrimary;

  const { account } = useAuth();
  const { createExpense } = useExpenses();
  const [showQuickSheet, setShowQuickSheet] = useState(false);
  const [quickPresets, setQuickPresets] = useState<QuickPreset[]>([]);


  useEffect(() => {
    AsyncStorage.getItem('@rw_quick_presets').then((val) => {
      if (val) { try { setQuickPresets(JSON.parse(val)); } catch {} }
    });
  }, []);

  const handleAddPreset = useCallback((preset: QuickPreset) => {
    setQuickPresets(prev => {
      const exists = prev.findIndex(p => p.id === preset.id);
      const next = exists >= 0
        ? prev.map(p => p.id === preset.id ? preset : p)
        : [...prev, preset];
      AsyncStorage.setItem('@rw_quick_presets', JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const handleDeletePreset = useCallback((id: string) => {
    setQuickPresets(prev => {
      const next = prev.filter(p => p.id !== id);
      AsyncStorage.setItem('@rw_quick_presets', JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <Tabs
        screenOptions={{
          headerShown: true,
          tabBarActiveTintColor: colors.tabActive,
          tabBarInactiveTintColor: colors.tabInactive,
          tabBarStyle: {
            height: 76, paddingBottom: 10, paddingTop: 8,
            backgroundColor: colors.tabBarBg,
            borderTopColor: colors.tabBarBorder,
            borderTopWidth: StyleSheet.hairlineWidth,
          },
          tabBarLabelStyle: styles.tabLabel,
          headerStyle: { backgroundColor: 'transparent' },
          headerBackground: () => (
            <TabHeaderBackground
              isDark={isDark}
              gradientStart={colors.headerGradientStart}
              gradientEnd={colors.headerGradientEnd}
              solid={colors.accentCta}
            />
          ),
          headerTintColor: headerTitleColor,
          headerTitleStyle: { color: headerTitleColor, fontWeight: '800', fontSize: 17 },
          headerShadowVisible: false,
        }}
      >
        <Tabs.Screen name="index" options={{ title: '후회가계부', tabBarLabel: '홈', tabBarIcon: ({ color, size }) => <MaterialIcons name="home" size={size} color={color} /> }} />
        <Tabs.Screen name="reviews" options={{ title: '리뷰', tabBarIcon: ({ color, size }) => <MaterialIcons name="checklist" size={size} color={color} /> }} />
        <Tabs.Screen
          name="add"
          options={{
            title: '추가', tabBarLabel: '추가',
            tabBarButton: () => (
              <AddTabButton
                onPress={() => router.push('/add-expense')}
                onLongPress={() => { setShowQuickSheet(true); }}
                fabColor={colors.accentCta}
                labelColor={colors.addTabLabel}
              />
            ),
          }}
        />
        <Tabs.Screen name="insights" options={{ title: '인사이트', tabBarIcon: ({ color, size }) => <MaterialIcons name="insights" size={size} color={color} /> }} />
        <Tabs.Screen name="settings" options={{ title: '설정', tabBarIcon: ({ color, size }) => <MaterialIcons name="settings" size={size} color={color} /> }} />
      </Tabs>

      <QuickInputSheet
        visible={showQuickSheet}
        onClose={() => setShowQuickSheet(false)}
        quickPresets={quickPresets}
        handleDeletePreset={handleDeletePreset}
        handleAddPreset={handleAddPreset}
        colors={colors}
        width={width}
        onSaved={() => { (globalThis as any).__reloadHomeExpenses?.(); }}
        account={account}
        createExpense={createExpense}
      />
    </>
  );
}

const styles = StyleSheet.create({
  tabLabel: { fontSize: 11, fontWeight: '700' },
  addTabButton: { alignItems: 'center', justifyContent: 'center' },
  addTabInner: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    marginTop: -18,
    shadowColor: '#1a2d4a', shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22, shadowRadius: 10, elevation: 8,
  },
  addTabLabel: { marginTop: 2, fontSize: 11, fontWeight: '700' },
  sheetRoot: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    borderTopLeftRadius: 22, borderTopRightRadius: 22,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16, paddingTop: 12, gap: 6,
    maxHeight: '75%',
  },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 4 },
  quickHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  quickTitle: { fontSize: 15, fontWeight: '800' },
  quickAddBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 10, borderWidth: StyleSheet.hairlineWidth,
  },
  quickAddBtnText: { fontSize: 12, fontWeight: '700' },
  quickEmpty: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 20, paddingHorizontal: 14,
    borderRadius: 12, borderWidth: 1.5, borderStyle: 'dashed', justifyContent: 'center',
  },
  quickEmptyText: { fontSize: 13, fontWeight: '600' },
  quickPresetGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingVertical: 2 },
  quickPresetBtn: { alignItems: 'center', justifyContent: 'center' },
  quickPresetLabel: { fontSize: 11, fontWeight: '700', textAlign: 'center', paddingHorizontal: 4 },
  // 2단계 스타일
  fieldLabel: { fontSize: 12, fontWeight: '700', marginBottom: 6 },
  chipRow: { flexDirection: 'column', gap: 8 },
  chipLine: { flexDirection: 'row', gap: 8 },
  chipCell: { flex: 1, minWidth: 0, borderRadius: 16 },
  chip: {
    paddingVertical: 7,
    borderRadius: 16, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  chipSm: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 16,
  },
  chipText: { fontSize: 13, fontWeight: '600' },
  chipTextSm: { fontSize: 11, fontWeight: '600' },
  tagInput: {
    marginTop: 8, height: 42, borderRadius: 10, borderWidth: 1.5,
    paddingHorizontal: 12, fontSize: 14,
  },
  saveBtn: {
    height: 52, borderRadius: 14,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 4, marginHorizontal: 16,
  },
  saveBtnText: { fontSize: 16, fontWeight: '900', color: '#fff' },
});
