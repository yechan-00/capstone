import { Stack } from 'expo-router';
import { useTheme } from '@/theme/ThemeContext';

export default function SpaceDetailLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="invite" />
      <Stack.Screen name="members" />
      <Stack.Screen name="calendar" />
      <Stack.Screen name="event-form" />
      <Stack.Screen name="memories" />
      <Stack.Screen name="memory-form" />
      <Stack.Screen name="memory/[memoryId]" />
      <Stack.Screen name="expenses" />
      <Stack.Screen name="expense-form" />
      <Stack.Screen name="expense/[expenseId]" />
      <Stack.Screen name="settlements" />
      <Stack.Screen name="settlement-form" />
      <Stack.Screen name="settlement/[settlementId]" />
    </Stack>
  );
}
