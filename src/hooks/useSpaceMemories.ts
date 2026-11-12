import { useCallback, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
import type { SpaceMemory } from '@/lib/spaceMemory';
import {
  classifySpaceMemoryError,
  spaceMemoryErrorMessage,
  type SpaceMemoryErrorKind,
} from '@/lib/spaceMemoryClient';
import { listSpaceMemoriesPage } from '@/services/spaceMemoryService';

export type SpaceMemoriesStatus = 'loading' | 'ready' | 'error';

export function useSpaceMemories(spaceId: string | undefined) {
  const router = useRouter();
  const { user, isRegistered, loading: authLoading } = useAuth();
  const uid = isRegistered && user?.uid ? user.uid : null;
  const [status, setStatus] = useState<SpaceMemoriesStatus>('loading');
  const [memories, setMemories] = useState<SpaceMemory[]>([]);
  const [errorKind, setErrorKind] = useState<SpaceMemoryErrorKind | null>(null);
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
        setMemories([]);
        setErrorKind('unauthenticated');
        setStatus('error');
        router.replace(Platform.OS === 'web' ? '/home' : '/(auth)/login');
        return;
      }
      if (!spaceId || spaceId.includes('/')) {
        if (id !== requestId.current) return;
        setMemories([]);
        setErrorKind('not-found');
        setStatus('error');
        return;
      }
      const page = await listSpaceMemoriesPage(spaceId, append ? cursorRef.current : null);
      if (id !== requestId.current) return;
      cursorRef.current = page.cursor;
      setHasMore(page.hasMore);
      setMemories((prev) => (append ? [...prev, ...page.memories] : page.memories));
      setErrorKind(null);
      setStatus('ready');
    } catch (error) {
      if (id !== requestId.current) return;
      const kind = classifySpaceMemoryError(error);
      if (!append) {
        setMemories([]);
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
    memories,
    status,
    loadingMore,
    hasMore,
    errorKind,
    errorMessage: errorKind ? spaceMemoryErrorMessage(errorKind) : null,
    retry,
    loadMore,
  };
}
