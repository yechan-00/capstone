import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Pressable,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { showAlert } from '@/utils/alert';
import { validateEmail, validatePassword } from '@/utils/validation';

const NAVY = '#1B2D5B';

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!email.trim() || !password.trim() || !confirmPassword.trim()) {
      showAlert('오류', '모든 항목을 입력해주세요.'); return;
    }
    if (!validateEmail(email)) {
      showAlert('오류', '올바른 이메일 형식이 아닙니다.'); return;
    }
    const pv = validatePassword(password);
    if (!pv.valid) { showAlert('오류', pv.message); return; }
    if (password !== confirmPassword) {
      showAlert('오류', '비밀번호가 일치하지 않습니다.'); return;
    }
    try {
      setLoading(true);
      await signUp(email, password);
      showAlert('성공', '회원가입이 완료되었습니다.', [
        { text: 'OK', onPress: () => router.replace('/(tabs)') },
      ]);
    } catch (error: any) {
      showAlert('회원가입 실패', error.message || '회원가입에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.content}>

          {/* 뒤로 버튼 */}
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.canGoBack() ? router.back() : router.replace('/(auth)/login')}
          >
            <MaterialIcons name="chevron-left" size={28} color={NAVY} />
          </TouchableOpacity>

          {/* 타이틀 */}
          <Text style={styles.title}>회원가입</Text>
          <Text style={styles.subtitle}>새 계정을 만드세요</Text>

          {/* 폼 카드 */}
          <View style={styles.card}>
            {/* 이메일 */}
            <View style={styles.inputWrap}>
              <MaterialIcons name="email" size={20} color={NAVY} style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="이메일"
                placeholderTextColor="#9CA3AF"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                autoComplete="email"
              />
            </View>

            {/* 비밀번호 */}
            <View style={styles.inputWrap}>
              <MaterialIcons name="lock" size={20} color={NAVY} style={styles.icon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="비밀번호 (6자 이상)"
                placeholderTextColor="#9CA3AF"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPw}
                autoComplete="off"
                textContentType="none"
                autoCorrect={false}
              />
              <TouchableOpacity onPress={() => setShowPw(v => !v)} style={styles.eyeBtn}>
                <MaterialIcons name={showPw ? 'visibility' : 'visibility-off'} size={20} color={NAVY} />
              </TouchableOpacity>
            </View>

            {/* 비밀번호 확인 */}
            <View style={styles.inputWrap}>
              <MaterialIcons name="lock" size={20} color={NAVY} style={styles.icon} />
              <TextInput
                style={styles.input}
                placeholder="비밀번호 확인"
                placeholderTextColor="#9CA3AF"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                autoComplete="off"
                textContentType="none"
                autoCorrect={false}
              />
            </View>

            {/* 가입 버튼 */}
            <Pressable
              style={({ pressed }) => [styles.btn, loading && { opacity: 0.6 }, pressed && { opacity: 0.85 }]}
              onPress={handleSignUp}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={NAVY} />
                : <Text style={styles.btnText}>회원가입</Text>
              }
            </Pressable>
          </View>

          {/* 하단 링크 */}
          <TouchableOpacity style={styles.link} onPress={() => router.back()}>
            <Text style={styles.linkText}>이미 계정이 있으신가요? 로그인</Text>
          </TouchableOpacity>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F7FB' },
  scroll: { flexGrow: 1, justifyContent: 'center' },
  content: { flex: 1, padding: 28, paddingTop: 20, justifyContent: 'center' },
  backBtn: {
    position: 'absolute',
    top: 52,
    left: 20,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#fff',
    justifyContent: 'center', alignItems: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08, shadowRadius: 6, elevation: 3,
    zIndex: 10,
  },
  title: { fontSize: 34, fontWeight: '900', color: NAVY, marginBottom: 6 },
  subtitle: { fontSize: 15, color: '#6B7280', marginBottom: 32 },
  card: {
    backgroundColor: NAVY,
    borderRadius: 20,
    padding: 24,
    shadowColor: NAVY, shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25, shadowRadius: 20, elevation: 10,
    marginBottom: 24,
  },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 14,
    paddingHorizontal: 14,
    height: 54,
  },
  icon: { marginRight: 10 },
  input: { flex: 1, fontSize: 16, color: NAVY },
  eyeBtn: { padding: 4 },
  btn: {
    backgroundColor: '#fff',
    borderRadius: 12,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  btnText: { fontSize: 17, fontWeight: '800', color: NAVY },
  link: { alignItems: 'center', marginTop: 4 },
  linkText: { fontSize: 14, color: NAVY, fontWeight: '600' },
});
