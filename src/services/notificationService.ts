import * as Notifications from "expo-notifications";
import {
  cancelScheduledNotificationAsync,
  getAllScheduledNotificationsAsync,
} from "expo-notifications";
import { Platform } from "react-native";
import { computeReviewNotificationAt } from '@/lib/reviewWindow';
import {
  classifyLocalNotificationOwner,
  readNotificationKind,
  readNotificationSlotId,
  type AppLocalNotificationKind,
} from '@/lib/localNotificationPayload';

/** 신규 소비는 소비 다음 날 리뷰 알림 스케줄 */
export type ReviewScheduleTiming = "d1";

export async function ensureNotificationPermission(): Promise<boolean> {
  // 웹은 로컬 알림 미지원 · API가 대기만 하고 끝나지 않는 경우가 있어 조기 종료
  if (Platform.OS === "web") {
    return false;
  }

  // iOS는 권한이 반드시 필요
  const settings = await Notifications.getPermissionsAsync();
  let granted =
    settings.granted ||
    settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;

  if (!granted) {
    const req = await Notifications.requestPermissionsAsync({
      ios: {
        allowAlert: true,
        allowSound: true,
        allowBadge: true,
      },
    });

    granted =
      req.granted ||
      req.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  }

  // Android는 채널 설정 권장 (알림 중요도 등)
  if (granted && Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("reviews", {
      name: "리뷰 알림",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  return granted;
}

export type NotificationPermissionKind = 'granted' | 'denied' | 'undetermined' | 'unknown';

/** 권한 팝업 없이 현재 상태만 읽습니다. 웹은 unknown. */
export async function getNotificationPermissionKind(): Promise<NotificationPermissionKind> {
  if (Platform.OS === 'web') return 'unknown';
  try {
    const settings = await Notifications.getPermissionsAsync();
    const displayable =
      settings.granted ||
      settings.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
    if (displayable) return 'granted';
    const undetermined =
      settings.status === Notifications.PermissionStatus.UNDETERMINED ||
      settings.ios?.status === Notifications.IosAuthorizationStatus.NOT_DETERMINED;
    if (undetermined || settings.canAskAgain) return 'undetermined';
    return 'denied';
  } catch {
    return 'unknown';
  }
}

/**
 * 예방 알림을 ON으로 저장하기 전 권한 확인.
 * 홈 바텀시트와 동일한 정책입니다. OFF 경로에서는 호출하지 마세요.
 */
export async function ensurePermissionToEnablePatternAlerts(): Promise<
  'granted' | 'denied' | 'request_denied' | 'skipped'
> {
  if (Platform.OS === 'web') return 'skipped';
  const current = await getNotificationPermissionKind();
  if (current === 'denied') return 'denied';
  if (current === 'granted') return 'granted';
  const granted = await ensureNotificationPermission();
  return granted ? 'granted' : 'request_denied';
}

export async function scheduleReviewReminder(params: {
  title: string;
  body: string;
  dueAt: Date;
  data?: Record<string, unknown>;
}): Promise<string> {
  if (Platform.OS === "web") {
    return "";
  }

  const granted = await ensureNotificationPermission();
  if (!granted) {
    console.warn("알림 권한이 없습니다.");
    return "";
  }

  // 과거 날짜면 알림 건너뜀
  if (params.dueAt <= new Date()) {
    console.warn('알림 날짜가 과거입니다. 건너뜁니다:', params.dueAt);
    return '';
  }

  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: params.title,
        body: params.body,
        sound: true,
        data: params.data,
        ...(Platform.OS === "android" ? { channelId: "reviews" } : {}),
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: params.dueAt,
      },
    });
    return id;
  } catch (error) {
    console.warn('알림 스케줄링 실패 (저장은 계속됩니다):', error);
    return '';
  }
}

const DEFAULT_NOTIFICATION_TIME = "19:00";

const parseTime = (time?: string): { hour: number; minute: number } => {
  if (!time || !/^\d{1,2}:\d{2}$/.test(time)) {
    return { hour: 19, minute: 0 };
  }

  const [h, m] = time.split(":").map((value) => Number(value));
  if (Number.isNaN(h) || Number.isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59) {
    return { hour: 19, minute: 0 };
  }

  return { hour: h, minute: m };
};

const applyTime = (date: Date, time?: string): Date => {
  const { hour, minute } = parseTime(time || DEFAULT_NOTIFICATION_TIME);
  const next = new Date(date);
  next.setHours(hour, minute, 0, 0);
  return next;
};

/**
 * 후회 리마인더: 소비 다음 날(0시 오픈), 계정에 설정한 알림 시각
 */
export function computeReviewReminderDueDates(
  spentAt: Date,
  notificationTime?: string
): Record<ReviewScheduleTiming, Date> {
  return {
    d1: computeReviewNotificationAt(spentAt, notificationTime),
  };
}

export async function cancelReminder(notificationId: string): Promise<void> {
  if (!notificationId || Platform.OS === "web") {
    return;
  }

  await Notifications.cancelScheduledNotificationAsync(notificationId);
}

/** 트리거 시각이 이미 지난 예약 알림 제거(잔여 스케줄 정리) */
export async function cancelStaleScheduledDateNotifications(): Promise<void> {
  if (Platform.OS === "web") {
    return;
  }
  try {
    const list = await getAllScheduledNotificationsAsync();
    const now = Date.now();
    for (const req of list) {
      const trigger = req.trigger as { type?: string; date?: Date | number } | undefined;
      if (!trigger || trigger.type !== "date" || trigger.date == null) continue;
      const raw = trigger.date;
      const ts =
        raw instanceof Date
          ? raw.getTime()
          : typeof raw === "number"
            ? raw
            : new Date(String(raw)).getTime();
      if (Number.isFinite(ts) && ts < now - 30_000) {
        await cancelScheduledNotificationAsync(req.identifier);
      }
    }
  } catch (e) {
    console.warn("[notifications] cancelStaleScheduledDateNotifications", e);
  }
}

export type ScheduledTrigger = {
  type: string;
  hour?: number;
  minute?: number;
  weekday?: number;
  repeats?: boolean;
  readable: boolean;
};

export type ScheduledLocalNotification = {
  identifier: string;
  kind: string | null;
  slotId: string | null;
  owner: ReturnType<typeof classifyLocalNotificationOwner>;
  trigger: ScheduledTrigger;
};

function asTriggerRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function readTriggerNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function parseScheduledTrigger(raw: unknown): ScheduledTrigger {
  const trigger = asTriggerRecord(raw);
  const components = asTriggerRecord(trigger.dateComponents);
  const hour = readTriggerNumber(trigger.hour) ?? readTriggerNumber(components.hour);
  const minute = readTriggerNumber(trigger.minute) ?? readTriggerNumber(components.minute);
  const weekday = readTriggerNumber(trigger.weekday) ?? readTriggerNumber(components.weekday);
  const repeats = typeof trigger.repeats === 'boolean' ? trigger.repeats : undefined;
  let type = typeof trigger.type === 'string' ? trigger.type : 'unknown';
  if (type === 'calendar' && weekday != null) type = 'weekly';
  if (type === 'calendar' && weekday == null && hour != null && minute != null) type = 'daily';
  const readable =
    hour != null &&
    minute != null &&
    ((type === 'weekly' && weekday != null) || type === 'daily');
  return { type, hour, minute, weekday, repeats, readable };
}

export type CancelLocalNotificationsResult = {
  scanned: number;
  currentAccount: number;
  attempted: number;
  cancelled: number;
  failed: number;
  legacyUnknown: number;
  remainingCurrent: number;
  listFailed: boolean;
};

const emptyCancelResult = (): CancelLocalNotificationsResult => ({
  scanned: 0,
  currentAccount: 0,
  attempted: 0,
  cancelled: 0,
  failed: 0,
  legacyUnknown: 0,
  remainingCurrent: 0,
  listFailed: false,
});

export async function listScheduledLocalNotifications(
  currentAccountId?: string | null,
): Promise<{ items: ScheduledLocalNotification[]; listFailed: boolean }> {
  if (Platform.OS === 'web') {
    return { items: [], listFailed: false };
  }
  try {
    const list = await getAllScheduledNotificationsAsync();
    return {
      listFailed: false,
      items: list.map((req) => ({
        identifier: req.identifier,
        kind: readNotificationKind(req.content.data),
        slotId: readNotificationSlotId(req.content.data),
        owner: classifyLocalNotificationOwner(req.content.data, currentAccountId),
        trigger: parseScheduledTrigger(req.trigger),
      })),
    };
  } catch {
    console.warn('[notifications] listScheduledLocalNotifications failed');
    return { items: [], listFailed: true };
  }
}

/**
 * 현재 계정 소유로 확인된 로컬 알림만 취소합니다.
 * other_account / legacy_unknown / unrelated / 허용되지 않은 kind는 보존합니다.
 */
export async function cancelLocalNotificationsForAccount(
  accountId: string,
  kinds?: readonly AppLocalNotificationKind[],
): Promise<CancelLocalNotificationsResult> {
  const result = emptyCancelResult();
  if (!accountId || Platform.OS === 'web') return result;

  const allowed = kinds && kinds.length > 0 ? new Set(kinds) : null;
  const listed = await listScheduledLocalNotifications(accountId);
  if (listed.listFailed) {
    result.listFailed = true;
    return result;
  }

  result.scanned = listed.items.length;
  result.legacyUnknown = listed.items.filter((item) => item.owner === 'legacy_unknown').length;

  const targets = listed.items.filter((item) => {
    if (item.owner !== 'current_account') return false;
    if (!allowed) return true;
    return item.kind != null && allowed.has(item.kind as AppLocalNotificationKind);
  });
  result.currentAccount = targets.length;
  result.attempted = targets.length;

  const failedIds = new Set<string>();
  for (const target of targets) {
    try {
      await cancelScheduledNotificationAsync(target.identifier);
    } catch {
      failedIds.add(target.identifier);
    }
  }

  const after = await listScheduledLocalNotifications(accountId);
  if (after.listFailed) {
    result.listFailed = true;
    result.failed = result.attempted;
    result.cancelled = 0;
    result.remainingCurrent = result.attempted;
    return result;
  }

  const remaining = after.items.filter((item) => {
    if (item.owner !== 'current_account') return false;
    if (!allowed) return true;
    return item.kind != null && allowed.has(item.kind as AppLocalNotificationKind);
  });
  remaining.forEach((item) => failedIds.add(item.identifier));

  result.remainingCurrent = remaining.length;
  result.failed = failedIds.size;
  result.cancelled = Math.max(0, result.attempted - remaining.length);
  return result;
}

export async function cancelScheduledNotificationsByIdentifiers(
  identifiers: string[],
): Promise<{ cancelled: number; failed: number; remainingIds: string[] }> {
  const unique = [...new Set(identifiers.filter(Boolean))];
  if (unique.length === 0 || Platform.OS === 'web') {
    return { cancelled: 0, failed: 0, remainingIds: [] };
  }

  const failed = new Set<string>();
  for (const identifier of unique) {
    try {
      await cancelScheduledNotificationAsync(identifier);
    } catch {
      failed.add(identifier);
    }
  }

  const after = await listScheduledLocalNotifications();
  if (after.listFailed) {
    return { cancelled: 0, failed: unique.length, remainingIds: unique };
  }
  const remainingIds = unique.filter(
    (identifier) => failed.has(identifier) || after.items.some((item) => item.identifier === identifier),
  );
  return {
    cancelled: unique.length - remainingIds.length,
    failed: remainingIds.length,
    remainingIds,
  };
}
