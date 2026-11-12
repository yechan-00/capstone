import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { monthEventQueryRange } from '@/lib/spaceEvent';
import type { SpaceMemory } from '@/lib/spaceMemory';
import {
  classifySpaceMemoryError,
  spaceMemoryErrorMessage,
  type SpaceMemoryErrorKind,
} from '@/lib/spaceMemoryClient';
import { subscribeSpaceMonthMemories } from '@/services/spaceMemoryService';

export type SpaceMonthMemoriesStatus = 'loading' | 'ready' | 'error';

export function useSpaceMonthMemories(spaceId: string | undefined, month: Date) {
  const router = useRouter();
  const { user, isRegistered, loading: authLoading } = useAuth();
  const uid = isRegistered && user?.uid ? user.uid : null;
  const [status, setStatus] = useState<SpaceMonthMemoriesStatus>('loading');
  const [memories, setMemories] = useState<SpaceMemory[]>([]);
  const [errorKind, setErrorKind] = useState<SpaceMemoryErrorKind | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const year = month.getFullYear();
  const monthIndex = month.getMonth();

  const retry = useCallback(() => {
    setRetryToken((token) => token + 1);
  }, []);

  useEffect(() => {
    if (authLoading) {
      setStatus('loading');
      setMemories([]);
      setErrorKind(null);
      return;
    }
    if (!uid) {
      setStatus('error');
      setMemories([]);
      setErrorKind('unauthenticated');
      router.replace(Platform.OS === 'web' ? '/home' : '/(auth)/login');
      return;
    }
    if (!spaceId || spaceId.includes('/')) {
      setStatus('error');
      setMemories([]);
      setErrorKind('not-found');
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setMemories([]);
    setErrorKind(null);
    const range = monthEventQueryRange(new Date(year, monthIndex, 1));
    const unsubscribe = subscribeSpaceMonthMemories(
      spaceId,
      range.start,
      range.end,
      (next) => {
        if (cancelled) return;
        setMemories(next);
        setErrorKind(null);
        setStatus('ready');
      },
      (error) => {
        if (cancelled) return;
        const kind = classifySpaceMemoryError(error);
        if (__DEV__) console.error('[useSpaceMonthMemories]', kind, error);
        setMemories([]);
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
  }, [authLoading, monthIndex, retryToken, router, spaceId, uid, year]);

  return {
    memories,
    status,
    errorKind,
    errorMessage: errorKind ? spaceMemoryErrorMessage(errorKind) : null,
    retry,
  };
}
