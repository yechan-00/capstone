import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, KeyboardAvoidingView,
  Platform, ScrollView, Image,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { showAlert } from '@/utils/alert';
import { validateEmail, validatePassword } from '@/utils/validation';

const NAVY = '#1B2D5B';
const NAVY_LIGHT = '#2A3F7A';
const NAVY_INPUT = '#243568';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      showAlert('오류', '이메일과 비밀번호를 입력해주세요.'); return;
    }
    if (!validateEmail(email)) {
      showAlert('오류', '올바른 이메일 형식이 아닙니다.'); return;
    }
    const pv = validatePassword(password);
    if (!pv.valid) { showAlert('오류', pv.message); return; }
    try {
      setLoading(true);
      await signIn(email, password);
      router.replace('/(tabs)');
    } catch (error: any) {
      showAlert('로그인 실패', error.message || '로그인에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.content}>

          {/* 브랜드 */}
          <View style={styles.brand}>
            <Image
              // eslint-disable-next-line @typescript-eslint/no-require-imports
              source={require('../../assets/images/logo.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          {/* 폼 카드 */}
          <View style={styles.card}>
            {/* 이메일 */}
            <View style={styles.inputWrap}>
              <MaterialIcons name="email" size={20} color="#fff" style={styles.icon} />
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
              <MaterialIcons name="lock" size={20} color="#fff" style={styles.icon} />
              <TextInput
                style={[styles.input, { flex: 1 }]}
                placeholder="비밀번호"
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

            {/* 로그인 버튼 */}
            <TouchableOpacity
              style={[styles.btn, loading && { opacity: 0.6 }]}
              onPress={handleLogin}
              disabled={loading}
            >
              {loading
                ? <ActivityIndicator color={NAVY} />
                : <Text style={styles.btnText}>로그인</Text>
              }
            </TouchableOpacity>
          </View>

          {/* 하단 링크 */}
          <View style={styles.links}>
            <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
              <Text style={styles.linkText}>회원가입</Text>
            </TouchableOpacity>
            <Text style={styles.divider}>|</Text>
            <TouchableOpacity onPress={() => router.replace('/(tabs)')}>
              <Text style={styles.linkText}>로그인 없이 둘러보기</Text>
            </TouchableOpacity>
          </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F7FB' },
  scroll: { flexGrow: 1, justifyContent: 'center' },
  content: { flex: 1, padding: 28, justifyContent: 'center' },
  brand: { alignItems: 'center', marginBottom: 18 },
  logoImage: { width: 240, height: 160 },
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
  icon: { marginRight: 10, color: NAVY },
  input: {
    flex: 1, fontSize: 16,
    color: NAVY,
  },
  eyeBtn: { padding: 4, color: NAVY },
  btn: {
    backgroundColor: '#fff',
    borderRadius: 12,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  btnText: { fontSize: 17, fontWeight: '800', color: NAVY },
  links: {
    flexDirection: 'row', justifyContent: 'center',
    alignItems: 'center', gap: 16,
  },
  linkText: { fontSize: 14, color: NAVY, fontWeight: '600' },
  divider: { color: '#9CA3AF', fontSize: 14 },
});
