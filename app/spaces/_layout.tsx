import { Stack } from 'expo-router';
import { useTheme } from '@/theme/ThemeContext';

export default function SpacesLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="create" />
      <Stack.Screen name="join" />
      <Stack.Screen name="[spaceId]" />
    </Stack>
  );
}
