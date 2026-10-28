import { Tabs, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { BRAND_GREEN, useTheme } from '@/theme/ThemeContext';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { type QuickPreset } from '@/components/QuickPresetModal';
import { QuickInputSheet, type QuickPresetLoadState } from '@/components/QuickInputSheet';
import * as Haptics from 'expo-haptics';
import { useAuth } from '@/hooks/useAuth';
import { useExpenses } from '@/hooks/useExpenses';
import { PendingReviewCountProvider, usePendingReviewCount } from '@/hooks/usePendingReviewCount';

// ── FAB ───────────────────────────────────────────────────
function AddTabButton({
  onPress, onLongPress, fabColor, labelColor, animationsEnabled,
}: { onPress: () => void; onLongPress: () => void; fabColor: string; labelColor: string; animationsEnabled: boolean }) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Pressable
      style={styles.addTabButton}
      onPressIn={() => {
        if (animationsEnabled) scale.value = withTiming(0.88, { duration: 130 });
      }}
      onPressOut={() => {
        if (animationsEnabled) scale.value = withSpring(1, { damping: 9, stiffness: 200 });
      }}
      onPress={onPress}
      onLongPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
        if (animationsEnabled) {
          scale.value = withSequence(
            withSpring(1.18, { damping: 7, stiffness: 220 }),
            withSpring(1, { damping: 11, stiffness: 200 }),
          );
        }
        onLongPress();
      }}
      delayLongPress={400}
    >
      <Animated.View style={[styles.addTabInner, { backgroundColor: fabColor }, animatedStyle]}>
        <MaterialIcons name="add" size={32} color="#fff" />
      </Animated.View>
      <Text style={[styles.addTabLabel, { color: labelColor }]}>추가</Text>
    </Pressable>
  );
}

const QUICK_PRESETS_KEY = '@rw_quick_presets';

function isQuickPresetItem(value: unknown): value is QuickPreset {
  if (!value || typeof value !== 'object') return false;
  const item = value as { id?: unknown };
  return typeof item.id === 'string' && item.id.length > 0;
}

function persistQuickPresets(next: QuickPreset[], canWrite: boolean) {
  if (!canWrite) {
    console.info('[quick-preset] storage write skipped', { reason: 'not-hydrated' });
    return;
  }
  AsyncStorage.setItem(QUICK_PRESETS_KEY, JSON.stringify(next))
    .then(() => {
      console.info('[quick-preset] storage write success', { count: next.length });
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : String(error);
      console.info('[quick-preset] storage write failed', { error: message });
    });
}

async function readQuickPresets(): Promise<{
  status: Exclude<QuickPresetLoadState, 'loading'>;
  presets: QuickPreset[];
}> {
  console.info('[quick-preset] storage read start');
  try {
    const raw = await AsyncStorage.getItem(QUICK_PRESETS_KEY);
    const exists = raw != null;
    const length = raw?.length ?? 0;
    if (!exists) {
      console.info('[quick-preset] storage read result', {
        exists: false,
        length: 0,
        parseSuccess: true,
        isArray: true,
        count: 0,
        itemsValid: true,
      });
      return { status: 'ready', presets: [] };
    }
    try {
      const parsed: unknown = JSON.parse(raw);
      const isArray = Array.isArray(parsed);
      const count = isArray ? parsed.length : 0;
      const itemsValid = isArray && parsed.every(isQuickPresetItem);
      console.info('[quick-preset] storage read result', {
        exists: true,
        length,
        parseSuccess: true,
        isArray,
        count,
        itemsValid,
      });
      if (!isArray || !itemsValid) return { status: 'parse_error', presets: [] };
      return { status: 'ready', presets: parsed as QuickPreset[] };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.info('[quick-preset] storage read result', {
        exists: true,
        length,
        parseSuccess: false,
        isArray: false,
        count: 0,
        itemsValid: false,
        error: message,
      });
      return { status: 'parse_error', presets: [] };
    }
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.info('[quick-preset] storage read result', {
      exists: false,
      length: 0,
      parseSuccess: false,
      isArray: false,
      count: 0,
      itemsValid: false,
      error: message,
    });
    return { status: 'error', presets: [] };
  }
}

function TabHeaderBackground({
  isDark, gradientStart, gradientEnd, solid,
}: { isDark: boolean; gradientStart: string; gradientEnd: string; solid: string }) {
  if (isDark) {
    return (
      <LinearGradient
        colors={[gradientStart, gradientEnd]}
        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    );
  }
  return <View style={[StyleSheet.absoluteFill, { backgroundColor: solid, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E8EEEA' }]} />;
}

// ── 메인 레이아웃 ─────────────────────────────────────────
function TabsNavigator() {
  const router = useRouter();
  const { colors, isDark, animationsEnabled } = useTheme();
  const headerTitleColor = isDark ? colors.headerTint : colors.text;
  const { count: pendingReviewCount } = usePendingReviewCount();

  const { account, user, loading: authLoading } = useAuth();
  const { createExpense } = useExpenses();
  const [showQuickSheet, setShowQuickSheet] = useState(false);
  const [quickPresets, setQuickPresets] = useState<QuickPreset[]>([]);
  const [presetLoadState, setPresetLoadState] = useState<QuickPresetLoadState>('loading');
  const persistAllowedRef = useRef(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(Platform.OS === 'web' ? '/home' : '/(auth)/login');
    }
  }, [authLoading, router, user]);

  const reviewTabBadge =
    pendingReviewCount > 0 ? (pendingReviewCount > 99 ? '99+' : pendingReviewCount) : undefined;

  const hydrateQuickPresets = useCallback(() => {
    persistAllowedRef.current = false;
    setPresetLoadState('loading');
    void readQuickPresets().then((result) => {
      persistAllowedRef.current = result.status === 'ready';
      setQuickPresets(result.presets);
      setPresetLoadState(result.status);
    });
  }, []);

  useEffect(() => {
    hydrateQuickPresets();
  }, [hydrateQuickPresets]);

  const handleAddPreset = useCallback((preset: QuickPreset) => {
    if (!persistAllowedRef.current) {
      console.info('[quick-preset] storage write skipped', { reason: 'not-hydrated' });
      return;
    }
    setQuickPresets((prev) => {
      const exists = prev.findIndex((item) => item.id === preset.id);
      const next =
        exists >= 0
          ? prev.map((item) => (item.id === preset.id ? preset : item))
          : [...prev, preset];
      persistQuickPresets(next, persistAllowedRef.current);
      return next;
    });
  }, []);

  const handleDeletePreset = useCallback((id: string) => {
    if (!persistAllowedRef.current) {
      console.info('[quick-preset] storage write skipped', { reason: 'not-hydrated' });
      return;
    }
    setQuickPresets((prev) => {
      const next = prev.filter((item) => item.id !== id);
      persistQuickPresets(next, persistAllowedRef.current);
      return next;
    });
  }, []);

  return (
    <>
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <Tabs
        screenOptions={{
          headerShown: true,
          tabBarActiveTintColor: BRAND_GREEN,
          tabBarInactiveTintColor: colors.tabInactive,
          tabBarStyle: {
            height: 76, paddingBottom: 10, paddingTop: 8,
            backgroundColor: colors.tabBarBg,
            borderTopColor: colors.tabBarBorder,
            borderTopWidth: StyleSheet.hairlineWidth,
          },
          tabBarLabelStyle: styles.tabLabel,
          tabBarBadgeStyle: styles.tabBadge,
          headerStyle: { backgroundColor: 'transparent' },
          headerBackground: () => (
            <TabHeaderBackground
              isDark={isDark}
              gradientStart={colors.headerGradientStart}
              gradientEnd={colors.headerGradientEnd}
              solid={colors.surface}
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
            headerShown: false,
            title: '후회가계부',
            tabBarLabel: '홈',
            tabBarIcon: ({ color, size }) => <MaterialIcons name="home" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="reviews"
          options={{
            headerShown: false,
            title: '리뷰',
            tabBarBadge: reviewTabBadge,
            tabBarIcon: ({ color, size }) => <MaterialIcons name="checklist" size={size} color={color} />,
          }}
        />
        <Tabs.Screen
          name="add"
          options={{
            title: '추가', tabBarLabel: '추가',
            tabBarButton: () => (
              <AddTabButton
                onPress={() => router.push('/add-expense')}
                onLongPress={() => { setShowQuickSheet(true); }}
                fabColor={BRAND_GREEN}
                labelColor={colors.addTabLabel}
                animationsEnabled={animationsEnabled}
              />
            ),
          }}
        />
        <Tabs.Screen name="insights" options={{ title: '인사이트', tabBarIcon: ({ color, size }) => <MaterialIcons name="insights" size={size} color={color} /> }} />
        <Tabs.Screen name="settings" options={{ title: '설정', tabBarIcon: ({ color, size }) => <MaterialIcons name="settings" size={size} color={color} /> }} />
      </Tabs>

      <QuickInputSheet
        visible={showQuickSheet}
        onClose={() => setShowQuickSheet(false)}
        quickPresets={quickPresets}
        presetLoadState={presetLoadState}
        onRetryLoad={hydrateQuickPresets}
        handleDeletePreset={handleDeletePreset}
        handleAddPreset={handleAddPreset}
        onSaved={() => {
          (globalThis as { __reloadHomeExpenses?: () => void }).__reloadHomeExpenses?.();
          (globalThis as { __reloadPendingReviewCount?: () => void }).__reloadPendingReviewCount?.();
        }}
        account={account}
        createExpense={createExpense}
      />
    </>
  );
}

export default function TabsLayout() {
  return (
    <PendingReviewCountProvider>
      <TabsNavigator />
    </PendingReviewCountProvider>
  );
}

const styles = StyleSheet.create({
  tabLabel: { fontSize: 11, fontWeight: '700' },
  tabBadge: {
    backgroundColor: '#ef4444',
    color: '#fff',
    fontSize: 10,
    fontWeight: '800',
    minWidth: 18,
    height: 18,
    lineHeight: 18,
  },
  addTabButton: { alignItems: 'center', justifyContent: 'center' },
  addTabInner: {
    width: 56, height: 56, borderRadius: 28,
    alignItems: 'center', justifyContent: 'center',
    marginTop: -18,
    shadowColor: '#28624D', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14, shadowRadius: 8, elevation: 4,
  },
  addTabLabel: { marginTop: 2, fontSize: 11, fontWeight: '700' },
});
