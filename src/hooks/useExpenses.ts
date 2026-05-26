import { useState, useEffect, useCallback, useRef } from 'react';
import { Expense } from '@/lib/types';
import { expenseService } from '@/services/expenseService';
import { useAuth } from './useAuth';

export const useExpenses = () => {
  const { account, user } = useAuth();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);
  /** 동시에 여러 번 부르면 Watch 스트림이 겹쳐 백오프가 나올 수 있어 한 번에 하나만 실행 */
  const loadInFlightRef = useRef<Promise<void> | null>(null);
  /** 진행 중에 또 불리면, 끝난 뒤 한 번 더 로드 */
  const pendingAfterLoadRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadExpenses = useCallback(async () => {
    if (!account) return;

    const running = loadInFlightRef.current;
    if (running) {
      pendingAfterLoadRef.current = true;
      await running;
      return;
    }

    const p = (async () => {
      try {
        setLoading(true);
        setError(null);
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('expenses-timeout')), 4000)
        );
        const data = await Promise.race([
          expenseService.getByAccountId(account.id),
          timeoutPromise,
        ]);
        if (mountedRef.current) {
          setExpenses(data);
        }
      } catch (err) {
        const error = err instanceof Error ? err : new Error('지출 목록을 불러오는데 실패했습니다.');
        const message = error.message.toLowerCase();
        const isOffline =
          message.includes('offline') ||
          message.includes('expenses-timeout') ||
          message.includes('unavailable') ||
          message.includes('deadline-exceeded');

        if (mountedRef.current) {
          setError(isOffline ? new Error('네트워크 연결을 확인해주세요.') : error);
        }
      } finally {
        loadInFlightRef.current = null;
        if (mountedRef.current) {
          setLoading(false);
        }
        if (pendingAfterLoadRef.current && mountedRef.current) {
          pendingAfterLoadRef.current = false;
          void loadExpenses();
        }
      }
    })();

    loadInFlightRef.current = p;
    await p;
  }, [account]);

  useEffect(() => {
    if (!account) {
      setExpenses([]);
      setLoading(false);
      return;
    }

    loadExpenses();
  }, [account, loadExpenses]);

  const createExpense = useCallback(
    async (expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'accountId' | 'userId'>): Promise<string> => {
      if (!account || !user) throw new Error('계정이 없습니다.');

      try {
        const expenseId = await expenseService.create({
          ...expense,
          accountId: account.id,
          userId: user.uid,
        });
        // 목록 새로고침이 느리거나 타임아웃돼도 저장 완료 UI는 막지 않음
        void loadExpenses();
        return expenseId;
      } catch (err) {
        throw err instanceof Error ? err : new Error('지출을 추가하는데 실패했습니다.');
      }
    },
    [account, user, loadExpenses]
  );

  const updateExpense = useCallback(
    async (expenseId: string, updates: Partial<Expense>): Promise<void> => {
      try {
        await expenseService.update(expenseId, updates);
        await loadExpenses();
      } catch (err) {
        throw err instanceof Error ? err : new Error('지출을 수정하는데 실패했습니다.');
      }
    },
    [loadExpenses]
  );

  const deleteExpense = useCallback(
    async (expenseId: string): Promise<void> => {
      try {
        await expenseService.delete(expenseId);
        await loadExpenses();
      } catch (err) {
        throw err instanceof Error ? err : new Error('지출을 삭제하는데 실패했습니다.');
      }
    },
    [loadExpenses]
  );

  return {
    expenses,
    loading,
    error,
    createExpense,
    updateExpense,
    deleteExpense,
    refresh: loadExpenses,
  };
};
