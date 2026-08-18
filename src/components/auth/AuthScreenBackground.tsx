import React, { type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { AUTH, AUTH_WEB_BG } from '@/components/auth/authTheme';

type Props = {
  children: ReactNode;
};

export function AuthScreenBackground({ children }: Props) {
  return (
    <View style={styles.root}>
      {Platform.OS === 'web' ? <View style={styles.webGradient} pointerEvents="none" /> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: AUTH.background,
    ...(Platform.OS === 'web' ? { minHeight: '100%' } : {}),
  },
  webGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: AUTH.background,
    backgroundImage: AUTH_WEB_BG,
  } as object,
});
