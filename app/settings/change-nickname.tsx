import React, { useEffect, useMemo, useState } from 'react';
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

export default function ChangeNicknameScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { account, updateNickname } = useAuth();
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);

  const current = (account?.nickname ?? '').trim();

  useEffect(() => {
    setNext(account?.nickname ?? '');
  }, [account?.nickname]);

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
    const trimmed = next.trim();
    if (trimmed === current) {
      Alert.alert('닉네임 변경', '변경된 내용이 없습니다.');
      return;
    }
    setBusy(true);
    try {
      await updateNickname(next);
      Alert.alert('완료', '닉네임이 저장되었습니다.', [{ text: '확인', onPress: () => router.back() }]);
    } catch {
      Alert.alert('닉네임 변경', '저장에 실패했습니다.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView style={styles.scroll} contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
        <View style={styles.notice}>
          <Text style={styles.noticeTitle}>프로필 설정</Text>
          <Text style={styles.noticeBody}>
            닉네임은 앱에 표시되는 이름이에요. 메인 설정 화면에서는 보기만 하고, 여기서만 수정할 수
            있습니다.
          </Text>
        </View>

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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
