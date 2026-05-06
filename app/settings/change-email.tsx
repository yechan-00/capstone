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

export default function ChangeEmailScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user, changeEmail } = useAuth();
  const [newEmail, setNewEmail] = useState('');
  const [password, setPassword] = useState('');
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
        current: { color: colors.text, fontWeight: '700' },
      }),
    [colors]
  );

  const onSubmit = async () => {
    const next = newEmail.trim();
    if (!next) {
      Alert.alert('이메일 변경', '새 이메일을 입력해주세요.');
      return;
    }
    if (!password) {
      Alert.alert('이메일 변경', '보안 확인을 위해 현재 비밀번호를 입력해주세요.');
      return;
    }
    setBusy(true);
    try {
      await changeEmail(next, password);
      Alert.alert('완료', '이메일이 변경되었습니다.', [{ text: '확인', onPress: () => router.back() }]);
    } catch (e) {
      Alert.alert('이메일 변경', mapFirebaseAuthError(e, '이메일을 변경하지 못했습니다.'));
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
              이메일은 계정 복구에 사용됩니다. 다른 화면과 구분된 단계에서만 변경할 수 있어요. 현재 비밀번호로
              본인 확인이 필요합니다.
            </Text>
          </View>

          <View>
            <Text style={styles.label}>현재 이메일</Text>
            <Text style={styles.current}>{user?.email ?? '-'}</Text>
          </View>

          <View>
            <Text style={styles.label}>새 이메일</Text>
            <TextInput
              style={styles.input}
              value={newEmail}
              onChangeText={setNewEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="name@example.com"
              placeholderTextColor={colors.placeholder}
            />
          </View>

          <View>
            <Text style={styles.label}>현재 비밀번호</Text>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="현재 비밀번호"
              placeholderTextColor={colors.placeholder}
            />
          </View>

          <PrimaryButton label={busy ? '처리 중...' : '이메일 변경'} onPress={onSubmit} disabled={busy} />
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
