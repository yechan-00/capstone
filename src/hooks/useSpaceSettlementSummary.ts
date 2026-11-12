import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import {
  summarizeSettlements,
  type SettlementSummary,
} from '@/lib/spaceSettlement';
import { listSpaceSettlementsForSummary } from '@/services/spaceSettlementService';

const EMPTY: SettlementSummary = {
  openCount: 0,
  completedCount: 0,
  unpaidTotal: 0,
  myToSend: 0,
  myToReceive: 0,
};

export function useSpaceSettlementSummary(spaceId: string | undefined) {
  const { user, isRegistered, loading: authLoading } = useAuth();
  const uid = isRegistered && user?.uid ? user.uid : null;
  const [summary, setSummary] = useState<SettlementSummary>(EMPTY);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [reloadToken, setReloadToken] = useState(0);
  const requestId = useRef(0);

  const retry = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (authLoading) {
        setStatus('loading');
        return;
      }
      const id = ++requestId.current;
      setStatus('loading');
      void (async () => {
        try {
          if (!uid || !spaceId || spaceId.includes('/')) {
            if (id !== requestId.current) return;
            setSummary(EMPTY);
            setStatus('ready');
            return;
          }
          const rows = await listSpaceSettlementsForSummary(spaceId);
          if (id !== requestId.current) return;
          setSummary(summarizeSettlements(rows, uid));
          setStatus('ready');
        } catch {
          if (id !== requestId.current) return;
          setSummary(EMPTY);
          setStatus('error');
        }
      })();
    }, [authLoading, reloadToken, spaceId, uid]),
  );

  return { summary, status, retry };
}
