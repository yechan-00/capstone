import { Stack } from 'expo-router';
import { Platform, StyleSheet, View } from 'react-native';

export default function CommunityLayout() {
  const stack = (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
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
    backgroundColor: '#fafbfc',
  },
});
