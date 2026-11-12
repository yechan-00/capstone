import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import {
  spaceDetailErrorMessage,
  type SpaceDetailErrorKind,
  type SpaceDetailRecord,
} from '@/lib/spaceList';
import { subscribeSpaceDetail } from '@/services/spaceService';

export type SpaceDetailStatus = 'loading' | 'ready' | 'error';

export type UseSpaceDetailResult = {
  space: SpaceDetailRecord | null;
  myRole: string | undefined;
  status: SpaceDetailStatus;
  errorKind: SpaceDetailErrorKind | null;
  errorMessage: string | null;
  retry: () => void;
};

function isUsableSpaceId(spaceId: string | undefined): spaceId is string {
  return typeof spaceId === 'string' && spaceId.length > 0 && !spaceId.includes('/');
}

export function useSpaceDetail(spaceId: string | undefined): UseSpaceDetailResult {
  const router = useRouter();
  const { user, isRegistered, loading: authLoading } = useAuth();
  const uid = isRegistered && user?.uid ? user.uid : null;
  const [status, setStatus] = useState<SpaceDetailStatus>('loading');
  const [space, setSpace] = useState<SpaceDetailRecord | null>(null);
  const [myRole, setMyRole] = useState<string | undefined>(undefined);
  const [errorKind, setErrorKind] = useState<SpaceDetailErrorKind | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  const retry = useCallback(() => {
    setRetryToken((token) => token + 1);
  }, []);

  useEffect(() => {
    if (authLoading) {
      setStatus('loading');
      setSpace(null);
      setMyRole(undefined);
      setErrorKind(null);
      return;
    }

    if (!uid) {
      setStatus('error');
      setSpace(null);
      setMyRole(undefined);
      setErrorKind('unauthenticated');
      router.replace(Platform.OS === 'web' ? '/home' : '/(auth)/login');
      return;
    }

    if (!isUsableSpaceId(spaceId)) {
      setStatus('error');
      setSpace(null);
      setMyRole(undefined);
      setErrorKind('not-found');
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setSpace(null);
    setMyRole(undefined);
    setErrorKind(null);

    const unsubscribe = subscribeSpaceDetail(
      spaceId,
      uid,
      (payload) => {
        if (cancelled) return;
        setSpace(payload.space);
        setMyRole(payload.role);
        setErrorKind(null);
        setStatus('ready');
      },
      (kind, error) => {
        if (cancelled) return;
        if (__DEV__) console.error('[useSpaceDetail]', kind, error);
        setSpace(null);
        setMyRole(undefined);
        setErrorKind(kind);
        setStatus('error');
        if (kind === 'unauthenticated') {
          router.replace(Platform.OS === 'web' ? '/home' : '/(auth)/login');
        }
      },
    );

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [authLoading, retryToken, router, spaceId, uid]);

  return {
    space,
    myRole,
    status,
    errorKind,
    errorMessage: errorKind ? spaceDetailErrorMessage(errorKind) : null,
    retry,
  };
}
