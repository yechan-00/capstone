import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { addDays } from "date-fns";

/** 신규 소비는 D+3 리뷰 알림만 스케줄 */
export type ReviewScheduleTiming = "d3";

export async function ensureNotificationPermission(): Promise<boolean> {
  // 웹은 로컬 알림 미지원 · API가 대기만 하고 끝나지 않는 경우가 있어 조기 종료
  if (Platform.OS === "web") {
    return false;
  }

  // iOS는 권한이 반드시 필요
  const settings = await Notifications.getPermissionsAsync();
  console.log("[notifications] permission settings:", settings);
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

    console.log("[notifications] permission request result:", req);
    granted =
      req.granted ||
      req.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  }

  // Android는 채널 설정 권장 (알림 중요도 등)
  if (granted && Platform.OS === "android") {
    await Notifications.setNotificationChannelAsync("reviews", {
      name: "3일 후 리뷰",
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  return granted;
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
 * 후회 리마인더: 소비일 기준 3일 뒤, 계정에 설정한 알림 시각
 */
export function computeReviewReminderDueDates(
  spentAt: Date,
  notificationTime?: string
): Record<ReviewScheduleTiming, Date> {
  return {
    d3: applyTime(addDays(spentAt, 3), notificationTime),
  };
}

export async function cancelReminder(notificationId: string): Promise<void> {
  if (!notificationId || Platform.OS === "web") {
    return;
  }

  await Notifications.cancelScheduledNotificationAsync(notificationId);
}
