import { Tabs, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';

function AddTabButton({ onPress, labelColor }: { onPress: () => void; labelColor: string }) {
  return (
    <Pressable style={styles.addTabButton} onPress={onPress}>
      <View style={styles.addTabInner}>
        <MaterialIcons name="add" size={34} color="#fff" />
      </View>
      <Text style={[styles.addTabLabel, { color: labelColor }]}>추가</Text>
    </Pressable>
  );
}

export default function TabsLayout() {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: colors.tabActive,
        tabBarInactiveTintColor: colors.tabInactive,
        tabBarStyle: {
          height: 78,
          paddingBottom: 8,
          paddingTop: 6,
          backgroundColor: colors.tabBarBg,
          borderTopColor: colors.tabBarBorder,
        },
        tabBarLabelStyle: styles.tabLabel,
        headerStyle: { backgroundColor: colors.headerBg },
        headerTintColor: colors.headerTint,
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="home" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="reviews"
        options={{
          title: '리뷰',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="checklist" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="add"
        options={{
          title: '추가',
          tabBarLabel: '추가',
          tabBarButton: () => (
            <AddTabButton
              onPress={() => router.push('/add-expense')}
              labelColor={colors.addTabLabel}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="insights"
        options={{
          title: '인사이트',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="insights" size={size} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: '설정',
          tabBarIcon: ({ color, size }) => <MaterialIcons name="settings" size={size} color={color} />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabLabel: { fontSize: 11, fontWeight: '700' },
  addTabButton: { alignItems: 'center', justifyContent: 'center' },
  addTabInner: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: '#1F4FD6',
    alignItems: 'center', justifyContent: 'center',
    marginTop: -22,
    shadowColor: '#000', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28, shadowRadius: 14, elevation: 10,
  },
  addTabLabel: { marginTop: 2, fontSize: 11, fontWeight: '700' },
});
