import { useCallback, useEffect, useRef } from 'react';
import type { Account } from '@/lib/types';
import { syncRegretPatternAlerts, disableRegretPatternAlerts } from '@/services/regretPatternAlertService';
import { resolveRegretPatternAlertEnabled } from '@/lib/accountSettings';
import { logScheduledNotificationSummary } from '@/services/notificationScheduleDiagnostics';
import { useAuth } from '@/hooks/useAuth';

export function useRegretPatternAlertSync(account: Account | null, refreshKey = '') {
  const { mergeAccountLocal } = useAuth();
  const lastKeyRef = useRef('');
  const busyRef = useRef(false);
  const pendingRef = useRef(false);
  const accountRef = useRef(account);
  accountRef.current = account;

  const runSync = useCallback(async () => {
    if (busyRef.current) {
      pendingRef.current = true;
      return;
    }
    busyRef.current = true;
    try {
      do {
        pendingRef.current = false;
        const current = accountRef.current;
        if (!current?.id) break;

        const enabled = resolveRegretPatternAlertEnabled(current);
        await logScheduledNotificationSummary('pre-sync', current.id, {
          slots: current.regretPatternAlertSlots ?? [],
          enabled,
        });
        if (!enabled) {
          await disableRegretPatternAlerts(current.id);
          mergeAccountLocal({ regretPatternAlertSlots: [], regretPatternAlertSyncedAt: new Date() });
          await logScheduledNotificationSummary('post-sync', current.id, {
            slots: [],
            enabled: false,
          });
          continue;
        }

        const slots = await syncRegretPatternAlerts({ account: current });
        mergeAccountLocal({
          regretPatternAlertSlots: slots,
          regretPatternAlertSyncedAt: new Date(),
          regretPatternAlertEnabled: true,
        });
        await logScheduledNotificationSummary('post-sync', current.id, {
          slots,
          enabled: true,
        });
      } while (pendingRef.current);
    } finally {
      busyRef.current = false;
    }
  }, [mergeAccountLocal]);

  useEffect(() => {
    if (!account?.id) return;
    const key = `${account.id}:${account.regretPatternAlertEnabled !== false}:${refreshKey}`;
    if (lastKeyRef.current === key) return;
    lastKeyRef.current = key;
    void runSync();
  }, [account, refreshKey, runSync]);

  return { refresh: runSync };
}
