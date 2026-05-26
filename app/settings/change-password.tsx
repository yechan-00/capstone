import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/theme/ThemeContext';
import { PrimaryButton } from '@/components/PrimaryButton';
import { mapFirebaseAuthError } from '@/utils/firebaseAuthErrors';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { changePassword } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        scroll: { flex: 1, backgroundColor: colors.bg },
        inner: { padding: 16, paddingBottom: 40, gap: 16 },
        notice: {
          backgroundColor: colors.surfaceMuted,
          borderRadius: 14,
          padding: 14,
          borderWidth: 1,
          borderColor: colors.border,
        },
        noticeTitle: { fontWeight: '900', color: colors.text, marginBottom: 6 },
        noticeBody: { color: colors.textSec, fontWeight: '600', lineHeight: 20 },
        label: { fontWeight: '800', color: colors.textSec, marginBottom: 6 },
        input: {
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          paddingHorizontal: 14,
          paddingVertical: 12,
          color: colors.text,
          backgroundColor: colors.inputBg,
          fontWeight: '600',
        },
      }),
    [colors]
  );

  const onSubmit = async () => {
    if (!current) {
      Alert.alert('비밀번호 변경', '현재 비밀번호를 입력해주세요.');
      return;
    }
    if (next.length < 6) {
      Alert.alert('비밀번호 변경', '새 비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    if (next !== confirm) {
      Alert.alert('비밀번호 변경', '새 비밀번호 확인이 일치하지 않습니다.');
      return;
    }
    setBusy(true);
    try {
      await changePassword(next, current);
      Alert.alert('완료', '비밀번호가 변경되었습니다.', [{ text: '확인', onPress: () => router.back() }]);
    } catch (e) {
      Alert.alert('비밀번호 변경', mapFirebaseAuthError(e, '비밀번호를 변경하지 못했습니다.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView style={styles.scroll} contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>보안 단계</Text>
            <Text style={styles.noticeBody}>
              비밀번호는 다른 설정과 분리된 화면에서만 바꿀 수 있어요. 현재 비밀번호 확인 후 새 비밀번호로
              갱신됩니다.
            </Text>
          </View>

          <View>
            <Text style={styles.label}>현재 비밀번호</Text>
            <TextInput
              style={styles.input}
              value={current}
              onChangeText={setCurrent}
              secureTextEntry
              placeholder="현재 비밀번호"
              placeholderTextColor={colors.placeholder}
            />
          </View>

          <View>
            <Text style={styles.label}>새 비밀번호</Text>
            <TextInput
              style={styles.input}
              value={next}
              onChangeText={setNext}
              secureTextEntry
              placeholder="6자 이상"
              placeholderTextColor={colors.placeholder}
            />
          </View>

          <View>
            <Text style={styles.label}>새 비밀번호 확인</Text>
            <TextInput
              style={styles.input}
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              placeholder="한 번 더 입력"
              placeholderTextColor={colors.placeholder}
            />
          </View>

          <PrimaryButton label={busy ? '처리 중...' : '비밀번호 변경'} onPress={onSubmit} disabled={busy} />
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
