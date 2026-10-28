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
import { AuthFormContainer } from '@/components/AuthFormContainer';
import { AuthPasswordField, PASSWORD_LABEL } from '@/components/AuthPasswordField';
import { AuthSubmitButton, webEnterKeyProps } from '@/components/AuthSubmitButton';
import { LOGIN_UI } from '@/components/auth/loginTheme';
import { BRAND_NAME } from '@/constants/brand';
import { useTheme } from '@/theme/ThemeContext';

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
  color,
  weight,
}: {
  label: string;
  onPress: () => void;
  color: string;
  weight: '500' | '600';
}) {
  const [hovered, setHovered] = useState(false);
  const isWeb = Platform.OS === 'web';

  return (
    <Pressable
      onPress={onPress}
      onHoverIn={isWeb ? () => setHovered(true) : undefined}
      onHoverOut={isWeb ? () => setHovered(false) : undefined}
      accessibilityRole="link"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [styles.linkHit, { opacity: pressed ? 0.7 : 1 }]}
    >
      <Text
        style={[
          styles.link,
          { color, fontWeight: weight },
          hovered && { opacity: 0.82 },
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
  const { colors, isDark } = useTheme();
  const passwordRef = useRef<TextInput>(null);
  const [emailFocused, setEmailFocused] = useState(false);
  const [guestHovered, setGuestHovered] = useState(false);
  const isWeb = Platform.OS === 'web';
  const noTranslateProps = isWeb ? ({ className: 'notranslate', translate: 'no' } as object) : {};
  const busy = loading || guestLoading;

  const inputBg = colors.surface;
  const inputBorder = colors.borderInput;
  const fieldAppearance = {
    borderColor: inputBorder,
    borderFocusColor: LOGIN_UI.inputFocus,
    backgroundColor: inputBg,
    textColor: colors.text,
    placeholderColor: colors.placeholder,
    iconColor: colors.textSec,
  };

  return (
    <View {...noTranslateProps} style={styles.wrap}>
      <View style={styles.brandBlock} accessibilityRole="header" accessibilityLabel={BRAND_NAME}>
        <Text style={[styles.brandName, { color: isDark ? colors.text : LOGIN_UI.brandTitle }]}>
          {BRAND_NAME}
        </Text>
        <Text style={[styles.brandTagline, { color: colors.textSec }]}>
          소비를 기록하고, 후회를 줄여가세요.
        </Text>
      </View>

      <AuthFormContainer style={styles.form}>
        <Text style={[styles.fieldLabel, { color: colors.text }]}>이메일</Text>
        <View
          style={[
            styles.inputWrap,
            { backgroundColor: inputBg, borderColor: emailFocused ? LOGIN_UI.inputFocus : inputBorder },
          ]}
        >
          <TextInput
            style={[styles.input, { color: colors.text }]}
            placeholder="이메일을 입력해 주세요"
            placeholderTextColor={colors.placeholder}
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

        <Text style={[styles.fieldLabel, styles.fieldLabelSpaced, { color: colors.text }]}>
          {PASSWORD_LABEL}
        </Text>
        <AuthPasswordField
          ref={passwordRef}
          placeholder="비밀번호를 입력해 주세요"
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
          appearance={fieldAppearance}
        />

        <AuthSubmitButton
          label={loading ? '로그인 중...' : '로그인'}
          loading={loading}
          disabled={guestLoading}
          onPress={onLogin}
          usePressable
          style={styles.primaryBtn}
          textStyle={styles.primaryBtnText}
          spinnerColor={LOGIN_UI.buttonText}
        />

        <View style={styles.dividerRow} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
          <Text style={[styles.dividerText, { color: colors.textMuted }]}>또는</Text>
          <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        </View>

        <Pressable
          onPress={onGuest}
          disabled={busy}
          onHoverIn={isWeb && !busy ? () => setGuestHovered(true) : undefined}
          onHoverOut={isWeb ? () => setGuestHovered(false) : undefined}
          style={({ pressed }) => [
            styles.guestBtn,
            {
              backgroundColor: colors.surface,
              borderColor: isDark ? colors.border : LOGIN_UI.guestBorder,
            },
            guestHovered && !busy && {
              backgroundColor: isDark ? colors.surfaceMuted : LOGIN_UI.guestHoverBg,
            },
            busy && styles.guestBtnDisabled,
            !busy && pressed && { opacity: 0.88 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="먼저 체험해보기"
          accessibilityState={{ busy: guestLoading, disabled: busy }}
        >
          {guestLoading ? (
            <ActivityIndicator color={LOGIN_UI.guestText} />
          ) : (
            <Text
              style={[
                styles.guestBtnText,
                { color: isDark ? '#D5E8DE' : LOGIN_UI.guestText },
              ]}
            >
              먼저 체험해보기
            </Text>
          )}
        </Pressable>

        <View style={styles.links}>
          <AuthTextLink
            label="회원가입"
            onPress={onSignup}
            color={LOGIN_UI.signupLink}
            weight="600"
          />
          <Text style={[styles.linkDot, { color: colors.textMuted }]}>·</Text>
          <AuthTextLink
            label={`${PASSWORD_LABEL} 찾기`}
            onPress={onForgotPassword}
            color={colors.textSec}
            weight="500"
          />
        </View>
      </AuthFormContainer>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
    maxWidth: LOGIN_UI.formWidth,
    alignItems: 'stretch',
  },
  brandBlock: {
    alignItems: 'center',
    marginBottom: 32,
  },
  brandName: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.4,
    ...(Platform.OS === 'web' ? ({ userSelect: 'none' } as object) : {}),
  },
  brandTagline: {
    marginTop: 8,
    fontSize: 15,
    fontWeight: '400',
    lineHeight: 22,
    textAlign: 'center',
  },
  form: { width: '100%' },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  fieldLabelSpaced: {
    marginTop: 16,
  },
  inputWrap: {
    borderWidth: 1,
    borderRadius: LOGIN_UI.radius,
    height: LOGIN_UI.inputHeight,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  input: {
    fontSize: 16,
    paddingVertical: 0,
    ...(Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : {}),
  },
  primaryBtn: {
    marginTop: 24,
    backgroundColor: LOGIN_UI.buttonBg,
    borderRadius: LOGIN_UI.radius,
    height: LOGIN_UI.buttonHeight,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: LOGIN_UI.buttonText,
  },
  dividerRow: {
    marginTop: 22,
    marginBottom: 18,
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 12,
    fontWeight: '400',
  },
  guestBtn: {
    height: LOGIN_UI.guestHeight,
    borderRadius: LOGIN_UI.radius,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
  },
  guestBtnDisabled: { opacity: 0.55 },
  guestBtnText: { fontSize: 16, fontWeight: '600' },
  links: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 10,
    marginTop: 20,
  },
  linkHit: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  link: { fontSize: 14 },
  linkDot: { fontSize: 14, lineHeight: 44 },
});
