import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform } from 'react-native';
import { AuthProvider } from '@/hooks/useAuth';
import { AuthGate } from '@/components/AuthGate';
import { useNotificationNavigation } from '@/hooks/useNotificationNavigation';
import { ThemeProvider, useTheme } from '@/theme/ThemeContext';
import { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { BrandLogo } from '@/components/BrandLogo';
import { AUTH } from '@/components/auth/authTheme';

function SplashOverlay({ onDone }: { onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 1800);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <View style={styles.splash}>
      <BrandLogo iconSize={96} labelSize={28} layout="column" tone="auth" />
    </View>
  );
}

function AuthNavigationStack() {
  useNotificationNavigation();

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="home" />
      <Stack.Screen name="community" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="expense/[id]" />
      <Stack.Screen name="add-expense" />
      <Stack.Screen name="review" />
      <Stack.Screen name="mood-insights" />
      <Stack.Screen name="settings" options={{ headerShown: false }} />
    </Stack>
  );
}

function ThemedNavigation() {
  const { isDark } = useTheme();
  const skipSplash = Platform.OS === 'web';
  const [ready, setReady] = useState(skipSplash);

  if (!ready) {
    return <SplashOverlay onDone={() => setReady(true)} />;
  }

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AuthProvider>
        <AuthGate>
          <AuthNavigationStack />
        </AuthGate>
      </AuthProvider>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <ThemedNavigation />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    backgroundColor: AUTH.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
