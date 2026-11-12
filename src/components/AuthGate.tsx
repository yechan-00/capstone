import React, { useEffect, type ReactNode } from 'react';
import { Platform } from 'react-native';
import { useGlobalSearchParams, useRouter, useSegments } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import {
  hrefAfterAuth,
  inviteCodeFromRouteParam,
  isInviteJoinRoute,
  stashJoinCodeForAuth,
} from '@/lib/spaceInviteClient';

const PUBLIC_ROOTS = new Set(['(auth)', 'home', 'community']);

function isPublicRoute(segments: string[]): boolean {
  const root = segments[0];
  if (!root) return Platform.OS === 'web';
  return PUBLIC_ROOTS.has(root);
}

/**
 * 비로그인·남은 익명 세션: 공개 페이지만. 익명 세션은 지우지 않는다.
 * 정식 회원(비익명): 인증 화면이면 탭 또는 보류 중인 초대 참여 화면으로 보낸다.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const { loading, isRegistered } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const params = useGlobalSearchParams<{ code?: string | string[] }>();

  useEffect(() => {
    if (loading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!isRegistered && !isPublicRoute(segments)) {
      if (isInviteJoinRoute([...segments])) {
        stashJoinCodeForAuth(inviteCodeFromRouteParam(params.code));
      }
      router.replace(Platform.OS === 'web' ? '/home' : '/(auth)/login');
      return;
    }

    if (isRegistered && inAuthGroup) {
      router.replace(hrefAfterAuth());
    }
  }, [isRegistered, loading, params.code, router, segments]);

  return children;
}
