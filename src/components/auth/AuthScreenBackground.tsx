import React, { type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';

type Props = {
  children: ReactNode;
};

export function AuthScreenBackground({ children }: Props) {
  const { colors } = useTheme();

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    ...(Platform.OS === 'web' ? { minHeight: '100%' } : {}),
  },
});
