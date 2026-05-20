import { Tabs, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';

function AddTabButton({ onPress, fabColor, labelColor }: { onPress: () => void; fabColor: string; labelColor: string }) {
  return (
    <Pressable style={styles.addTabButton} onPress={onPress}>
      <View style={[styles.addTabInner, { backgroundColor: fabColor }]}>
        <MaterialIcons name="add" size={32} color="#fff" />
      </View>
      <Text style={[styles.addTabLabel, { color: labelColor }]}>추가</Text>
    </Pressable>
  );
}

function TabHeaderBackground({
  isDark,
  gradientStart,
  gradientEnd,
  solid,
}: {
  isDark: boolean;
  gradientStart: string;
  gradientEnd: string;
  solid: string;
}) {
  if (isDark) {
    return (
      <LinearGradient
        colors={[gradientStart, gradientEnd]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    );
  }
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: solid }]} />;
}

export default function TabsLayout() {
  const router = useRouter();
  const { colors, isDark } = useTheme();

  const headerTitleColor = isDark ? colors.headerTint : colors.onPrimary;

  return (
    <>
      <StatusBar style="light" />
      <Tabs
        screenOptions={{
          headerShown: true,
          tabBarActiveTintColor: colors.tabActive,
          tabBarInactiveTintColor: colors.tabInactive,
          tabBarStyle: {
            height: 76,
            paddingBottom: 10,
            paddingTop: 8,
            backgroundColor: colors.tabBarBg,
            borderTopColor: colors.tabBarBorder,
            borderTopWidth: StyleSheet.hairlineWidth,
          },
          tabBarLabelStyle: styles.tabLabel,
          headerStyle: { backgroundColor: 'transparent' },
          headerBackground: () => (
            <TabHeaderBackground
              isDark={isDark}
              gradientStart={colors.headerGradientStart}
              gradientEnd={colors.headerGradientEnd}
              solid={colors.accentCta}
            />
          ),
          headerTintColor: headerTitleColor,
          headerTitleStyle: { color: headerTitleColor, fontWeight: '800', fontSize: 17 },
          headerShadowVisible: false,
        }}
      >
      <Tabs.Screen
        name="index"
        options={{
          title: '후회가계부',
          tabBarLabel: '홈',
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
              fabColor={colors.accentCta}
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
    </>
  );
}

const styles = StyleSheet.create({
  tabLabel: { fontSize: 11, fontWeight: '700' },
  addTabButton: { alignItems: 'center', justifyContent: 'center' },
  addTabInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: -18,
    shadowColor: '#1a2d4a',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 10,
    elevation: 8,
  },
  addTabLabel: { marginTop: 2, fontSize: 11, fontWeight: '700' },
});
