import { useState, useEffect, useCallback, useRef } from 'react';
import type { Account, Insights, InsightsWindow } from '@/lib/types';
import { toMonthlyIncomeKrw } from '@/lib/accountSettings';
import { currentInsightsMonthWindow, toFoodBudgetKrw } from '@/lib/budgetPeriod';
import { insightsService } from '@/services/insightsService';
import { useAuth } from './useAuth';

export function currentInsightsWindow(
  mode: 'month' | 'year' = 'month',
  account?: Account | null,
): InsightsWindow {
  const now = new Date();
  if (mode === 'year') {
    return { mode: 'year', year: now.getFullYear() };
  }
  return currentInsightsMonthWindow(account);
}

export const useInsights = (window: InsightsWindow) => {
  const { account } = useAuth();
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);
  const loadInFlightRef = useRef(false);
  const prevWindowKeyRef = useRef('');
  const insightsRef = useRef<Insights | null>(null);

  useEffect(() => {
    insightsRef.current = insights;
  }, [insights]);

  const windowKey =
    window.mode === 'month'
      ? `${window.mode}:${window.year}:${window.monthIndex}`
      : `${window.mode}:${window.year}`;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (prevWindowKeyRef.current !== windowKey) {
      setInsights(null);
      prevWindowKeyRef.current = windowKey;
    }
  }, [windowKey]);

  const loadInsights = useCallback(async (options?: { background?: boolean }) => {
    if (!account) return;
    if (loadInFlightRef.current) return;
    loadInFlightRef.current = true;

    const background = options?.background ?? insightsRef.current !== null;

    try {
      if (!background) setLoading(true);
      setError(null);
      const monthlyIncomeKrw = toMonthlyIncomeKrw(account);
      const foodBudgetKrw = toFoodBudgetKrw(account);
      const data = await insightsService.getInsights(
        account.id,
        window,
        account,
        monthlyIncomeKrw,
        foodBudgetKrw,
      );
      if (mountedRef.current) {
        setInsights(data);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error('인사이트를 불러오는데 실패했습니다.'));
      }
    } finally {
      loadInFlightRef.current = false;
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [account, window]);

  useEffect(() => {
    if (!account) {
      setInsights(null);
      setLoading(false);
      return;
    }

    loadInsights();
  }, [account, loadInsights]);

  return {
    insights,
    loading,
    error,
    refresh: () => loadInsights({ background: true }),
  };
};
