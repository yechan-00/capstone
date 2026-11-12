import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { monthEventQueryRange } from '@/lib/spaceEvent';
import type { SpaceSharedExpense } from '@/lib/spaceSharedExpense';
import {
  classifySpaceSharedExpenseError,
  spaceSharedExpenseErrorMessage,
  type SpaceSharedExpenseErrorKind,
} from '@/lib/spaceSharedExpenseClient';
import { subscribeSpaceMonthSharedExpenses } from '@/services/spaceSharedExpenseService';

export type SpaceMonthSharedExpensesStatus = 'loading' | 'ready' | 'error';

export function useSpaceMonthSharedExpenses(spaceId: string | undefined, month: Date) {
  const router = useRouter();
  const { user, isRegistered, loading: authLoading } = useAuth();
  const uid = isRegistered && user?.uid ? user.uid : null;
  const [status, setStatus] = useState<SpaceMonthSharedExpensesStatus>('loading');
  const [expenses, setExpenses] = useState<SpaceSharedExpense[]>([]);
  const [errorKind, setErrorKind] = useState<SpaceSharedExpenseErrorKind | null>(null);
  const [retryToken, setRetryToken] = useState(0);
  const year = month.getFullYear();
  const monthIndex = month.getMonth();

  const retry = useCallback(() => {
    setRetryToken((token) => token + 1);
  }, []);

  useEffect(() => {
    if (authLoading) {
      setStatus('loading');
      setExpenses([]);
      setErrorKind(null);
      return;
    }
    if (!uid) {
      setStatus('error');
      setExpenses([]);
      setErrorKind('unauthenticated');
      router.replace(Platform.OS === 'web' ? '/home' : '/(auth)/login');
      return;
    }
    if (!spaceId || spaceId.includes('/')) {
      setStatus('error');
      setExpenses([]);
      setErrorKind('not-found');
      return;
    }

    let cancelled = false;
    setStatus('loading');
    setExpenses([]);
    setErrorKind(null);
    const range = monthEventQueryRange(new Date(year, monthIndex, 1));
    const unsubscribe = subscribeSpaceMonthSharedExpenses(
      spaceId,
      range.start,
      range.end,
      (next) => {
        if (cancelled) return;
        setExpenses(next);
        setErrorKind(null);
        setStatus('ready');
      },
      (error) => {
        if (cancelled) return;
        const kind = classifySpaceSharedExpenseError(error);
        if (__DEV__) console.error('[useSpaceMonthSharedExpenses]', kind, error);
        setExpenses([]);
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
    expenses,
    status,
    errorKind,
    errorMessage: errorKind ? spaceSharedExpenseErrorMessage(errorKind) : null,
    retry,
  };
}
