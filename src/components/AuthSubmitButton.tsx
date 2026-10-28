import React, { useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  TouchableOpacity,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

type Props = {
  label: string;
  loading?: boolean;
  disabled?: boolean;
  onPress: () => void;
  style?: ViewStyle;
  textStyle?: TextStyle;
  spinnerColor?: string;
  usePressable?: boolean;
  /** 브랜드 로그인 버튼 hover lift */
  brandHover?: boolean;
};

export function AuthSubmitButton({
  label,
  loading = false,
  disabled = false,
  onPress,
  style,
  textStyle,
  spinnerColor = '#1B2D5B',
  usePressable = false,
  brandHover = false,
}: Props) {
  const isDisabled = disabled || loading;
  const [hovered, setHovered] = useState(false);
  const isWeb = Platform.OS === 'web';

  if (usePressable) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled: isDisabled, busy: loading }}
        onHoverIn={isWeb && !isDisabled ? () => setHovered(true) : undefined}
        onHoverOut={isWeb ? () => setHovered(false) : undefined}
        style={({ pressed }) => [
          style,
          isDisabled && { opacity: 0.65, cursor: 'not-allowed' } as object,
          brandHover &&
            !isDisabled &&
            hovered &&
            isWeb &&
            ({
              transform: [{ translateY: -1 }],
              boxShadow: '0 12px 28px rgba(45,62,44,0.18)',
            } as object),
          brandHover && !isDisabled && pressed && ({ transform: [{ translateY: 0 }] } as object),
          !brandHover && !isDisabled && (pressed || hovered) && { opacity: 0.88 },
        ]}
        onPress={onPress}
        disabled={isDisabled}
      >
        {loading ? <ActivityIndicator color={spinnerColor} /> : <Text style={textStyle}>{label}</Text>}
      </Pressable>
    );
  }

  return (
    <TouchableOpacity style={[style, isDisabled && { opacity: 0.6 }]} onPress={onPress} disabled={isDisabled}>
      {loading ? <ActivityIndicator color={spinnerColor} /> : <Text style={textStyle}>{label}</Text>}
    </TouchableOpacity>
  );
}

type WebKeyDownEvent = {
  key?: string;
  preventDefault?: () => void;
};

/** 웹 DOM input — Enter 키 props spread */
export function webEnterKeyProps(onEnter: () => void): Partial<TextInputProps> {
  if (Platform.OS !== 'web') return {};

  return {
    onKeyPress: (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      if (event.nativeEvent.key !== 'Enter') return;
      onEnter();
    },
    ...({
      onKeyDown: (event: WebKeyDownEvent) => {
        if (event.key !== 'Enter') return;
        event.preventDefault?.();
        onEnter();
      },
    } as Partial<TextInputProps>),
  };
}
