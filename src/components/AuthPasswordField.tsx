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

export type AuthPasswordFieldAppearance = {
  borderColor: string;
  borderFocusColor: string;
  backgroundColor: string;
  textColor: string;
  placeholderColor: string;
  iconColor: string;
};

type Props = Omit<TextInputProps, 'secureTextEntry' | 'placeholder'> & {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  showToggle?: boolean;
  revealed?: boolean;
  onToggleReveal?: () => void;
  variant?: 'default' | 'card';
  appearance?: AuthPasswordFieldAppearance;
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
    appearance,
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

  const cardPalette = appearance ?? {
    borderColor: AUTH.inputBorder,
    borderFocusColor: AUTH.inputBorderFocus,
    backgroundColor: AUTH.inputBg,
    textColor: AUTH.brand,
    placeholderColor: AUTH.placeholder,
    iconColor: AUTH.textSub,
  };
  const cardBorder = isCard
    ? focused
      ? cardPalette.borderFocusColor
      : cardPalette.borderColor
    : colors.borderInput;
  const cardBg = isCard ? cardPalette.backgroundColor : colors.inputBg;
  const iconColor = isCard ? cardPalette.iconColor : colors.primary;
  const hintColor = isCard ? cardPalette.placeholderColor : colors.placeholder;
  const textColor = isCard ? cardPalette.textColor : colors.text;
  const eyeColor = isCard ? cardPalette.iconColor : colors.textMuted;

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
        isCard && isWeb && ({ transition: 'border-color 0.15s ease' } as object),
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
        <TouchableOpacity
          onPress={onToggleReveal}
          style={isCard ? styles.eyeBtnCard : styles.eyeBtn}
          accessibilityRole="button"
          accessibilityLabel={revealed ? '비밀번호 숨기기' : '비밀번호 표시'}
          hitSlop={isCard ? undefined : { top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialIcons
            name={revealed ? 'visibility' : 'visibility-off'}
            size={isCard ? 22 : 20}
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
    marginBottom: 0,
    paddingHorizontal: 16,
    paddingRight: 6,
    height: 56,
    minHeight: 56,
    borderRadius: 16,
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
    lineHeight: 56,
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
  eyeBtnCard: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
