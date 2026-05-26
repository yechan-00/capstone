import { useCallback, useRef, type RefObject } from 'react';
import { Keyboard, Platform, type TextInputProps } from 'react-native';

/** 한글·영문 자유 입력 필드 (iOS IME 충돌 완화) */
export const koreanTextInputProps: TextInputProps = Platform.select({
  ios: {
    keyboardType: 'default',
    autoCapitalize: 'none',
    autoCorrect: true,
    textContentType: 'none',
    spellCheck: false,
    autoComplete: 'off',
  },
  default: {
    autoComplete: 'off',
  },
}) ?? {};

/**
 * iOS: number-pad 사용 시 직후 한글 IME가 막히는 RN 이슈 회피.
 * iOS는 default 키보드 + 숫자만 필터, Android는 number-pad 유지.
 */
export const amountKeyboardProps: TextInputProps = Platform.select({
  ios: {
    keyboardType: 'default',
    autoComplete: 'off',
    textContentType: 'none',
    returnKeyType: 'done',
    autoCorrect: false,
    spellCheck: false,
  },
  default: {
    keyboardType: 'number-pad',
  },
}) ?? { keyboardType: 'number-pad' };

export function sanitizeAmountDigits(text: string): string {
  return text.replace(/[^\d]/g, '');
}

type FocusableRef = RefObject<{ focus: () => void; blur: () => void } | null>;

/** iOS: 금액 필드 직후 한글 필드 포커스 시 IME 재초기화 */
export function useIosKoreanFieldTransition(fromRef: FocusableRef) {
  const fromWasFocusedRef = useRef(false);
  const transitioningRef = useRef(false);

  const markFromFocused = useCallback(() => {
    fromWasFocusedRef.current = true;
  }, []);

  const handleKoreanFieldFocus = useCallback(
    (toRef: FocusableRef) => {
      fromRef.current?.blur();
      const cameFromAmount = fromWasFocusedRef.current;
      fromWasFocusedRef.current = false;

      if (Platform.OS !== 'ios' || !cameFromAmount || transitioningRef.current) return;

      transitioningRef.current = true;
      Keyboard.dismiss();
      requestAnimationFrame(() => {
        setTimeout(() => {
          toRef.current?.focus();
          transitioningRef.current = false;
        }, 120);
      });
    },
    [fromRef],
  );

  return { markFromFocused, handleKoreanFieldFocus };
}
