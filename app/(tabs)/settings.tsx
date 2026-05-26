import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  TextInput,
  Platform,
  ScrollView,
  Switch,
  Modal,
  Pressable,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/theme/ThemeContext';
import { DEFAULT_PRESETS, isCustomHex } from '@/theme/ThemeContext';
import { ColorPickerModal } from '@/components/ColorPickerModal';
import { useDebouncedEffect } from '@/hooks/useDebouncedEffect';
import { SettingsCard } from '@/components/SettingsCard';
import { SettingsRow } from '@/components/SettingsRow';
import { Chip } from '@/components/Chip';
import {
  DEFAULT_REVIEW_REMINDER_TIME,
  resolveReviewDelayDays,
  resolveReviewReminderEnabled,
  resolveReviewReminderTime,
} from '@/lib/accountSettings';
import AlarmTimeWheel from '@/components/AlarmTimeWheel';

type IncomeUnit = 'base' | 'man' | 'baekman';
type ReviewDelayDay = 1 | 3 | 7;

const REVIEW_DELAY_OPTIONS: ReviewDelayDay[] = [1, 3, 7];

function normalizeDelayDays(days: (1 | 3 | 7 | 30)[]): ReviewDelayDay[] {
  const filtered = days.filter((d): d is ReviewDelayDay => d === 1 || d === 3 || d === 7);
  if (filtered.length === 0) return [3];
  const pick = filtered.includes(3) ? 3 : filtered.sort((a, b) => a - b)[0];
  return [pick];
}

function parseReminderTimeToDate(time: string): Date {
  const [hh, mm] = time.split(':');
  const hour24 = Number(hh);
  const minute = Number(mm || '0');
  const next = new Date();
  if (!Number.isNaN(hour24) && !Number.isNaN(minute)) {
    next.setHours(hour24, minute, 0, 0);
  } else {
    const [dh, dm] = DEFAULT_REVIEW_REMINDER_TIME.split(':').map((x) => Number(x));
    next.setHours(dh, dm, 0, 0);
  }
  return next;
}

export default function SettingsScreen() {
  const router = useRouter();
  const isFocusedRef = useRef(false);
  const { user, account, logout, updateReviewReminderSettings, updateReviewDelayDays, updateMonthlyIncome, isGuest } = useAuth();
  const { colors, isDark, setDarkMode, accentKey, setAccentKey, customPresets, addCustomPreset, removeCustomPreset } = useTheme();
  const [timeValue, setTimeValue] = useState<Date>(() => parseReminderTimeToDate(DEFAULT_REVIEW_REMINDER_TIME));
  const [reviewReminderEnabled, setReviewReminderEnabled] = useState(true);
  const [reviewDelayDays, setReviewDelayDays] = useState<ReviewDelayDay[]>([3]);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [accentExpanded, setAccentExpanded] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [colorPickerMode, setColorPickerMode] = useState<'select' | 'add'>('select');
  /** iOS 모달에서 스크롤과 겹치지 않게 휠 조작용 */
  const [pendingTime, setPendingTime] = useState<Date>(() => new Date());
  const [saving, setSaving] = useState(false);
  const [notificationSaved, setNotificationSaved] = useState(false);
  const [incomeAmount, setIncomeAmount] = useState(
    account?.monthlyIncomeAmount?.toString() || '0'
  );
  const [incomeCurrency, setIncomeCurrency] = useState<'KRW' | 'USD'>(
    account?.monthlyIncomeCurrency || 'KRW'
  );
  const [incomeUnit, setIncomeUnit] = useState<IncomeUnit>('base');
  const [savingIncome, setSavingIncome] = useState(false);
  const [incomeSaved, setIncomeSaved] = useState(false);
  const [exchangeRate, setExchangeRate] = useState(
    String(account?.exchangeRateUsdToKrw ?? 1470.05)
  );
  const incomeInitRef = useRef(false);
  const reminderInitRef = useRef(false);
  const scrollRef = useRef<ScrollView>(null);

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  useFocusEffect(
    React.useCallback(() => {
      isFocusedRef.current = true;
      return () => {
        isFocusedRef.current = false;
      };
    }, [])
  );

  useEffect(() => {
    const t = resolveReviewReminderTime(account);
    setTimeValue(parseReminderTimeToDate(t));
    setReviewReminderEnabled(resolveReviewReminderEnabled(account));
    setReviewDelayDays((prev) => {
      const next = normalizeDelayDays(resolveReviewDelayDays(account));
      if (prev.length === next.length && prev[0] === next[0]) {
        return prev;
      }
      return next;
    });
  }, [account?.reviewReminderTime, account?.notificationTime, account?.reviewReminderEnabled, account?.reviewDelayDays]);

  useEffect(() => {
    if (!account) return;
    const raw =
      typeof account.monthlyIncomeAmount === 'number'
        ? account.monthlyIncomeAmount.toString()
        : '0';
    setIncomeAmount(formatNumber(raw, account.monthlyIncomeCurrency === 'USD'));
    setIncomeCurrency(account.monthlyIncomeCurrency || 'KRW');
    setExchangeRate(String(account.exchangeRateUsdToKrw ?? 1470.05));
  }, [account?.monthlyIncomeAmount, account?.monthlyIncomeCurrency, account?.exchangeRateUsdToKrw]);

  const formatNumber = (value: string, allowDecimal: boolean) => {
    const cleaned = value.replace(/,/g, '');
    if (allowDecimal) {
      const parts = cleaned.replace(/[^0-9.]/g, '').split('.');
      const integerPart = parts[0] || '';
      const decimalPart = parts[1] ? parts[1].slice(0, 2) : '';
      const formattedInt = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
      return decimalPart ? `${formattedInt}.${decimalPart}` : formattedInt;
    }
    const digits = cleaned.replace(/[^0-9]/g, '');
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  };

  const parseIncomeAmount = () => {
    const raw = incomeAmount.replace(/,/g, '').trim();
    const parsed = incomeCurrency === 'USD' ? Number(raw) : Number(raw);
    if (Number.isNaN(parsed)) {
      return null;
    }
    const multiplier = incomeUnit === 'man' ? 10000 : incomeUnit === 'baekman' ? 1000000 : 1;
    return Math.round(parsed * multiplier);
  };

  const formatTimeValue = (date: Date) => {
    const hour = date.getHours();
    const minute = date.getMinutes();
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  };

  const formatTimeAmPm = (date: Date) => {
    const hour = date.getHours();
    const minute = date.getMinutes();
    const period = hour >= 12 ? 'PM' : 'AM';
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${String(hour12).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${period}`;
  };

  const selectedDelayDay = reviewDelayDays[0] ?? 3;

  const handleAndroidTimeChange = (event: { type?: string }, selectedDate?: Date) => {
    setShowTimePicker(false);
    if (Platform.OS === 'android' && event.type === 'dismissed') {
      return;
    }
    if (selectedDate) {
      setTimeValue(selectedDate);
    }
  };

  const openTimePicker = () => {
    if (!reviewReminderEnabled) return;
    setPendingTime(timeValue);
    setShowTimePicker(true);
  };

  const confirmIosTime = () => {
    setTimeValue(pendingTime);
    setShowTimePicker(false);
  };

  const dismissTimePicker = () => {
    setShowTimePicker(false);
  };

  const saveReviewReminder = async (date: Date, enabled: boolean) => {
    try {
      setSaving(true);
      await updateReviewReminderSettings(enabled, formatTimeValue(date));
      setNotificationSaved(true);
      scrollToTop();
      setTimeout(() => setNotificationSaved(false), 2000);
    } catch {
      Alert.alert('리뷰 알림', '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const saveReviewDelayDays = async (days: ReviewDelayDay[]) => {
    try {
      const accountDays = resolveReviewDelayDays(account);
      if (accountDays.length === days.length && accountDays.every((v, i) => v === days[i])) {
        return;
      }
      setSaving(true);
      await updateReviewDelayDays(days);
      setNotificationSaved(true);
      scrollToTop();
      setTimeout(() => setNotificationSaved(false), 2000);
    } catch {
      Alert.alert('리뷰 주기', '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveMonthlyIncome = async (showAlert: boolean = true) => {
    const parsed = parseIncomeAmount();
    if (parsed === null || parsed < 0) {
      if (showAlert) {
        Alert.alert('월 수입', '0 이상의 숫자를 입력해주세요.');
      }
      return;
    }
    const rate = Number(exchangeRate.replace(/,/g, '').trim());
    if (Number.isNaN(rate) || rate <= 0) {
      if (showAlert) {
        Alert.alert('환율', '유효한 환율을 입력해주세요.');
      }
      return;
    }

    const prevRate = account?.exchangeRateUsdToKrw ?? 1470.05;
    if (
      account &&
      parsed === account.monthlyIncomeAmount &&
      incomeCurrency === (account.monthlyIncomeCurrency || 'KRW') &&
      Math.abs(rate - prevRate) < 0.0001
    ) {
      return;
    }

    try {
      setSavingIncome(true);
      await updateMonthlyIncome(parsed, incomeCurrency, rate);
      setIncomeSaved(true);
      scrollToTop();
      setTimeout(() => setIncomeSaved(false), 2000);
    } catch {
      Alert.alert('월 수입', '저장에 실패했습니다.');
    } finally {
      setSavingIncome(false);
    }
  };

  useDebouncedEffect(() => {
    if (!isFocusedRef.current) return;
    if (!account?.id) return;
    if (!incomeInitRef.current) {
      incomeInitRef.current = true;
      return;
    }
    void handleSaveMonthlyIncome(false);
  }, [incomeAmount, incomeCurrency, incomeUnit, exchangeRate, account?.id], 800);

  useDebouncedEffect(() => {
    if (!isFocusedRef.current) return;
    if (!account?.id) return;
    if (!reminderInitRef.current) {
      reminderInitRef.current = true;
      return;
    }
    void saveReviewReminder(timeValue, reviewReminderEnabled);
  }, [timeValue, reviewReminderEnabled, account?.id], 500);

  useDebouncedEffect(() => {
    if (!isFocusedRef.current) return;
    if (!account?.id) return;
    if (!reminderInitRef.current) return;
    void saveReviewDelayDays(reviewDelayDays);
  }, [reviewDelayDays, account?.id], 500);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.bg,
        },
        content: {
          paddingHorizontal: 16,
          paddingTop: 10,
          paddingBottom: 32,
          gap: 20,
        },
        saveHint: {
          color: colors.textSec,
          fontWeight: '700',
          fontSize: 13,
          marginBottom: -8,
          minHeight: 18,
          marginLeft: 4,
        },
        cardInset: {
          paddingHorizontal: 16,
          paddingBottom: 16,
          paddingTop: 4,
          gap: 14,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.border,
        },
        fieldLabel: {
          fontSize: 13,
          fontWeight: '600',
          color: colors.textMuted,
          marginBottom: -6,
        },
        timeField: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          borderRadius: 12,
          backgroundColor: colors.inputBg,
          paddingHorizontal: 14,
          paddingVertical: 12,
        },
        timeFieldText: {
          fontSize: 15,
          fontWeight: '700',
          color: colors.text,
        },
        delayRow: {
          flexDirection: 'row',
          gap: 8,
        },
        delayChip: {
          flex: 1,
          paddingVertical: 9,
          borderRadius: 12,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          backgroundColor: colors.surfaceMuted,
          alignItems: 'center',
        },
        delayChipActive: {
          backgroundColor: colors.accentCta,
          borderColor: colors.accentCta,
        },
        delayChipText: {
          fontSize: 13,
          fontWeight: '800',
          color: colors.textSec,
        },
        delayChipTextActive: {
          color: colors.onPrimary,
        },
        incomeBody: {
          padding: 16,
          gap: 14,
        },
        infoRowColumn: {
          gap: 10,
        },
        incomeRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        },
        unitRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: 8,
        },
        unitLabel: {
          fontSize: 14,
          color: colors.textSec,
        },
        chipRow: {
          flexDirection: 'row',
          gap: 8,
          flexWrap: 'wrap',
        },
        incomeInput: {
          minWidth: 90,
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 6,
          paddingHorizontal: 8,
          paddingVertical: 6,
          textAlign: 'right',
          color: colors.text,
          backgroundColor: colors.inputBg,
        },
        incomeLabel: {
          fontSize: 14,
          fontWeight: '600',
          color: colors.textMuted,
        },
        accentHeader: {
          flexDirection: 'row', alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16, paddingVertical: 14,
        },
        accentHeaderRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
        accentHeaderPreview: { width: 20, height: 20, borderRadius: 10 },
        accentHeaderLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
        accentBody: {
          paddingHorizontal: 16, paddingBottom: 16, gap: 14,
          borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border,
        },
        sectionLabel: { fontSize: 12, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.5 },
        swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
        swatchWrap: { alignItems: 'center', gap: 4 },
        swatch: { width: 38, height: 38, borderRadius: 19, borderWidth: 2.5, borderColor: 'transparent' },
        swatchActive: { borderColor: colors.text, transform: [{ scale: 1.15 }] },
        swatchLabel: { fontSize: 10, fontWeight: '600', color: colors.textMuted },
        customSwatchWrap: { alignItems: 'center', gap: 4 },
        deleteBtn: {
          position: 'absolute', top: -4, right: -4,
          width: 16, height: 16, borderRadius: 8,
          backgroundColor: colors.logoutText,
          alignItems: 'center', justifyContent: 'center',
        },
        addSwatchBtn: {
          width: 38, height: 38, borderRadius: 19,
          borderWidth: 2, borderColor: colors.border,
          borderStyle: 'dashed',
          alignItems: 'center', justifyContent: 'center',
          backgroundColor: colors.surfaceMuted,
        },
        directBtn: {
          flexDirection: 'row', alignItems: 'center', gap: 10,
          paddingVertical: 11, paddingHorizontal: 14,
          borderRadius: 12, borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border, backgroundColor: colors.surfaceMuted,
        },
        directBtnPreview: { width: 24, height: 24, borderRadius: 12 },
        directBtnText: { flex: 1, fontSize: 13, fontWeight: '700', color: colors.textSec },
        guestBanner: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          backgroundColor: '#FFF3CD',
          borderRadius: 14,
          padding: 14,
          borderWidth: 1,
          borderColor: '#FFE69C',
          marginBottom: 4,
        },
        guestBannerText: {
          flex: 1,
          fontSize: 13,
          fontWeight: '600',
          color: '#856404',
          lineHeight: 19,
        },
        guestSignupBtn: {
          backgroundColor: '#856404',
          borderRadius: 10,
          paddingHorizontal: 12,
          paddingVertical: 8,
        },
        guestSignupBtnText: {
          fontSize: 12,
          fontWeight: '800',
          color: '#fff',
        },
        logoutButton: {
          height: 52,
          borderRadius: 16,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.logoutBorder,
          backgroundColor: colors.surface,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          marginTop: 4,
        },
        logoutText: {
          color: colors.logoutText,
          fontWeight: '800',
          fontSize: 16,
        },
        helperText: {
          fontSize: 12,
          color: colors.textMuted,
          fontWeight: '600',
        },
        modalSheet: {
          backgroundColor: colors.surface,
          borderTopLeftRadius: 16,
          borderTopRightRadius: 16,
          paddingBottom: 28,
          paddingTop: 8,
        },
        modalToolbar: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        modalBtn: {
          paddingVertical: 8,
          paddingHorizontal: 4,
        },
        modalBtnCancel: {
          fontSize: 16,
          fontWeight: '700',
          color: colors.textSec,
        },
        modalBtnOk: {
          fontSize: 16,
          fontWeight: '900',
          color: colors.primaryDark,
        },
        modalPickerWrap: {
          alignItems: 'center',
          paddingVertical: 20,
          paddingHorizontal: 16,
          minHeight: 120,
        },
      }),
    [colors]
  );

  const handleLogout = () => {
    Alert.alert('로그아웃', '정말 로그아웃하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/(tabs)');
        },
      },
    ]);
  };

  return (
    <ScrollView
      ref={scrollRef}
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
    >
        <Text style={styles.saveHint}>
          {savingIncome || saving ? '저장 중...' : incomeSaved || notificationSaved ? '저장됨' : ''}
        </Text>

        <SettingsCard title="계정">
          <SettingsRow
            icon="person-outline"
            title="닉네임"
            subtitle={(account?.nickname ?? '').trim() || '미설정'}
            onPress={() => router.push('/settings/change-nickname')}
          />
          <SettingsRow
            icon="person-outline"
            title="이메일"
            subtitle={user?.email || '-'}
            onPress={() => router.push('/settings/change-email')}
            last
          />
        </SettingsCard>

        <SettingsCard title="월 수입">
          <View style={styles.incomeBody}>
            <View style={styles.infoRowColumn}>
              <Text style={styles.incomeLabel}>월 수입 (향후 인사이트·비율 분석에 사용)</Text>
              <View style={styles.incomeRow}>
                <TextInput
                  value={incomeAmount}
                  onChangeText={(value) =>
                    setIncomeAmount(formatNumber(value, incomeCurrency === 'USD'))
                  }
                  placeholder="0"
                  keyboardType={incomeCurrency === 'USD' ? 'decimal-pad' : 'number-pad'}
                  style={styles.incomeInput}
                />
                <View style={styles.chipRow}>
                  <Chip label="KRW" active={incomeCurrency === 'KRW'} onPress={() => setIncomeCurrency('KRW')} />
                  <Chip label="USD" active={incomeCurrency === 'USD'} onPress={() => setIncomeCurrency('USD')} />
                </View>
              </View>
            </View>
            {incomeCurrency === 'KRW' && (
              <View style={styles.unitRow}>
                <Text style={styles.unitLabel}>입력 단위</Text>
                <View style={styles.chipRow}>
                  <Chip label="원" active={incomeUnit === 'base'} onPress={() => setIncomeUnit('base')} />
                  <Chip label="만원" active={incomeUnit === 'man'} onPress={() => setIncomeUnit('man')} />
                  <Chip label="백만원" active={incomeUnit === 'baekman'} onPress={() => setIncomeUnit('baekman')} />
                </View>
              </View>
            )}
            {incomeCurrency === 'USD' && (
              <View style={styles.incomeRow}>
                <Chip label="USD→KRW 환율" disabled />
                <TextInput
                  value={exchangeRate}
                  onChangeText={(value) => setExchangeRate(formatNumber(value, true))}
                  placeholder="1470.05"
                  keyboardType="decimal-pad"
                  style={styles.incomeInput}
                />
              </View>
            )}
          </View>
        </SettingsCard>

        <SettingsCard title="알림">
          <SettingsRow
            icon="notifications-none"
            title="리뷰 알림"
            subtitle="정기적으로 리뷰 요청 알림을 받으세요"
            showChevron={false}
            rightElement={
              <Switch
                value={reviewReminderEnabled}
                onValueChange={setReviewReminderEnabled}
                trackColor={{ false: colors.border, true: colors.accentCta }}
                thumbColor="#fff"
                ios_backgroundColor={colors.border}
              />
            }
          />
          <View style={[styles.cardInset, { opacity: reviewReminderEnabled ? 1 : 0.45 }]}>
            <Text style={styles.fieldLabel}>알림 시간</Text>
            <TouchableOpacity
              style={styles.timeField}
              onPress={openTimePicker}
              disabled={!reviewReminderEnabled}
              activeOpacity={0.85}
            >
              <Text style={styles.timeFieldText}>{formatTimeAmPm(timeValue)}</Text>
              <MaterialIcons name="schedule" size={20} color={colors.textMuted} />
            </TouchableOpacity>

            <Text style={styles.fieldLabel}>피드백 주기 (소비 후 며칠 뒤에 리뷰 요청)</Text>
            <View style={styles.delayRow}>
              {REVIEW_DELAY_OPTIONS.map((d) => {
                const active = selectedDelayDay === d;
                return (
                  <TouchableOpacity
                    key={d}
                    style={[styles.delayChip, active && styles.delayChipActive]}
                    onPress={() => setReviewDelayDays([d])}
                    disabled={!reviewReminderEnabled}
                    activeOpacity={0.88}
                  >
                    <Text style={[styles.delayChipText, active && styles.delayChipTextActive]}>{d}일</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
          {Platform.OS === 'android' && showTimePicker && reviewReminderEnabled && (
            <DateTimePicker
              value={timeValue}
              mode="time"
              display="default"
              onChange={handleAndroidTimeChange}
            />
          )}
          {(Platform.OS === 'ios' || Platform.OS === 'web') && (
            <Modal
              visible={showTimePicker && reviewReminderEnabled}
              transparent
              animationType="fade"
              onRequestClose={dismissTimePicker}
            >
              <View style={{ flex: 1 }}>
                <Pressable
                  style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}
                  onPress={dismissTimePicker}
                />
                <View style={styles.modalSheet}>
                  <View style={styles.modalToolbar}>
                    <TouchableOpacity style={styles.modalBtn} onPress={dismissTimePicker}>
                      <Text style={styles.modalBtnCancel}>취소</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.modalBtn} onPress={confirmIosTime}>
                      <Text style={styles.modalBtnOk}>확인</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.modalPickerWrap}>
                    {Platform.OS === 'web' ? (
                      <AlarmTimeWheel
                        value={pendingTime}
                        onChange={setPendingTime}
                        colors={{ text: colors.text, textSec: colors.textSec }}
                      />
                    ) : (
                      <DateTimePicker
                        value={pendingTime}
                        mode="time"
                        display="spinner"
                        locale="ko_KR"
                        themeVariant={isDark ? 'dark' : 'light'}
                        onChange={(_, date) => {
                          if (date) setPendingTime(date);
                        }}
                      />
                    )}
                  </View>
                </View>
              </View>
            </Modal>
          )}
        </SettingsCard>

        <SettingsCard title="보안">
          <SettingsRow
            icon="lock-outline"
            title="비밀번호 변경"
            subtitle="변경하기"
            onPress={() => router.push('/settings/change-password')}
          />
          <SettingsRow
            icon="shield"
            title="로그인 기기 관리"
            subtitle="보기"
            onPress={() => Alert.alert('준비 중', '로그인 기기 관리는 곧 제공할 예정이에요.')}
            last
          />
        </SettingsCard>

        {/* ── 테마 색상 카드 ── */}
        <View style={{
          backgroundColor: colors.surface, borderRadius: 16,
          borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: 'hidden',
        }}>
          {/* 헤더 (접기/펼치기) */}
          <TouchableOpacity style={styles.accentHeader} onPress={() => setAccentExpanded(v => !v)} activeOpacity={0.8}>
            <Text style={{ fontSize: 15, fontWeight: '700', color: colors.text }}>테마 색상</Text>
            <View style={styles.accentHeaderRight}>
              {/* 현재 색 미리보기 */}
              <View style={[styles.accentHeaderPreview, { backgroundColor: (() => {
                if (isDark) return '#3B82F6';
                if (isCustomHex(accentKey)) return accentKey;
                return [...DEFAULT_PRESETS, ...customPresets].find(p => p.key === accentKey)?.color ?? '#1a2d4a';
              })() }]} />
              <Text style={styles.accentHeaderLabel}>
                {isDark ? '다크모드 고정' : (() => {
                  if (isCustomHex(accentKey)) return accentKey.toUpperCase();
                  return [...DEFAULT_PRESETS, ...customPresets].find(p => p.key === accentKey)?.label ?? '커스텀';
                })()}
              </Text>
              <MaterialIcons name={accentExpanded ? 'keyboard-arrow-up' : 'keyboard-arrow-down'} size={22} color={colors.textMuted} />
            </View>
          </TouchableOpacity>

          {/* 펼쳐진 본문 */}
          {accentExpanded && (
            <View style={styles.accentBody}>
              {isDark ? (
                <Text style={{ fontSize: 13, fontWeight: '600', color: colors.textMuted, lineHeight: 19 }}>
                  다크 모드에서는 테마 색상이 적용되지 않아요.
  라이트 모드에서 색상을 설정해두면 전환 시 반영돼요.
                </Text>
              ) : (
                <>
                  {/* 기본 프리셋 */}
                  <Text style={styles.sectionLabel}>기본 색상</Text>
                  <View style={styles.swatchRow}>
                    {DEFAULT_PRESETS.map((p) => {
                      const isActive = accentKey === p.key;
                      return (
                        <TouchableOpacity key={p.key} style={styles.swatchWrap} onPress={() => setAccentKey(p.key)} activeOpacity={0.8}>
                          <View style={[styles.swatch, { backgroundColor: p.color }, isActive && styles.swatchActive]} />
                          <Text style={[styles.swatchLabel, isActive && { color: colors.text, fontWeight: '800' }]}>{p.label}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {/* 커스텀 프리셋 */}
                  {customPresets.length > 0 && (
                    <>
                      <Text style={styles.sectionLabel}>내 색상</Text>
                      <View style={styles.swatchRow}>
                        {customPresets.map((p) => {
                          const isActive = accentKey === p.key;
                          return (
                            <View key={p.key} style={styles.customSwatchWrap}>
                              <TouchableOpacity style={styles.swatchWrap} onPress={() => setAccentKey(p.key)} activeOpacity={0.8}>
                                <View style={[styles.swatch, { backgroundColor: p.color }, isActive && styles.swatchActive]} />
                                <Text style={[styles.swatchLabel, isActive && { color: colors.text, fontWeight: '800' }]}>
                                  {p.color.toUpperCase()}
                                </Text>
                              </TouchableOpacity>
                              {/* 삭제 버튼 */}
                              <TouchableOpacity
                                style={styles.deleteBtn}
                                onPress={() => {
                                  if (accentKey === p.key) setAccentKey('navy');
                                  removeCustomPreset(p.key);
                                }}
                              >
                                <MaterialIcons name="close" size={10} color="#fff" />
                              </TouchableOpacity>
                            </View>
                          );
                        })}
                        {/* + 추가 버튼 */}
                        <TouchableOpacity
                          style={styles.addSwatchBtn}
                          onPress={() => { setColorPickerMode('add'); setShowColorPicker(true); }}
                          activeOpacity={0.8}
                        >
                          <MaterialIcons name="add" size={20} color={colors.textMuted} />
                        </TouchableOpacity>
                      </View>
                    </>
                  )}

                  {/* 직접 선택 / 내 색상 추가 버튼 */}
                  <TouchableOpacity
                    style={styles.directBtn}
                    onPress={() => { setColorPickerMode(customPresets.length === 0 ? 'add' : 'select'); setShowColorPicker(true); }}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.directBtnPreview, {
                      backgroundColor: isCustomHex(accentKey) ? accentKey :
                        ([...DEFAULT_PRESETS, ...customPresets].find(p => p.key === accentKey)?.color ?? '#1a2d4a')
                    }]} />
                    <Text style={styles.directBtnText}>
                      {customPresets.length === 0 ? '직접 색상 추가하기' : '내 색상에 추가하기'}
                    </Text>
                    <MaterialIcons name="colorize" size={18} color={colors.textMuted} />
                  </TouchableOpacity>
                </>
              )}
            </View>
          )}
        </View>

        {/* 컬러피커 모달 */}
        <ColorPickerModal
          visible={showColorPicker}
          initialColor={isCustomHex(accentKey) ? accentKey : (
            [...DEFAULT_PRESETS, ...customPresets].find(p => p.key === accentKey)?.color ?? '#1a2d4a'
          )}
          onClose={() => setShowColorPicker(false)}
          onSelect={(hex) => {
            if (colorPickerMode === 'add') {
              const key = hex.toLowerCase();
              if (![...DEFAULT_PRESETS, ...customPresets].some(p => p.key === key)) {
                addCustomPreset({ key, label: hex.toUpperCase(), color: hex });
              }
              setAccentKey(key);
            } else {
              setAccentKey(hex);
            }
            setShowColorPicker(false);
          }}
          isDark={isDark}
        />

        <SettingsCard title="표시">
          <SettingsRow
            icon="visibility"
            title="다크 모드"
            subtitle="어두운 테마로 화면을 표시하세요"
            showChevron={false}
            rightElement={
              <Switch
                value={isDark}
                onValueChange={setDarkMode}
                trackColor={{ false: colors.border, true: colors.accentCta }}
                thumbColor="#fff"
                ios_backgroundColor={colors.border}
              />
            }
            last
          />
        </SettingsCard>

        {/* 게스트 배너 */}
      {isGuest && (
        <View style={styles.guestBanner}>
          <MaterialIcons name="person-outline" size={20} color="#856404" />
          <Text style={styles.guestBannerText}>
            게스트 모드예요. 앱 삭제 시 데이터가 사라져요. 회원가입하면 영구 보관돼요!
          </Text>
          <TouchableOpacity
            style={styles.guestSignupBtn}
            onPress={() => router.push('/(auth)/signup')}
          >
            <Text style={styles.guestSignupBtnText}>회원가입</Text>
          </TouchableOpacity>
        </View>
      )}

      <TouchableOpacity style={styles.logoutButton} onPress={handleLogout} activeOpacity={0.88}>
          <MaterialIcons name="logout" size={20} color={colors.logoutText} />
          <Text style={styles.logoutText}>로그아웃</Text>
        </TouchableOpacity>
    </ScrollView>
  );
}
