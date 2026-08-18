import { Stack } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';

import { AUTH } from '@/components/auth/authTheme';

export default function AuthLayout() {
  const stack = (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
    </Stack>
  );

  if (Platform.OS !== 'web') {
    return stack;
  }

  return <View style={styles.webRoot}>{stack}</View>;
}

const styles = StyleSheet.create({
  webRoot: {
    flex: 1,
    width: '100%',
    minHeight: '100%',
    backgroundColor: AUTH.background,
  },
});
