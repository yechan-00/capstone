import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AuthProvider } from '@/hooks/useAuth';
import { ThemeProvider, useTheme } from '@/theme/ThemeContext';

function ThemedNavigation() {
  const { isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AuthProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="expense/[id]" />
          <Stack.Screen name="add-expense" />
          <Stack.Screen name="review" />
          <Stack.Screen name="settings" options={{ headerShown: false }} />
        </Stack>
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
