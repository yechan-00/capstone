import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { scheduleService } from '@/services/scheduleService';

type NotificationData = {
  kind?: string;
  expenseId?: string;
  scheduleId?: string;
};

async function resolveReviewNavigation(
  data: NotificationData,
  accountId: string | undefined,
): Promise<{ pathname: '/review'; params: { expenseId: string; scheduleId?: string } } | null> {
  const expenseId = typeof data.expenseId === 'string' ? data.expenseId : undefined;
  if (!expenseId) return null;

  let scheduleId = typeof data.scheduleId === 'string' ? data.scheduleId : undefined;
  if (!scheduleId && accountId) {
    const map = await scheduleService.getEarliestPendingScheduleByExpenseIds(accountId, [expenseId], {
      includePastGraceWindow: true,
    });
    scheduleId = map.get(expenseId)?.id;
  }

  return {
    pathname: '/review',
    params: scheduleId ? { expenseId, scheduleId } : { expenseId },
  };
}

async function handleNotificationResponse(
  response: Notifications.NotificationResponse | null,
  navigate: (target: { pathname: '/review' | '/(tabs)/insights'; params?: Record<string, string> }) => void,
  accountId: string | undefined,
): Promise<boolean> {
  if (!response) return false;

  const data = (response.notification.request.content.data ?? {}) as NotificationData;
  const kind = data.kind;

  if (kind === 'regret_pattern_alert') {
    navigate({ pathname: '/(tabs)/insights' });
    return true;
  }

  const reviewTarget = await resolveReviewNavigation(data, accountId);
  if (reviewTarget) {
    navigate(reviewTarget);
    return true;
  }

  return false;
}

export function useNotificationNavigation() {
  const router = useRouter();
  const { account } = useAuth();
  const handledColdStartRef = useRef(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    const navigate = (target: { pathname: '/review' | '/(tabs)/insights'; params?: Record<string, string> }) => {
      router.push(target as never);
    };

    const onResponse = (response: Notifications.NotificationResponse) => {
      void handleNotificationResponse(response, navigate, account?.id);
    };

    const sub = Notifications.addNotificationResponseReceivedListener(onResponse);

    if (!handledColdStartRef.current) {
      handledColdStartRef.current = true;
      void Notifications.getLastNotificationResponseAsync().then((response) => {
        void handleNotificationResponse(response, navigate, account?.id);
      });
    }

    return () => sub.remove();
  }, [router, account?.id]);
}
