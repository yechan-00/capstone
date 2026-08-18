import React, { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { LoginCard } from '@/components/auth/LoginCard';
import { AuthScreenBackground } from '@/components/auth/AuthScreenBackground';
import { AUTH } from '@/components/auth/authTheme';
import { ForgotPasswordModal } from '@/components/auth/ForgotPasswordModal';
import { CenterNoticeModal } from '@/components/CenterNoticeModal';
import { validateEmail, validatePassword } from '@/utils/validation';
import { mapLoginAuthError, mapPasswordResetError } from '@/utils/firebaseAuthErrors';
import * as authService from '@/services/authService';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, signInAsGuest } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [resetSending, setResetSending] = useState(false);
  const [forgotVisible, setForgotVisible] = useState(false);
  const [notice, setNotice] = useState<{ title?: string; message: string } | null>(null);
  const [backHovered, setBackHovered] = useState(false);
  const isWeb = Platform.OS === 'web';

  const showNotice = useCallback((message: string, title?: string) => {
    setNotice({ message, title });
  }, []);

  const handleLogin = useCallback(async () => {
    if (loading || guestLoading) return;
    if (!email.trim() || !password.trim()) {
      showNotice('이메일과 비밀번호를 입력해주세요.', '오류');
      return;
    }
    if (!validateEmail(email)) {
      showNotice('올바른 이메일 형식이 아닙니다.', '오류');
      return;
    }
    const pv = validatePassword(password);
    if (!pv.valid) {
      showNotice(pv.message ?? '비밀번호를 확인해주세요.', '오류');
      return;
    }
    try {
      setLoading(true);
      await signIn(email, password);
      router.replace('/(tabs)');
    } catch (error: unknown) {
      showNotice(mapLoginAuthError(error, '로그인에 실패했습니다.'));
    } finally {
      setLoading(false);
    }
  }, [email, guestLoading, loading, password, router, showNotice, signIn]);

  const handleGuestLogin = useCallback(async () => {
    if (loading || guestLoading) return;
    try {
      setGuestLoading(true);
      await signInAsGuest();
      router.replace('/(tabs)');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '게스트 로그인에 실패했습니다.';
      showNotice(message, '오류');
    } finally {
      setGuestLoading(false);
    }
  }, [guestLoading, loading, router, showNotice, signInAsGuest]);

  const handlePasswordReset = useCallback(
    async (resetEmail: string) => {
      if (!validateEmail(resetEmail)) {
        showNotice('올바른 이메일 형식이 아닙니다.', '오류');
        return;
      }
      try {
        setResetSending(true);
        await authService.sendPasswordReset(resetEmail);
        setForgotVisible(false);
        showNotice('비밀번호 재설정 메일을 보냈습니다. 받은편지함을 확인해주세요.', '안내');
      } catch (error: unknown) {
        showNotice(mapPasswordResetError(error), '오류');
      } finally {
        setResetSending(false);
      }
    },
    [showNotice],
  );

  return (
    <AuthScreenBackground>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {isWeb ? (
          <Pressable
            onPress={() => router.push('/home')}
            onHoverIn={() => setBackHovered(true)}
            onHoverOut={() => setBackHovered(false)}
            style={({ pressed }) => [
              styles.backLink,
              pressed && { opacity: 0.75 },
            ]}
          >
            <Text style={[styles.backLinkText, backHovered && styles.backLinkTextHover]}>
              ← 홈으로
            </Text>
          </Pressable>
        ) : null}

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formSlot}>
            <LoginCard
              email={email}
              password={password}
              showPw={showPw}
              loading={loading}
              guestLoading={guestLoading}
              onEmailChange={setEmail}
              onPasswordChange={setPassword}
              onToggleShowPw={() => setShowPw((v) => !v)}
              onLogin={handleLogin}
              onGuest={handleGuestLogin}
              onSignup={() => router.push('/(auth)/signup')}
              onForgotPassword={() => setForgotVisible(true)}
            />
          </View>
        </ScrollView>

        <CenterNoticeModal
          visible={notice != null}
          title={notice?.title}
          message={notice?.message ?? ''}
          onClose={() => setNotice(null)}
        />

        <ForgotPasswordModal
          visible={forgotVisible}
          initialEmail={email}
          sending={resetSending}
          onClose={() => setForgotVisible(false)}
          onSubmit={handlePasswordReset}
        />
      </KeyboardAvoidingView>
    </AuthScreenBackground>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    ...(Platform.OS === 'web' ? ({ minHeight: '100vh' as unknown as number } as object) : {}),
  },
  scroll: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'web' ? 72 : 48,
    paddingBottom: 48,
    minHeight: Platform.OS === 'web' ? ('100vh' as unknown as number) : undefined,
  },
  formSlot: {
    width: '100%',
    maxWidth: AUTH.formWidth,
    alignItems: 'center',
  },
  backLink: {
    position: 'absolute',
    top: 28,
    left: 28,
    zIndex: 10,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  backLinkText: {
    fontSize: 14,
    fontWeight: '700',
    color: AUTH.textSub,
    ...(Platform.OS === 'web' ? ({ transition: 'color 0.15s ease' } as object) : {}),
  },
  backLinkTextHover: {
    color: AUTH.brand,
  },
});
