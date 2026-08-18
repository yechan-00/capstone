import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { BrandLogo } from '@/components/BrandLogo';
import { AuthFormContainer } from '@/components/AuthFormContainer';
import { AuthPasswordField, PASSWORD_LABEL } from '@/components/AuthPasswordField';
import { AuthSubmitButton, webEnterKeyProps } from '@/components/AuthSubmitButton';
import { AUTH } from '@/components/auth/authTheme';

export type LoginCardProps = {
  email: string;
  password: string;
  showPw: boolean;
  loading: boolean;
  guestLoading: boolean;
  onEmailChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onToggleShowPw: () => void;
  onLogin: () => void;
  onGuest: () => void;
  onSignup: () => void;
  onForgotPassword: () => void;
};

function AuthTextLink({
  label,
  onPress,
}: {
  label: string;
  onPress: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const isWeb = Platform.OS === 'web';

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={isWeb ? () => setHovered(true) : undefined}
      onHoverOut={isWeb ? () => setHovered(false) : undefined}
      accessibilityRole="button"
      style={({ pressed }) => [{ opacity: pressed ? 0.75 : 1 }]}
    >
      <Text
        style={[
          styles.link,
          hovered && styles.linkHover,
          isWeb && hovered && ({ textDecorationLine: 'underline' } as object),
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/** 로그인 전용 — 인증 UI만 */
export function LoginCard({
  email,
  password,
  showPw,
  loading,
  guestLoading,
  onEmailChange,
  onPasswordChange,
  onToggleShowPw,
  onLogin,
  onGuest,
  onSignup,
  onForgotPassword,
}: LoginCardProps) {
  const passwordRef = useRef<TextInput>(null);
  const [emailFocused, setEmailFocused] = useState(false);
  const [guestHovered, setGuestHovered] = useState(false);
  const isWeb = Platform.OS === 'web';
  const noTranslateProps = isWeb ? ({ className: 'notranslate', translate: 'no' } as object) : {};
  const busy = loading || guestLoading;

  return (
    <View {...noTranslateProps} style={styles.wrap}>
      <BrandLogo
        iconSize={64}
        labelSize={23}
        layout="column"
        tone="auth"
        style={styles.brandBlock}
      />

      <AuthFormContainer style={styles.form}>
        <View
          style={[
            styles.inputWrap,
            emailFocused && styles.inputWrapFocused,
          ]}
        >
          <TextInput
            style={styles.input}
            placeholder="이메일"
            placeholderTextColor={AUTH.placeholder}
            value={email}
            onChangeText={onEmailChange}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            returnKeyType="next"
            blurOnSubmit={false}
            onSubmitEditing={() => passwordRef.current?.focus()}
            onFocus={() => setEmailFocused(true)}
            onBlur={() => setEmailFocused(false)}
            {...webEnterKeyProps(() => passwordRef.current?.focus())}
            editable={!busy}
            accessibilityLabel="이메일"
          />
        </View>

        <AuthPasswordField
          ref={passwordRef}
          placeholder={PASSWORD_LABEL}
          value={password}
          onChangeText={onPasswordChange}
          accessibilityLabel={PASSWORD_LABEL}
          returnKeyType="done"
          showToggle
          revealed={showPw}
          onToggleReveal={onToggleShowPw}
          onSubmitEditing={onLogin}
          {...webEnterKeyProps(onLogin)}
          editable={!busy}
          variant="card"
        />

        <AuthSubmitButton
          label={loading ? '로그인 중...' : '로그인'}
          loading={loading}
          disabled={guestLoading}
          onPress={onLogin}
          usePressable
          brandHover
          style={styles.primaryBtn}
          textStyle={styles.primaryBtnText}
          spinnerColor={AUTH.lime}
        />

        <View style={styles.dividerRow}>
          <View style={styles.dividerLine} />
        </View>

        <Pressable
          onPress={onGuest}
          disabled={busy}
          onHoverIn={isWeb && !busy ? () => setGuestHovered(true) : undefined}
          onHoverOut={isWeb ? () => setGuestHovered(false) : undefined}
          style={({ pressed }) => [
            styles.guestBtn,
            guestHovered && !busy && styles.guestBtnHover,
            busy && styles.guestBtnDisabled,
            !busy && pressed && { opacity: 0.92 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="먼저 체험해보기"
        >
          {guestLoading ? (
            <ActivityIndicator color={AUTH.brand} />
          ) : (
            <Text style={styles.guestBtnText}>먼저 체험해보기</Text>
          )}
        </Pressable>

        <View style={styles.links}>
          <AuthTextLink label="회원가입" onPress={onSignup} />
          <Text style={styles.linkDot}>·</Text>
          <AuthTextLink label={`${PASSWORD_LABEL} 찾기`} onPress={onForgotPassword} />
        </View>
      </AuthFormContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    maxWidth: AUTH.formWidth,
    alignItems: 'center',
    ...(Platform.OS === 'web' ? { marginTop: -12 } : {}),
  },
  brandBlock: {
    marginBottom: 36,
  },
  form: { width: '100%', gap: 0 },
  inputWrap: {
    borderWidth: 1,
    borderColor: AUTH.inputBorder,
    borderRadius: AUTH.radius,
    backgroundColor: AUTH.inputBg,
    height: AUTH.inputHeight,
    paddingHorizontal: 16,
    marginBottom: 14,
    justifyContent: 'center',
    ...(Platform.OS === 'web'
      ? ({ transition: 'border-color 0.15s ease, box-shadow 0.15s ease' } as object)
      : {}),
  },
  inputWrapFocused: {
    borderColor: AUTH.inputBorderFocus,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: `0 0 0 4px ${AUTH.focusRing}` } as object)
      : {}),
  },
  input: {
    fontSize: 16,
    color: AUTH.brand,
    paddingVertical: 0,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
  },
  primaryBtn: {
    marginTop: 2,
    backgroundColor: AUTH.brand,
    borderRadius: AUTH.radius,
    height: AUTH.buttonHeight,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: AUTH.lime },
  dividerRow: { marginVertical: 22, alignItems: 'center', width: '100%' },
  dividerLine: {
    width: '100%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: AUTH.inputBorder,
  },
  guestBtn: {
    height: AUTH.buttonHeight,
    borderRadius: AUTH.radius,
    borderWidth: 1,
    borderColor: AUTH.guestBorder,
    backgroundColor: 'rgba(255,255,255,0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    ...(Platform.OS === 'web'
      ? ({ transition: 'background-color 0.15s ease, border-color 0.15s ease' } as object)
      : {}),
  },
  guestBtnHover: {
    backgroundColor: AUTH.guestHoverBg,
    borderColor: AUTH.guestBorderHover,
  },
  guestBtnDisabled: { opacity: 0.65 },
  guestBtnText: { fontSize: 15, fontWeight: '700', color: AUTH.brand },
  links: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 26,
  },
  link: { fontSize: 14, fontWeight: '700', color: AUTH.textSub },
  linkHover: { color: AUTH.brand },
  linkDot: { fontSize: 14, color: AUTH.placeholder },
});
