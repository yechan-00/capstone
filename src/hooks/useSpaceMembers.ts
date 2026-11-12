import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import {
  SpaceMembersError,
  classifySpaceMembersError,
  spaceMembersErrorMessage,
  type SpaceMember,
  type SpaceMembersErrorKind,
} from '@/lib/spaceMembersClient';
import { listSpaceMembers } from '@/services/spaceMembersService';

export type SpaceMembersStatus = 'loading' | 'ready' | 'error';

export type UseSpaceMembersResult = {
  members: SpaceMember[];
  status: SpaceMembersStatus;
  refreshing: boolean;
  errorKind: SpaceMembersErrorKind | null;
  errorMessage: string | null;
  retry: () => void;
  refresh: () => Promise<void>;
};

function isUsableSpaceId(spaceId: string | undefined): spaceId is string {
  return typeof spaceId === 'string' && spaceId.length > 0 && !spaceId.includes('/');
}

export function useSpaceMembers(spaceId: string | undefined): UseSpaceMembersResult {
  const router = useRouter();
  const { user, isRegistered, loading: authLoading } = useAuth();
  const uid = isRegistered && user?.uid ? user.uid : null;
  const [status, setStatus] = useState<SpaceMembersStatus>('loading');
  const [refreshing, setRefreshing] = useState(false);
  const [members, setMembers] = useState<SpaceMember[]>([]);
  const [errorKind, setErrorKind] = useState<SpaceMembersErrorKind | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const requestId = useRef(0);
  const hasData = useRef(false);

  useEffect(() => {
    hasData.current = false;
    setMembers([]);
    setErrorKind(null);
    setStatus('loading');
    setRefreshing(false);
  }, [spaceId]);

  const retry = useCallback(() => {
    hasData.current = false;
    setReloadToken((token) => token + 1);
  }, []);

  const load = useCallback(async (silent: boolean) => {
    const id = ++requestId.current;
    if (silent && hasData.current) {
      setRefreshing(true);
    } else {
      setStatus('loading');
      setRefreshing(false);
    }

    try {
      if (!uid) {
        if (id !== requestId.current) return;
        setMembers([]);
        setErrorKind('unauthenticated');
        setStatus('error');
        hasData.current = false;
        router.replace(Platform.OS === 'web' ? '/home' : '/(auth)/login');
        return;
      }
      if (!isUsableSpaceId(spaceId)) {
        if (id !== requestId.current) return;
        setMembers([]);
        setErrorKind('not-found');
        setStatus('error');
        hasData.current = false;
        return;
      }

      const next = await listSpaceMembers(spaceId);
      if (id !== requestId.current) return;
      setMembers(next);
      setErrorKind(null);
      setStatus('ready');
      hasData.current = true;
    } catch (error) {
      if (id !== requestId.current) return;
      const mapped = error instanceof SpaceMembersError
        ? error
        : new SpaceMembersError('unavailable');
      const kind = classifySpaceMembersError(mapped);
      if (__DEV__) console.error('[useSpaceMembers]', mapped.code);
      if (!hasData.current) {
        setMembers([]);
        setStatus('error');
      }
      setErrorKind(kind);
      if (kind === 'unauthenticated') {
        hasData.current = false;
        setMembers([]);
        setStatus('error');
        router.replace(Platform.OS === 'web' ? '/home' : '/(auth)/login');
      }
    } finally {
      if (id === requestId.current) {
        setRefreshing(false);
      }
    }
  }, [router, spaceId, uid]);

  const refresh = useCallback(async () => {
    await load(true);
  }, [load]);

  useFocusEffect(
    useCallback(() => {
      if (authLoading) {
        setStatus('loading');
        return;
      }
      void load(hasData.current);
    }, [authLoading, load, reloadToken]),
  );

  return {
    members,
    status,
    refreshing,
    errorKind,
    errorMessage: errorKind ? spaceMembersErrorMessage(errorKind) : null,
    retry,
    refresh,
  };
}
