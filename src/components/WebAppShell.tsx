import React, { type ReactNode } from 'react';
import { Platform, StyleSheet, View, type ViewStyle } from 'react-native';

type Props = {
  children: ReactNode;
  style?: ViewStyle;
};

/** 웹: 화면 전체 너비·높이 사용. 네이티브 앱은 children만 그대로 반환 */
export function WebAppShell({ children, style }: Props) {
  if (Platform.OS !== 'web') {
    return <>{children}</>;
  }

  return <View style={[styles.webRoot, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  webRoot: {
    flex: 1,
    width: '100%',
    minHeight: '100%',
    alignSelf: 'stretch',
  },
});
