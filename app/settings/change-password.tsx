import React, { useMemo, useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/theme/ThemeContext';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SettingsFormScreen } from '@/components/SettingsFormScreen';
import { createSettingsFormStyles } from '@/components/settingsFormStyles';
import { showAlert } from '@/utils/alert';
import { mapFirebaseAuthError } from '@/utils/firebaseAuthErrors';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { changePassword } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const styles = useMemo(() => createSettingsFormStyles(colors), [colors]);

  const onSubmit = async () => {
    if (!current) {
      showAlert('비밀번호 변경', '현재 비밀번호를 입력해주세요.');
      return;
    }
    if (next.length < 6) {
      showAlert('비밀번호 변경', '새 비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    if (next !== confirm) {
      showAlert('비밀번호 변경', '새 비밀번호 확인이 일치하지 않습니다.');
      return;
    }
    setBusy(true);
    try {
      await changePassword(next, current);
      showAlert('완료', '비밀번호가 변경되었습니다.', [{ text: '확인', onPress: () => router.back() }]);
    } catch (e) {
      showAlert('비밀번호 변경', mapFirebaseAuthError(e, '비밀번호를 변경하지 못했습니다.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsFormScreen
      title="비밀번호 변경"
      noticeTitle="보안 단계"
      noticeBody="비밀번호는 다른 설정과 분리된 화면에서만 바꿀 수 있어요. 현재 비밀번호 확인 후 새 비밀번호로 갱신됩니다."
    >
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
    </SettingsFormScreen>
  );
}
