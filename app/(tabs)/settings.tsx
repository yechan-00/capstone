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
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/theme/ThemeContext';
import { useDebouncedEffect } from '@/hooks/useDebouncedEffect';
import { SettingsCard } from '@/components/SettingsCard';
import { Chip } from '@/components/Chip';
import {
  DEFAULT_REVIEW_REMINDER_TIME,
  resolveReviewDelayDays,
  resolveReviewReminderEnabled,
  resolveReviewReminderTime,
} from '@/lib/accountSettings';
import AlarmTimeWheel from '@/components/AlarmTimeWheel';

type IncomeUnit = 'base' | 'man' | 'baekman';

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
  const { user, account, logout, updateReviewReminderSettings, updateReviewDelayDays, updateMonthlyIncome } = useAuth();
  const { colors, isDark, setDarkMode } = useTheme();
  const [timeValue, setTimeValue] = useState<Date>(() => parseReminderTimeToDate(DEFAULT_REVIEW_REMINDER_TIME));
  const [reviewReminderEnabled, setReviewReminderEnabled] = useState(true);
  const [reviewDelayDays, setReviewDelayDays] = useState<(1 | 3 | 7 | 30)[]>([3]);
  const [showTimePicker, setShowTimePicker] = useState(false);
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
      const next = resolveReviewDelayDays(account);
      if (prev.length === next.length && prev.every((v, i) => v === next[i])) {
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

  const formatDisplayTime = (date: Date) => {
    const hour = date.getHours();
    const minute = date.getMinutes();
    const period = hour >= 12 ? '오후' : '오전';
    const hour12 = hour % 12 === 0 ? 12 : hour % 12;
    return `${period} ${String(hour12).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  };

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

  const saveReviewDelayDays = async (days: (1 | 3 | 7 | 30)[]) => {
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
          paddingHorizontal: 12,
          paddingTop: 6,
          paddingBottom: 28,
          gap: 12,
        },
        saveHint: {
          color: colors.textSec,
          fontWeight: '700',
          fontSize: 13,
          marginBottom: 2,
          minHeight: 18,
        },
        infoRow: {
          flexDirection: 'row',
          justifyContent: 'space-between',
          paddingVertical: 12,
          alignItems: 'center',
        },
        infoRowColumn: {
          paddingVertical: 12,
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
        label: {
          fontSize: 16,
          color: colors.textSec,
        },
        value: {
          fontSize: 16,
          color: colors.text,
          fontWeight: '500',
        },
        accountValue: {
          flex: 1,
          marginLeft: 12,
          textAlign: 'right',
        },
        logoutButton: {
          height: 52,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: colors.logoutBorder,
          backgroundColor: colors.surface,
          alignItems: 'center',
          justifyContent: 'center',
        },
        logoutText: {
          color: colors.logoutText,
          fontWeight: '900',
        },
        timeRow: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
        },
        timePickerButton: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 6,
          paddingHorizontal: 12,
          paddingVertical: 8,
          backgroundColor: colors.surface,
        },
        timePickerText: {
          fontSize: 14,
          color: colors.text,
          fontWeight: '600',
        },
        helperText: {
          marginTop: 8,
          fontSize: 12,
          color: colors.textMuted,
        },
        footer: {
          flex: 1,
          justifyContent: 'flex-end',
          alignItems: 'center',
          paddingBottom: 24,
        },
        footerText: {
          fontSize: 12,
          color: colors.textMuted,
        },
        securityRow: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        securityRowLast: {
          borderBottomWidth: 0,
        },
        securityLabel: {
          fontSize: 16,
          fontWeight: '700',
          color: colors.text,
        },
        securityChevron: {
          fontSize: 18,
          color: colors.textMuted,
          fontWeight: '700',
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
          <View style={styles.infoRow}>
            <Text style={styles.label}>닉네임</Text>
            <Text style={[styles.value, styles.accountValue]} numberOfLines={1}>
              {(account?.nickname ?? '').trim() || '미설정'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>이메일</Text>
            <Text style={[styles.value, styles.accountValue]} numberOfLines={1}>
              {user?.email || '-'}
            </Text>
          </View>
        </SettingsCard>

        <SettingsCard title="월 수입">
          <View style={styles.infoRowColumn}>
            <Text style={styles.label}>월 수입 (향후 인사이트·비율 분석에 사용)</Text>
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
            <View style={styles.infoRow}>
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
        </SettingsCard>

        <SettingsCard title="리뷰 알림">
          <View style={styles.infoRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.label}>리뷰 알림</Text>
              <Text style={[styles.helperText, { marginTop: 4 }]}>
                소비일 기준 3일째 되는 날, 아래 시각에 맞춰 알림을 보내요 (기본 {DEFAULT_REVIEW_REMINDER_TIME}).
              </Text>
            </View>
            <Switch
              value={reviewReminderEnabled}
              onValueChange={setReviewReminderEnabled}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
              ios_backgroundColor={colors.border}
            />
          </View>
          <View style={[styles.infoRowColumn, { opacity: reviewReminderEnabled ? 1 : 0.45 }]}>
            <Text style={styles.label}>리뷰 알림 시각</Text>
            <View style={styles.timeRow}>
              <TouchableOpacity
                style={styles.timePickerButton}
                onPress={openTimePicker}
                disabled={!reviewReminderEnabled}
              >
                <Text style={styles.timePickerText}>{formatDisplayTime(timeValue)}</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.infoRowColumn}>
            <Text style={styles.label}>리뷰 피드백 주기</Text>
            <View style={styles.chipRow}>
              {[1, 3, 7, 30].map((d) => (
                <Chip
                  key={d}
                  label={`${d}일`}
                  active={reviewDelayDays.includes(d as any)}
                  onPress={() => {
                    setReviewDelayDays((prev) => {
                      const has = prev.includes(d as any);
                      const next = has ? prev.filter((x) => x !== d) : [...prev, d as any];
                      return next.length > 0 ? next.sort((a, b) => a - b) : [3];
                    });
                  }}
                />
              ))}
            </View>
            <Text style={styles.helperText}>소비 후 몇 일 뒤에 리뷰를 요청할지 선택해요.</Text>
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
          <Text style={styles.helperText}>탭해서 시간을 변경할 수 있어요</Text>
        </SettingsCard>

        <SettingsCard title="보안 설정">
          <Text style={[styles.helperText, { marginTop: 0 }]}>
            닉네임·이메일·비밀번호는 아래에서만 바꿀 수 있어요.
          </Text>
          <TouchableOpacity
            style={styles.securityRow}
            onPress={() => router.push('/settings/change-nickname')}
            accessibilityRole="button"
          >
            <Text style={styles.securityLabel}>닉네임 변경</Text>
            <Text style={styles.securityChevron}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.securityRow}
            onPress={() => router.push('/settings/change-email')}
            accessibilityRole="button"
          >
            <Text style={styles.securityLabel}>이메일 변경</Text>
            <Text style={styles.securityChevron}>›</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.securityRow, styles.securityRowLast]}
            onPress={() => router.push('/settings/change-password')}
            accessibilityRole="button"
          >
            <Text style={styles.securityLabel}>비밀번호 변경</Text>
            <Text style={styles.securityChevron}>›</Text>
          </TouchableOpacity>
        </SettingsCard>

        <SettingsCard title="표시">
          <View style={styles.infoRow}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={styles.label}>다크 모드</Text>
              <Text style={[styles.helperText, { marginTop: 4 }]}>어두운 테마로 화면을 표시해요</Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={setDarkMode}
              trackColor={{ false: colors.border, true: colors.primary }}
              thumbColor="#fff"
              ios_backgroundColor={colors.border}
            />
          </View>
        </SettingsCard>

        <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
          <Text style={styles.logoutText}>로그아웃</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={styles.footerText}>RegretWallet v1.0.0</Text>
        </View>
    </ScrollView>
  );
}
