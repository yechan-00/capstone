import { useState, useEffect, useCallback, useRef } from 'react';
import type { Insights, InsightsWindow } from '@/lib/types';
import { toMonthlyIncomeKrw } from '@/lib/accountSettings';
import { insightsService } from '@/services/insightsService';
import { useAuth } from './useAuth';

function windowForMode(periodMode: 'month' | 'year'): InsightsWindow {
  const now = new Date();
  if (periodMode === 'year') {
    return { mode: 'year', year: now.getFullYear() };
  }
  return { mode: 'month', year: now.getFullYear(), monthIndex: now.getMonth() };
}

export const useInsights = (periodMode: 'month' | 'year') => {
  const { account } = useAuth();
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);
  const loadInFlightRef = useRef(false);
  const prevModeRef = useRef(periodMode);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (prevModeRef.current !== periodMode) {
      setInsights(null);
      prevModeRef.current = periodMode;
    }
  }, [periodMode]);

  const loadInsights = useCallback(async () => {
    if (!account) return;
    if (loadInFlightRef.current) return;
    loadInFlightRef.current = true;

    try {
      setLoading(true);
      setError(null);
      const w = windowForMode(periodMode);
      const monthlyIncomeKrw = toMonthlyIncomeKrw(account);
      const data = await insightsService.getInsights(account.id, w, monthlyIncomeKrw);
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
  }, [account, periodMode]);

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
    refresh: loadInsights,
  };
};
