import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
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
import {
  cancelScheduledNotificationsByIdentifiers,
  ensureNotificationPermission,
  listScheduledLocalNotifications,
  type ScheduledLocalNotification,
} from '@/services/notificationService';
import { registerExpoPushToken, resolveDeviceTimezone } from '@/services/pushTokenService';
import { withLocalNotificationAccountId } from '@/lib/localNotificationPayload';

const ALERT_KIND = 'regret_pattern_alert';

type DesiredPatternReservation = {
  key: string;
  slotId: string;
  type: 'weekly' | 'daily';
  weekday?: number;
  hour: number;
  minute: number;
};

export function reservationKey(params: {
  slotId: string;
  type: string;
  weekday?: number;
  hour: number;
  minute: number;
}): string {
  const weekday = params.type === 'weekly' && params.weekday != null ? String(params.weekday) : '-';
  return `${params.slotId}|${params.type}|${weekday}|${params.hour}|${params.minute}`;
}

export function desiredPatternReservations(slots: RegretPatternAlertSlot[]): DesiredPatternReservation[] {
  const weekdaySlot = slots.find((slot) => slot.kind === 'weekday' && slot.weekday != null);
  const timeSlot = slots.find((slot) => slot.kind === 'time');
  const desired: DesiredPatternReservation[] = [];

  if (weekdaySlot && weekdaySlot.weekday != null) {
    const weekday = toExpoWeekday(weekdaySlot.weekday);
    desired.push({
      key: reservationKey({
        slotId: weekdaySlot.id,
        type: 'weekly',
        weekday,
        hour: weekdaySlot.hour,
        minute: weekdaySlot.minute,
      }),
      slotId: weekdaySlot.id,
      type: 'weekly',
      weekday,
      hour: weekdaySlot.hour,
      minute: weekdaySlot.minute,
    });
  }

  if (timeSlot) {
    const overlapsWeekday =
      weekdaySlot != null &&
      weekdaySlot.weekday != null &&
      weekdaySlot.hour === timeSlot.hour &&
      weekdaySlot.minute === timeSlot.minute;

    if (overlapsWeekday && weekdaySlot?.weekday != null) {
      const skip = toExpoWeekday(weekdaySlot.weekday);
      for (let expoWeekday = 1; expoWeekday <= 7; expoWeekday += 1) {
        if (expoWeekday === skip) continue;
        desired.push({
          key: reservationKey({
            slotId: timeSlot.id,
            type: 'weekly',
            weekday: expoWeekday,
            hour: timeSlot.hour,
            minute: timeSlot.minute,
          }),
          slotId: timeSlot.id,
          type: 'weekly',
          weekday: expoWeekday,
          hour: timeSlot.hour,
          minute: timeSlot.minute,
        });
      }
    } else {
      desired.push({
        key: reservationKey({
          slotId: timeSlot.id,
          type: 'daily',
          hour: timeSlot.hour,
          minute: timeSlot.minute,
        }),
        slotId: timeSlot.id,
        type: 'daily',
        hour: timeSlot.hour,
        minute: timeSlot.minute,
      });
    }
  }

  return desired;
}

function currentPatternItems(
  items: ScheduledLocalNotification[],
): ScheduledLocalNotification[] {
  return items.filter((item) => item.owner === 'current_account' && item.kind === ALERT_KIND);
}

function currentReservationKey(item: ScheduledLocalNotification): string | null {
  if (!item.slotId || !item.trigger.readable || item.trigger.hour == null || item.trigger.minute == null) {
    return null;
  }
  return reservationKey({
    slotId: item.slotId,
    type: item.trigger.type,
    weekday: item.trigger.weekday,
    hour: item.trigger.hour,
    minute: item.trigger.minute,
  });
}

async function scheduleDesiredPatternReservation(
  desired: DesiredPatternReservation,
  slot: RegretPatternAlertSlot,
  accountId: string,
): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  const trigger: Notifications.NotificationTriggerInput =
    desired.type === 'weekly' && desired.weekday != null
      ? {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday: desired.weekday,
          hour: desired.hour,
          minute: desired.minute,
        }
      : {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour: desired.hour,
          minute: desired.minute,
        };

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: buildRegretPatternAlertTitle(),
        body: buildRegretPatternAlertBody(slot),
        sound: true,
        data: withLocalNotificationAccountId(
          {
            kind: ALERT_KIND,
            slotId: desired.slotId,
            ...(desired.weekday != null ? { triggerWeekday: desired.weekday } : {}),
          },
          accountId,
        ),
        ...(Platform.OS === 'android' ? { channelId: 'regret_patterns' } : {}),
      },
      trigger,
    });
    return true;
  } catch {
    console.warn('[regretPatternAlert] schedule failed', desired.slotId);
    return false;
  }
}

async function reconcileCurrentAccountPatternAlerts(params: {
  accountId: string;
  slots: RegretPatternAlertSlot[];
  scheduleNew: boolean;
}): Promise<void> {
  const listed = await listScheduledLocalNotifications(params.accountId);
  if (listed.listFailed) {
    if (__DEV__) console.warn('[regretPatternAlert] list failed — skip OS mutation');
    return;
  }

  const current = currentPatternItems(listed.items);
  const desired = desiredPatternReservations(params.slots);
  const desiredKeys = new Set(desired.map((item) => item.key));
  const desiredSlotIds = new Set(params.slots.map((slot) => slot.id));
  const slotById = new Map(params.slots.map((slot) => [slot.id, slot]));

  const matchedIds = new Set<string>();
  const toCancel: string[] = [];
  const blockedSlotIds = new Set<string>();

  const byKey = new Map<string, ScheduledLocalNotification[]>();
  for (const item of current) {
    const key = currentReservationKey(item);
    if (!key) {
      if (item.slotId && !desiredSlotIds.has(item.slotId)) {
        toCancel.push(item.identifier);
      } else if (item.slotId) {
        blockedSlotIds.add(item.slotId);
        if (__DEV__) {
          console.warn('[regretPatternAlert] unreadable trigger kept', { slotId: item.slotId });
        }
      } else if (__DEV__) {
        console.warn('[regretPatternAlert] unreadable current-account alert kept');
      }
      continue;
    }
    const group = byKey.get(key) ?? [];
    group.push(item);
    byKey.set(key, group);
  }

  for (const [key, group] of byKey) {
    const keep = group[0];
    const extras = group.slice(1);
    extras.forEach((item) => toCancel.push(item.identifier));
    if (desiredKeys.has(key)) {
      matchedIds.add(keep.identifier);
    } else {
      toCancel.push(keep.identifier);
    }
  }

  if (toCancel.length > 0) {
    const cancel = await cancelScheduledNotificationsByIdentifiers(toCancel);
    if (cancel.failed > 0) {
      const remaining = await listScheduledLocalNotifications(params.accountId);
      const leftover = remaining.listFailed
        ? current.filter((item) => cancel.remainingIds.includes(item.identifier))
        : currentPatternItems(remaining.items).filter((item) =>
            cancel.remainingIds.includes(item.identifier),
          );
      leftover.forEach((item) => {
        if (item.slotId) blockedSlotIds.add(item.slotId);
      });
      if (__DEV__) {
        console.warn('[regretPatternAlert] cancel leftover', { failed: cancel.failed });
      }
    }
  }

  if (!params.scheduleNew || Platform.OS === 'web') return;

  const after = await listScheduledLocalNotifications(params.accountId);
  if (after.listFailed) {
    if (__DEV__) console.warn('[regretPatternAlert] post-cancel list failed — skip schedule');
    return;
  }

  const remainingKeys = new Set(
    currentPatternItems(after.items)
      .map((item) => currentReservationKey(item))
      .filter((key): key is string => Boolean(key)),
  );

  const granted = await ensureNotificationPermission();
  if (!granted) return;
  await ensureAndroidChannel();

  for (const item of desired) {
    if (remainingKeys.has(item.key)) continue;
    if (blockedSlotIds.has(item.slotId)) continue;
    const slot = slotById.get(item.slotId);
    if (!slot) continue;
    const scheduled = await scheduleDesiredPatternReservation(item, slot, params.accountId);
    if (!scheduled && __DEV__) {
      console.warn('[regretPatternAlert] create failed', { slotId: item.slotId });
    }
  }
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

  if (Platform.OS !== 'web') {
    await reconcileCurrentAccountPatternAlerts({
      accountId: account.id,
      slots: enabled ? slots : [],
      scheduleNew: enabled,
    });
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
  if (Platform.OS !== 'web') {
    await reconcileCurrentAccountPatternAlerts({
      accountId,
      slots: [],
      scheduleNew: false,
    });
  }
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
