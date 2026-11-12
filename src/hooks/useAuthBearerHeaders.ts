import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';

export function useAuthBearerHeaders(): {
  headers: Record<string, string> | undefined;
  refresh: () => void;
} {
  const { user } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => {
    setTick((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!user) {
      setToken(null);
      return;
    }
    let cancelled = false;
    void user.getIdToken().then((next) => {
      if (!cancelled) setToken(next);
    }).catch(() => {
      if (!cancelled) setToken(null);
    });
    return () => {
      cancelled = true;
    };
  }, [tick, user]);

  const headers = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : undefined),
    [token],
  );

  return {
    headers,
    refresh,
  };
}
