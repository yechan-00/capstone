import { useState, useEffect, useCallback, useRef } from 'react';
import { Insights } from '@/lib/types';
import { insightsService } from '@/services/insightsService';
import { useAuth } from './useAuth';

export const useInsights = (days: number = 30) => {
  const { account } = useAuth();
  const [insights, setInsights] = useState<Insights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const mountedRef = useRef(true);
  const loadInFlightRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadInsights = useCallback(async () => {
    if (!account) return;
    if (loadInFlightRef.current) return;
    loadInFlightRef.current = true;

    try {
      setLoading(true);
      setError(null);
      const data = await insightsService.getInsights(account.id, days);
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
  }, [account, days]);

  useEffect(() => {
    if (!account) {
      setInsights(null);
      setLoading(false);
      return;
    }

    loadInsights();
  }, [account, days, loadInsights]);

  return {
    insights,
    loading,
    error,
    refresh: loadInsights,
  };
};
