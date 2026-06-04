import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import {
  cancelScheduledNotificationAsync,
  getAllScheduledNotificationsAsync,
} from 'expo-notifications';
import type { Account } from '@/lib/types';
import { resolveRegretPatternAlertEnabled } from '@/lib/accountSettings';
import {
  buildRegretPatternAlertBody,
  buildRegretPatternAlertTitle,
  pickRegretPatternAlertSlots,
  toExpoWeekday,
  type RegretPatternAlertSlot,
} from '@/lib/regretPatternAlert';
import { expenseService } from '@/services/expenseService';
import { reviewService } from '@/services/reviewService';
import { insightsService } from '@/services/insightsService';
import * as authService from '@/services/authService';
import { ensureNotificationPermission } from '@/services/notificationService';
import { registerExpoPushToken, resolveDeviceTimezone } from '@/services/pushTokenService';

const ALERT_KIND = 'regret_pattern_alert';

async function cancelLocalRegretPatternAlerts(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    const list = await getAllScheduledNotificationsAsync();
    for (const req of list) {
      if (req.content.data?.kind === ALERT_KIND) {
        await cancelScheduledNotificationAsync(req.identifier);
      }
    }
  } catch (error) {
    console.warn('[regretPatternAlert] cancel failed', error);
  }
}

async function scheduleLocalRegretPatternAlert(slot: RegretPatternAlertSlot): Promise<void> {
  if (Platform.OS === 'web') return;

  const body = buildRegretPatternAlertBody(slot);
  const title = buildRegretPatternAlertTitle();
  const trigger: Notifications.NotificationTriggerInput =
    slot.kind === 'weekday' && slot.weekday != null
      ? {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: toExpoWeekday(slot.weekday),
          hour: slot.hour,
          minute: slot.minute,
        }
      : {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: slot.hour,
          minute: slot.minute,
        };

  await Notifications.scheduleNotificationAsync({
    content: {
      title,
      body,
      sound: true,
      data: {
        kind: ALERT_KIND,
        slotId: slot.id,
      },
      ...(Platform.OS === 'android' ? { channelId: 'regret_patterns' } : {}),
    },
    trigger,
  });
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync('regret_patterns', {
    name: '후회 패턴 알림',
    importance: Notifications.AndroidImportance.DEFAULT,
  });
}

async function loadAllTimeAlertSlots(accountId: string): Promise<RegretPatternAlertSlot[]> {
  const expenses = await expenseService.getByAccountId(accountId);
  const reviews = await reviewService.getByAccountId(accountId);
  const regretReviews = reviews.filter((review) => review.decisionAgain === 'no' || review.satisfaction <= 2);
  const expenseMap = new Map(expenses.map((expense) => [expense.id, expense]));
  const regretExpenseIds = new Set(regretReviews.map((review) => review.expenseId));

  const weekdayInsights = insightsService.calculateWeekdayInsights(expenses, regretReviews, expenseMap);
  const timeOfDayInsights = insightsService.calculateTimeOfDayInsights(expenses, regretReviews, expenseMap);

  return pickRegretPatternAlertSlots(weekdayInsights, timeOfDayInsights, expenses, regretExpenseIds);
}

export async function syncRegretPatternAlerts(params: {
  account: Account | null;
}): Promise<RegretPatternAlertSlot[]> {
  const { account } = params;
  if (!account?.id) return [];

  await cancelLocalRegretPatternAlerts();

  const enabled = resolveRegretPatternAlertEnabled(account);
  const timezone = resolveDeviceTimezone();
  let slots: RegretPatternAlertSlot[] = [];

  if (enabled) {
    try {
      slots = await loadAllTimeAlertSlots(account.id);
    } catch (error) {
      console.warn('[regretPatternAlert] load slots failed', error);
      slots = [];
    }
  }

  if (enabled && slots.length > 0 && Platform.OS !== 'web') {
    const granted = await ensureNotificationPermission();
    if (granted) {
      await ensureAndroidChannel();
      for (const slot of slots) {
        try {
          await scheduleLocalRegretPatternAlert(slot);
        } catch (error) {
          console.warn('[regretPatternAlert] schedule failed', slot.id, error);
        }
      }
    }
  }

  const pushToken = await registerExpoPushToken();

  try {
    await authService.syncRegretPatternAlertState(account.id, {
      enabled,
      slots,
      timezone,
      expoPushToken: pushToken,
    });
  } catch (error) {
    console.warn('[regretPatternAlert] firestore sync failed', error);
  }

  return slots;
}

export async function disableRegretPatternAlerts(accountId: string): Promise<void> {
  await cancelLocalRegretPatternAlerts();
  await authService.syncRegretPatternAlertState(accountId, {
    enabled: false,
    slots: [],
    timezone: resolveDeviceTimezone(),
    expoPushToken: await registerExpoPushToken(),
  });
}

export async function loadAllTimePatternInsights(accountId: string) {
  const expenses = await expenseService.getByAccountId(accountId);
  const reviews = await reviewService.getByAccountId(accountId);
  const regretReviews = reviews.filter((review) => review.decisionAgain === 'no' || review.satisfaction <= 2);
  const expenseMap = new Map(expenses.map((expense) => [expense.id, expense]));

  return {
    weekdayInsights: insightsService.calculateWeekdayInsights(expenses, regretReviews, expenseMap),
    timeOfDayInsights: insightsService.calculateTimeOfDayInsights(expenses, regretReviews, expenseMap),
  };
}
