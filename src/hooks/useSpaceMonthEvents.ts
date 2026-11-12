import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { monthEventQueryRange, type SpaceEvent } from '@/lib/spaceEvent';
import {
  classifySpaceEventError,
  spaceEventErrorMessage,
  type SpaceEventErrorKind,
} from '@/lib/spaceEventClient';
import { subscribeSpaceMonthEvents } from '@/services/spaceEventService';

export type SpaceMonthEventsStatus = 'loading' | 'ready' | 'error';

export type UseSpaceMonthEventsResult = {
  events: SpaceEvent[];
  status: SpaceMonthEventsStatus;
  errorKind: SpaceEventErrorKind | null;
  errorMessage: string | null;
  retry: () => void;
};

function isUsableSpaceId(spaceId: string | undefined): spaceId is string {
  return typeof spaceId === 'string' && spaceId.length > 0 && !spaceId.includes('/');
}

export function useSpaceMonthEvents(
  spaceId: string | undefined,
  month: Date,
): UseSpaceMonthEventsResult {
  const router = useRouter();
  const { user, isRegistered, loading: authLoading } = useAuth();
  const uid = isRegistered && user?.uid ? user.uid : null;
  const [status, setStatus] = useState<SpaceMonthEventsStatus>('loading');
  const [events, setEvents] = useState<SpaceEvent[]>([]);
  const [errorKind, setErrorKind] = useState<SpaceEventErrorKind | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  const retry = useCallback(() => {
    setRetryToken((token) => token + 1);
  }, []);

  const year = month.getFullYear();
  const monthIndex = month.getMonth();

  useEffect(() => {
    if (authLoading) {
      setStatus('loading');
      setEvents([]);
      setErrorKind(null);
      return;
    }

    if (!uid) {
      setStatus('error');
      setEvents([]);
      setErrorKind('unauthenticated');
      router.replace(Platform.OS === 'web' ? '/home' : '/(auth)/login');
      return;
    }

    if (!isUsableSpaceId(spaceId)) {
      setStatus('error');
      setEvents([]);
      setErrorKind('not-found');
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setEvents([]);
    setErrorKind(null);

    const range = monthEventQueryRange(new Date(year, monthIndex, 1));
    const unsubscribe = subscribeSpaceMonthEvents(
      spaceId,
      range.start,
      range.end,
      (next) => {
        if (cancelled) return;
        setEvents(next);
        setErrorKind(null);
        setStatus('ready');
      },
      (error) => {
        if (cancelled) return;
        const kind = classifySpaceEventError(error);
        if (__DEV__) console.error('[useSpaceMonthEvents]', kind, error);
        setEvents([]);
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
    events,
    status,
    errorKind,
    errorMessage: errorKind ? spaceEventErrorMessage(errorKind) : null,
    retry,
  };
}
