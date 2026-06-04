import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { scheduleService } from '@/services/scheduleService';
import { cancelStaleScheduledDateNotifications } from '@/services/notificationService';

type PendingReviewCountContextValue = {
  count: number;
  refresh: () => Promise<void>;
};

const PendingReviewCountContext = createContext<PendingReviewCountContextValue>({
  count: 0,
  refresh: async () => {},
});

export function PendingReviewCountProvider({ children }: { children: React.ReactNode }) {
  const { account } = useAuth();
  const [count, setCount] = useState(0);
  const busyRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!account?.id) {
      setCount(0);
      return;
    }
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      await scheduleService.clearExpiredReviewReminderNotifications(account.id);
      await cancelStaleScheduledDateNotifications();
      const schedules = await scheduleService.getPendingSchedules(account.id);
      setCount(schedules.length);
    } catch (error) {
      console.warn('[pendingReviewCount] refresh failed', error);
    } finally {
      busyRef.current = false;
    }
  }, [account?.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    (globalThis as { __reloadPendingReviewCount?: () => void }).__reloadPendingReviewCount = () => {
      void refresh();
    };
    return () => {
      delete (globalThis as { __reloadPendingReviewCount?: () => void }).__reloadPendingReviewCount;
    };
  }, [refresh]);

  return (
    <PendingReviewCountContext.Provider value={{ count, refresh }}>
      {children}
    </PendingReviewCountContext.Provider>
  );
}

export function usePendingReviewCount() {
  return useContext(PendingReviewCountContext);
}

/** 탭 포커스 시 대기 리뷰 수 갱신 */
export function useRefreshPendingReviewCountOnFocus() {
  const { refresh } = usePendingReviewCount();

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );
}
