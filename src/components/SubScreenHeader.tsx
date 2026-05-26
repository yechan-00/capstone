import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/theme/ThemeContext';

type Props = {
  title: string;
  fallbackHref?: Href;
  right?: React.ReactNode;
};

export function SubScreenHeader({
  title,
  fallbackHref = '/(tabs)/settings',
  right,
}: Props) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const goBack = () => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace(fallbackHref);
  };

  return (
    <View
      style={[
        styles.wrapper,
        {
          paddingTop: insets.top,
          backgroundColor: colors.bg,
          borderBottomColor: colors.border,
        },
      ]}
    >
      <View style={styles.header}>
        <Pressable
          onPress={goBack}
          hitSlop={12}
          style={styles.sideSlot}
          accessibilityRole="button"
          accessibilityLabel="뒤로가기"
        >
          <MaterialIcons name="arrow-back" size={24} color={colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        <View style={[styles.sideSlot, right ? styles.sideSlotRight : null]}>{right ?? null}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  sideSlot: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideSlotRight: {
    width: undefined,
    minWidth: 36,
    alignItems: 'flex-end',
    paddingRight: 2,
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '900',
  },
});
