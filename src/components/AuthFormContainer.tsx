import React, { type ReactNode } from 'react';
import { View, type ViewStyle } from 'react-native';

type Props = {
  children: ReactNode;
  style?: ViewStyle;
};

/** 로그인·회원가입 폼 래퍼 (Enter 제출은 webEnterKeyProps + onSubmitEditing 사용) */
export function AuthFormContainer({ children, style }: Props) {
  return <View style={style}>{children}</View>;
}
