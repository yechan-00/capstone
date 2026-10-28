import { Platform } from 'react-native';
import {
  desiredPatternReservations,
  reservationKey,
} from '@/services/regretPatternAlertService';
import { listScheduledLocalNotifications, type ScheduledLocalNotification } from '@/services/notificationService';
import { resolveRegretPatternAlertEnabled } from '@/lib/accountSettings';
import type { Account, RegretPatternAlertSlot } from '@/lib/types';

type DiagOptions = {
  slots?: RegretPatternAlertSlot[] | null;
  enabled?: boolean;
};

type Snapshot = {
  label: string;
  keys: string[];
  totalScheduled: number;
  regretPatternAlert: number;
};

let lastSnapshot: Snapshot | null = null;

function currentPatternKey(item: ScheduledLocalNotification): string | null {
  if (item.owner !== 'current_account' || item.kind !== 'regret_pattern_alert') return null;
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

function countWhere(items: ScheduledLocalNotification[], match: (item: ScheduledLocalNotification) => boolean): number {
  return items.filter(match).length;
}

function countBySlot(items: ScheduledLocalNotification[]): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    if (item.owner !== 'current_account' || item.kind !== 'regret_pattern_alert') return acc;
    const key = item.slotId ?? 'unknown-slot';
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
}

function triggerKinds(items: ScheduledLocalNotification[]): Record<string, number> {
  return items.reduce<Record<string, number>>((acc, item) => {
    if (item.owner !== 'current_account' || item.kind !== 'regret_pattern_alert') return acc;
    const type = item.trigger.type || 'unknown';
    acc[type] = (acc[type] ?? 0) + 1;
    return acc;
  }, {});
}

function duplicateKeys(keys: string[]): string[] {
  const counts = keys.reduce<Record<string, number>>((acc, key) => {
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  return Object.keys(counts).filter((key) => counts[key] > 1);
}

function snapshotDiff(current: Snapshot): Record<string, unknown> | null {
  if (!lastSnapshot) return null;
  const before = new Set(lastSnapshot.keys);
  const after = new Set(current.keys);
  return {
    previousLabel: lastSnapshot.label,
    previousTotal: lastSnapshot.totalScheduled,
    previousPattern: lastSnapshot.regretPatternAlert,
    keysAdded: current.keys.filter((key) => !before.has(key)),
    keysRemoved: lastSnapshot.keys.filter((key) => !after.has(key)),
    totalDelta: current.totalScheduled - lastSnapshot.totalScheduled,
    patternDelta: current.regretPatternAlert - lastSnapshot.regretPatternAlert,
  };
}

/** 개발 환경 전용. 예약/취소/발송/Firestore 쓰기 없음. 본문·계정 ID는 출력하지 않음. */
export async function logScheduledNotificationSummary(
  label: string,
  currentAccountId?: string | null,
  options?: DiagOptions,
): Promise<void> {
  if (!__DEV__ || Platform.OS === 'web') return;

  try {
    const listed = await listScheduledLocalNotifications(currentAccountId);
    if (listed.listFailed) {
      console.warn('[notif-diag]', label, { listFailed: true });
      return;
    }

    const items = listed.items;
    const currentAccount = items.filter((item) => item.owner === 'current_account');
    const patternItems = currentAccount.filter((item) => item.kind === 'regret_pattern_alert');
    const actualKeys = patternItems
      .map((item) => currentPatternKey(item))
      .filter((key): key is string => Boolean(key));

    const enabled = options?.enabled;
    const slots = options?.slots ?? [];
    const expected = enabled === false ? [] : desiredPatternReservations(slots);
    const expectedKeys = expected.map((item) => item.key);
    const expectedSet = new Set(expectedKeys);
    const actualSet = new Set(actualKeys);

    const snapshot: Snapshot = {
      label,
      keys: actualKeys,
      totalScheduled: items.length,
      regretPatternAlert: patternItems.length,
    };
    const vsPrevious = snapshotDiff(snapshot);
    lastSnapshot = snapshot;

    console.info('[notif-diag]', label, {
      totalScheduled: items.length,
      currentAccount: currentAccount.length,
      reviewReminder: countWhere(currentAccount, (item) => item.kind === 'review_reminder'),
      regretPatternAlert: patternItems.length,
      riskNudge: countWhere(currentAccount, (item) => item.kind === 'risk_nudge'),
      legacyUnknown: countWhere(items, (item) => item.owner === 'legacy_unknown'),
      otherAccount: countWhere(items, (item) => item.owner === 'other_account'),
      unrelated: countWhere(items, (item) => item.owner === 'unrelated'),
      patternEnabled: enabled ?? null,
      patternSlots: slots.map((slot) => ({
        slotId: slot.id,
        kind: slot.kind,
        weekday: slot.weekday ?? null,
        hour: slot.hour,
        minute: slot.minute,
      })),
      expectedReservations: expected.length,
      actualReservations: patternItems.length,
      bySlot: countBySlot(patternItems),
      triggerKinds: triggerKinds(patternItems),
      duplicateKeys: duplicateKeys(actualKeys),
      missingReservations: expectedKeys.filter((key) => !actualSet.has(key)),
      unexpectedReservations: actualKeys.filter((key) => !expectedSet.has(key)),
      unreadablePattern: patternItems.filter((item) => currentPatternKey(item) == null).length,
      offLeftover:
        enabled === false ? patternItems.length : null,
      reservations: patternItems.map((item) => ({
        kind: item.kind,
        slotId: item.slotId,
        owner: item.owner,
        trigger: {
          type: item.trigger.type,
          weekday: item.trigger.weekday ?? null,
          hour: item.trigger.hour ?? null,
          minute: item.trigger.minute ?? null,
          repeats: item.trigger.repeats ?? null,
          readable: item.trigger.readable,
        },
      })),
      vsPrevious,
    });
  } catch {
    console.warn('[notif-diag] read failed', label);
  }
}

export async function logAccountNotificationSummary(label: string, account: Account | null): Promise<void> {
  if (!account?.id) {
    await logScheduledNotificationSummary(label);
    return;
  }
  await logScheduledNotificationSummary(label, account.id, {
    slots: account.regretPatternAlertSlots ?? [],
    enabled: resolveRegretPatternAlertEnabled(account),
  });
}
