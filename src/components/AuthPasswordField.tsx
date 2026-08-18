import React, { forwardRef, useState } from 'react';
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  type TextInputProps,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { AUTH } from '@/components/auth/authTheme';
import { useTheme } from '@/theme/ThemeContext';

export const PASSWORD_LABEL = '비밀번호';

type Props = Omit<TextInputProps, 'secureTextEntry' | 'placeholder'> & {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  showToggle?: boolean;
  revealed?: boolean;
  onToggleReveal?: () => void;
  variant?: 'default' | 'card';
};

const webNoAutofillProps =
  Platform.OS === 'web'
    ? ({
        autoComplete: 'off',
        autoCorrect: false,
        spellCheck: false,
        name: 'rw-auth-secret',
        'data-lpignore': 'true',
        'data-1p-ignore': 'true',
        'data-form-type': 'other',
        translate: 'no',
      } as unknown as Partial<TextInputProps>)
    : {};

const webNoTranslateProps =
  Platform.OS === 'web'
    ? ({
        className: 'notranslate',
        translate: 'no',
      } as object)
    : {};

/** placeholder 대신 Text 라벨 — 웹 password 한글 깨짐 방지 */
export const AuthPasswordField = forwardRef<TextInput, Props>(function AuthPasswordField(
  {
    value,
    onChangeText,
    placeholder,
    showToggle = false,
    revealed = false,
    onToggleReveal,
    style,
    onFocus,
    onBlur,
    autoCorrect = false,
    autoComplete,
    textContentType,
    variant = 'default',
    ...rest
  },
  ref,
) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const isWeb = Platform.OS === 'web';
  const isCard = variant === 'card';
  const showHint = !value && !focused;
  const mask = isWeb ? !revealed && value.length > 0 : !revealed;
  const useWebMask = isWeb && mask;

  const cardBorder = isCard
    ? focused
      ? AUTH.inputBorderFocus
      : AUTH.inputBorder
    : colors.borderInput;
  const cardBg = isCard ? AUTH.inputBg : colors.inputBg;
  const iconColor = isCard ? AUTH.textSub : colors.primary;
  const hintColor = isCard ? AUTH.placeholder : colors.placeholder;
  const textColor = isCard ? AUTH.brand : colors.text;
  const eyeColor = isCard ? AUTH.textSub : colors.textMuted;

  return (
    <View
      {...webNoTranslateProps}
      style={[
        styles.wrap,
        isCard && styles.wrapCard,
        {
          backgroundColor: isCard ? cardBg : '#fff',
          borderColor: isCard ? cardBorder : 'transparent',
          borderWidth: isCard ? 1 : 0,
        },
        isCard && focused && isWeb && ({ boxShadow: `0 0 0 4px ${AUTH.focusRing}` } as object),
        isCard && isWeb && ({ transition: 'border-color 0.15s ease, box-shadow 0.15s ease' } as object),
      ]}
    >
      {!isCard ? (
        <MaterialIcons name="lock" size={20} color={iconColor} style={styles.icon} />
      ) : null}
      {showHint ? (
        <Text
          {...webNoTranslateProps}
          pointerEvents="none"
          style={[
            isCard ? styles.cardHint : styles.hint,
            { color: hintColor },
            !isCard && { marginRight: 8 },
          ]}
          numberOfLines={1}
        >
          {placeholder}
        </Text>
      ) : null}
      <TextInput
        {...rest}
        {...webNoAutofillProps}
        ref={ref}
        style={[
          styles.input,
          { color: textColor },
          isWeb && styles.webInput,
          useWebMask && styles.webMaskedInput,
          style,
        ]}
        placeholder=""
        placeholderTextColor={hintColor}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={!isWeb && mask}
        autoCorrect={autoCorrect}
        autoComplete={isWeb ? 'off' : autoComplete}
        textContentType={isWeb ? 'none' : textContentType}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
      />
      {showToggle ? (
        <TouchableOpacity onPress={onToggleReveal} style={styles.eyeBtn} accessibilityRole="button">
          <MaterialIcons
            name={revealed ? 'visibility' : 'visibility-off'}
            size={20}
            color={eyeColor}
          />
        </TouchableOpacity>
      ) : null}
    </View>
  );
});

AuthPasswordField.displayName = 'AuthPasswordField';

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    marginBottom: 14,
    paddingHorizontal: 14,
    height: 54,
    minHeight: 54,
  },
  wrapCard: {
    marginBottom: 14,
    paddingHorizontal: 16,
    height: AUTH.inputHeight,
    minHeight: AUTH.inputHeight,
    borderRadius: AUTH.radius,
    position: 'relative',
  },
  icon: { marginRight: 8 },
  hint: {
    fontSize: 16,
    fontWeight: '400',
    marginRight: 8,
    flexShrink: 0,
  },
  cardHint: {
    position: 'absolute',
    left: 16,
    fontSize: 16,
    fontWeight: '400',
    lineHeight: AUTH.inputHeight,
    zIndex: 1,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 0,
  },
  webInput: {
    outlineStyle: 'none',
    backgroundColor: 'transparent',
  } as object,
  webMaskedInput: {
    WebkitTextSecurity: 'disc',
  } as object,
  eyeBtn: { padding: 4, marginLeft: 4 },
});
