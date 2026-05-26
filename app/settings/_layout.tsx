import { Stack } from 'expo-router';
import { useTheme } from '@/theme/ThemeContext';

export default function SettingsStackLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.primaryDark,
        headerTitleStyle: { fontWeight: '800' as const },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
        headerBackTitle: '설정',
      }}
    >
      <Stack.Screen name="change-nickname" options={{ title: '닉네임 변경' }} />
      <Stack.Screen name="change-email" options={{ title: '이메일 변경' }} />
      <Stack.Screen name="change-password" options={{ title: '비밀번호 변경' }} />
    </Stack>
  );
}
