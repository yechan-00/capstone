import { useCallback, useEffect, useRef } from 'react';
import type { Account } from '@/lib/types';
import { syncRegretPatternAlerts, disableRegretPatternAlerts } from '@/services/regretPatternAlertService';
import { resolveRegretPatternAlertEnabled } from '@/lib/accountSettings';
import { useAuth } from '@/hooks/useAuth';

export function useRegretPatternAlertSync(account: Account | null, refreshKey = '') {
  const { mergeAccountLocal } = useAuth();
  const lastKeyRef = useRef('');
  const busyRef = useRef(false);

  const runSync = useCallback(async () => {
    if (!account?.id || busyRef.current) return;
    busyRef.current = true;
    try {
      const enabled = resolveRegretPatternAlertEnabled(account);
      if (!enabled) {
        await disableRegretPatternAlerts(account.id);
        mergeAccountLocal({ regretPatternAlertSlots: [], regretPatternAlertSyncedAt: new Date() });
        return;
      }

      const slots = await syncRegretPatternAlerts({ account });
      mergeAccountLocal({
        regretPatternAlertSlots: slots,
        regretPatternAlertSyncedAt: new Date(),
        regretPatternAlertEnabled: true,
      });
    } finally {
      busyRef.current = false;
    }
  }, [account, mergeAccountLocal]);

  useEffect(() => {
    if (!account?.id) return;
    const key = `${account.id}:${account.regretPatternAlertEnabled !== false}:${refreshKey}`;
    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;
    void runSync();
  }, [account, refreshKey, runSync]);

  return { refresh: runSync };
}
