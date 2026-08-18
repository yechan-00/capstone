import React, { useRef } from 'react';
import { Animated, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Pressable } from 'react-native';
import { HOME } from '@/components/home/homeTheme';
import { HomeHeader } from '@/components/home/HomeHeader';

export default function CommunityScreen() {
  const router = useRouter();
  const scrollY = useRef(new Animated.Value(0)).current;

  return (
    <View style={styles.root}>
      <HomeHeader scrollY={scrollY} />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.badge}>Coming Soon</Text>
        <Text style={styles.title}>커뮤니티</Text>
        <Text style={styles.body}>
          후회했던 소비 경험을 공유하고{'\n'}다른 사람들과 이야기할 수 있는 공간을 준비하고 있어요.
        </Text>
        <Pressable
          onPress={() => router.push('/home')}
          style={({ pressed }) => [styles.btn, pressed && { opacity: 0.88 }]}
        >
          <Text style={styles.btnText}>홈으로 돌아가기</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: HOME.bg },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingTop: HOME.headerHeight + 40,
    paddingBottom: 80,
    ...(Platform.OS === 'web' ? ({ minHeight: '80vh' } as object) : {}),
  },
  badge: {
    fontSize: 12,
    fontWeight: '800',
    color: HOME.textMuted,
    letterSpacing: 0.5,
    marginBottom: 16,
  },
  title: {
    fontSize: 40,
    fontWeight: '900',
    color: HOME.navy,
    marginBottom: 16,
  },
  body: {
    fontSize: 17,
    lineHeight: 28,
    fontWeight: '500',
    color: HOME.textSec,
    textAlign: 'center',
    marginBottom: 32,
  },
  btn: {
    backgroundColor: HOME.navy,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 999,
  },
  btnText: { color: HOME.white, fontSize: 15, fontWeight: '800' },
});
