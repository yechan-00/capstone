import React, { useEffect, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';

const PUBLIC_ROOTS = new Set(['(auth)', 'home', 'community']);

function isPublicRoute(segments: string[]): boolean {
  const root = segments[0];
  if (!root) return Platform.OS === 'web';
  return PUBLIC_ROOTS.has(root);
}

/** 비로그인 사용자는 공개 페이지만, 로그인 사용자는 auth 화면에서 탭으로 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !isPublicRoute(segments)) {
      router.replace(Platform.OS === 'web' ? '/home' : '/(auth)/login');
      return;
    }

    if (user && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [loading, router, segments, user]);

  return children;
}
