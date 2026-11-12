import React, { useCallback, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { LoginCard } from '@/components/auth/LoginCard';
import { AuthScreenBackground } from '@/components/auth/AuthScreenBackground';
import { LOGIN_UI } from '@/components/auth/loginTheme';
import { ForgotPasswordModal } from '@/components/auth/ForgotPasswordModal';
import { CenterNoticeModal } from '@/components/CenterNoticeModal';
import { LoginRequiredModal } from '@/components/LoginRequiredModal';
import { useTheme } from '@/theme/ThemeContext';
import { validateEmail, validatePassword } from '@/utils/validation';
import { mapLoginAuthError, mapPasswordResetError } from '@/utils/firebaseAuthErrors';
import * as authService from '@/services/authService';

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const { signIn, isAnonymousSession } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resetSending, setResetSending] = useState(false);
  const [forgotVisible, setForgotVisible] = useState(false);
  const [notice, setNotice] = useState<{ title?: string; message: string } | null>(null);
  const [mergeWarningVisible, setMergeWarningVisible] = useState(false);
  const [backHovered, setBackHovered] = useState(false);
  const mergeAckedRef = useRef(false);
  const isWeb = Platform.OS === 'web';
  const canGoBack = router.canGoBack();

  const showNotice = useCallback((message: string, title?: string) => {
    setNotice({ message, title });
  }, []);

  const runEmailSignIn = useCallback(async () => {
    if (loading) return;
    try {
      setLoading(true);
      await signIn(email, password);
    } catch (error: unknown) {
      showNotice(mapLoginAuthError(error, '로그인에 실패했습니다.'));
    } finally {
      setLoading(false);
    }
  }, [email, loading, password, showNotice, signIn]);

  const handleLogin = useCallback(() => {
    if (loading) return;
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
    if (isAnonymousSession && !mergeAckedRef.current) {
      setMergeWarningVisible(true);
      return;
    }
    void runEmailSignIn();
  }, [email, isAnonymousSession, loading, password, runEmailSignIn, showNotice]);

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

  const topPad = Math.max(insets.top, 16) + (isWeb || canGoBack ? 56 : 20);
  const bottomPad = Math.max(insets.bottom, 16) + 12;

  return (
    <AuthScreenBackground>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        {canGoBack || isWeb ? (
          <Pressable
            onPress={() => {
              if (canGoBack) {
                router.back();
                return;
              }
              router.push('/home');
            }}
            onHoverIn={() => setBackHovered(true)}
            onHoverOut={() => setBackHovered(false)}
            style={({ pressed }) => [
              styles.backLink,
              { top: Math.max(insets.top, 20) },
              pressed && { opacity: 0.75 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={canGoBack ? '이전 화면으로' : '홈으로'}
          >
            <Text
              style={[
                styles.backLinkText,
                { color: backHovered ? LOGIN_UI.signupLink : colors.textSec },
              ]}
            >
              {canGoBack ? '← 돌아가기' : '← 홈으로'}
            </Text>
          </Pressable>
        ) : null}

        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            {
              paddingTop: topPad,
              paddingBottom: bottomPad,
              paddingHorizontal: LOGIN_UI.horizontalPad,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formSlot}>
            {isAnonymousSession ? (
              <View
                style={[
                  styles.preserveNote,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.preserveTitle, { color: colors.text }]}>
                  이 기기에 남은 기록이 있어요
                </Text>
                <Text style={[styles.preserveBody, { color: colors.textSec }]}>
                  회원가입하면 지금 기록을 이어서 사용할 수 있어요. 다른 계정으로 로그인하면
                  이 기록은 자동으로 합쳐지지 않아요.
                </Text>
              </View>
            ) : null}
            <LoginCard
              email={email}
              password={password}
              showPw={showPw}
              loading={loading}
              onEmailChange={setEmail}
              onPasswordChange={setPassword}
              onToggleShowPw={() => setShowPw((v) => !v)}
              onLogin={handleLogin}
              onSignup={() => router.push('/(auth)/signup')}
              onForgotPassword={() => setForgotVisible(true)}
            />
          </View>
        </ScrollView>

        <LoginRequiredModal
          visible={mergeWarningVisible}
          title="기존 기록 안내"
          message={
            '기존 계정으로 로그인하면 이 기기에 남아 있는 소비 기록은 자동으로 합쳐지지 않아요.\n\n현재 기록을 유지하려면 회원가입을 이용해 주세요.'
          }
          cancelLabel="취소"
          confirmLabel="계속 로그인"
          onCancel={() => setMergeWarningVisible(false)}
          onConfirm={() => {
            mergeAckedRef.current = true;
            setMergeWarningVisible(false);
            void runEmailSignIn();
          }}
        />

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
  },
  formSlot: {
    width: '100%',
    maxWidth: LOGIN_UI.formWidth,
    alignItems: 'stretch',
  },
  preserveNote: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 16,
  },
  preserveTitle: {
    fontSize: 14,
    fontWeight: '800',
    marginBottom: 4,
  },
  preserveBody: {
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  backLink: {
    position: 'absolute',
    left: 24,
    zIndex: 10,
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  backLinkText: {
    fontSize: 14,
    fontWeight: '600',
    ...(Platform.OS === 'web' ? ({ transition: 'color 0.15s ease' } as object) : {}),
  },
});
