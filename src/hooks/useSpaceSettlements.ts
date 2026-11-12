import { useCallback, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
import type { SpaceSettlement } from '@/lib/spaceSettlement';
import {
  classifySpaceSettlementError,
  logSpaceSettlementError,
  spaceSettlementErrorMessage,
  type SpaceSettlementErrorKind,
} from '@/lib/spaceSettlementClient';
import { listSpaceSettlementsPage } from '@/services/spaceSettlementService';

export type SpaceSettlementsStatus = 'loading' | 'ready' | 'error';

export function useSpaceSettlements(spaceId: string | undefined) {
  const router = useRouter();
  const { user, isRegistered, loading: authLoading } = useAuth();
  const uid = isRegistered && user?.uid ? user.uid : null;
  const [status, setStatus] = useState<SpaceSettlementsStatus>('loading');
  const [settlements, setSettlements] = useState<SpaceSettlement[]>([]);
  const [errorKind, setErrorKind] = useState<SpaceSettlementErrorKind | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  const cursorRef = useRef<QueryDocumentSnapshot | null>(null);
  const requestId = useRef(0);

  const retry = useCallback(() => {
    cursorRef.current = null;
    setReloadToken((token) => token + 1);
  }, []);

  const loadPage = useCallback(async (append: boolean) => {
    const id = ++requestId.current;
    if (append) setLoadingMore(true);
    else {
      setStatus('loading');
      setLoadingMore(false);
    }
    try {
      if (!uid) {
        if (id !== requestId.current) return;
        setSettlements([]);
        setErrorKind('unauthenticated');
        setStatus('error');
        router.replace(Platform.OS === 'web' ? '/home' : '/(auth)/login');
        return;
      }
      if (!spaceId || spaceId.includes('/')) {
        if (id !== requestId.current) return;
        setSettlements([]);
        setErrorKind('not-found');
        setStatus('error');
        return;
      }
      const page = await listSpaceSettlementsPage(spaceId, append ? cursorRef.current : null);
      if (id !== requestId.current) return;
      cursorRef.current = page.cursor;
      setHasMore(page.hasMore);
      setSettlements((prev) => (append ? [...prev, ...page.settlements] : page.settlements));
      setErrorKind(null);
      setStatus('ready');
    } catch (error) {
      if (id !== requestId.current) return;
      logSpaceSettlementError('useSpaceSettlements', error);
      const kind = classifySpaceSettlementError(error);
      if (!append) {
        setSettlements([]);
        setStatus('error');
      }
      setErrorKind(kind);
      if (kind === 'unauthenticated') {
        router.replace(Platform.OS === 'web' ? '/home' : '/(auth)/login');
      }
    } finally {
      if (id === requestId.current) setLoadingMore(false);
    }
  }, [router, spaceId, uid]);

  const loadMore = useCallback(() => {
    if (loadingMore || !hasMore || status !== 'ready') return;
    void loadPage(true);
  }, [hasMore, loadPage, loadingMore, status]);

  useFocusEffect(
    useCallback(() => {
      if (authLoading) {
        setStatus('loading');
        return;
      }
      cursorRef.current = null;
      void loadPage(false);
    }, [authLoading, loadPage, reloadToken]),
  );

  return {
    settlements,
    status,
    loadingMore,
    hasMore,
    errorKind,
    errorMessage: errorKind ? spaceSettlementErrorMessage(errorKind) : null,
    retry,
    loadMore,
  };
}
