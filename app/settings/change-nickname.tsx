import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { useTheme } from '@/theme/ThemeContext';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SettingsFormScreen } from '@/components/SettingsFormScreen';
import { createSettingsFormStyles } from '@/components/settingsFormStyles';
import { showAlert } from '@/utils/alert';

export default function ChangeNicknameScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { account, updateNickname } = useAuth();
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);

  const current = (account?.nickname ?? '').trim();
  const styles = useMemo(() => createSettingsFormStyles(colors), [colors]);

  useEffect(() => {
    setNext(account?.nickname ?? '');
  }, [account?.nickname]);

  const onSubmit = async () => {
    const trimmed = next.trim();
    if (trimmed === current) {
      showAlert('닉네임 변경', '변경된 내용이 없습니다.');
      return;
    }
    setBusy(true);
    try {
      await updateNickname(next);
      showAlert('완료', '닉네임이 저장되었습니다.', [{ text: '확인', onPress: () => router.back() }]);
    } catch (err) {
      console.warn('[settings] nickname update failed', err);
      showAlert('닉네임 변경', '저장에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsFormScreen
      title="닉네임 변경"
      noticeTitle="프로필 설정"
      noticeBody="닉네임은 앱에 표시되는 이름이에요. 메인 설정 화면에서는 보기만 하고, 여기서만 수정할 수 있습니다."
    >
      <View>
        <Text style={styles.label}>현재 닉네임</Text>
        <Text style={styles.current}>{current ? current : '미설정'}</Text>
      </View>

      <View>
        <Text style={styles.label}>새 닉네임</Text>
        <TextInput
          style={styles.input}
          value={next}
          onChangeText={setNext}
          maxLength={24}
          autoCorrect={false}
          placeholder="닉네임 입력"
          placeholderTextColor={colors.placeholder}
        />
      </View>

      <PrimaryButton label={busy ? '저장 중...' : '저장'} onPress={onSubmit} disabled={busy} />
    </SettingsFormScreen>
  );
}
