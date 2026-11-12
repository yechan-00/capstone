import { useCallback, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type { QueryDocumentSnapshot } from 'firebase/firestore';
import { useAuth } from '@/hooks/useAuth';
import type { SpaceSharedExpense } from '@/lib/spaceSharedExpense';
import {
  classifySpaceSharedExpenseError,
  spaceSharedExpenseErrorMessage,
  type SpaceSharedExpenseErrorKind,
} from '@/lib/spaceSharedExpenseClient';
import { listSpaceSharedExpensesPage } from '@/services/spaceSharedExpenseService';

export type SpaceSharedExpensesStatus = 'loading' | 'ready' | 'error';

export function useSpaceSharedExpenses(spaceId: string | undefined) {
  const router = useRouter();
  const { user, isRegistered, loading: authLoading } = useAuth();
  const uid = isRegistered && user?.uid ? user.uid : null;
  const [status, setStatus] = useState<SpaceSharedExpensesStatus>('loading');
  const [expenses, setExpenses] = useState<SpaceSharedExpense[]>([]);
  const [errorKind, setErrorKind] = useState<SpaceSharedExpenseErrorKind | null>(null);
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
        setExpenses([]);
        setErrorKind('unauthenticated');
        setStatus('error');
        router.replace(Platform.OS === 'web' ? '/home' : '/(auth)/login');
        return;
      }
      if (!spaceId || spaceId.includes('/')) {
        if (id !== requestId.current) return;
        setExpenses([]);
        setErrorKind('not-found');
        setStatus('error');
        return;
      }
      const page = await listSpaceSharedExpensesPage(spaceId, append ? cursorRef.current : null);
      if (id !== requestId.current) return;
      cursorRef.current = page.cursor;
      setHasMore(page.hasMore);
      setExpenses((prev) => (append ? [...prev, ...page.expenses] : page.expenses));
      setErrorKind(null);
      setStatus('ready');
    } catch (error) {
      if (id !== requestId.current) return;
      const kind = classifySpaceSharedExpenseError(error);
      if (!append) {
        setExpenses([]);
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
    expenses,
    status,
    loadingMore,
    hasMore,
    errorKind,
    errorMessage: errorKind ? spaceSharedExpenseErrorMessage(errorKind) : null,
    retry,
    loadMore,
  };
}
