import Constants from 'expo-constants';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { ensureNotificationPermission } from '@/services/notificationService';

let missingProjectIdLogged = false;

export function resolveExpoProjectId(): string | undefined {
  const id =
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants.expoConfig as { projectId?: string } | null)?.projectId ??
    (Constants as { easConfig?: { projectId?: string } }).easConfig?.projectId;
  return typeof id === 'string' && id.length > 0 ? id : undefined;
}

/** Expo Push(원격) 토큰. EAS projectId 없으면 null — 로컬 알림은 그대로 동작 */
export async function registerExpoPushToken(): Promise<string | null> {
  if (Platform.OS === 'web') return null;

  const projectId = resolveExpoProjectId();
  if (!projectId) {
    if (!missingProjectIdLogged) {
      missingProjectIdLogged = true;
      console.info(
        '[pushToken] EAS projectId 없음 — 원격 푸시 등록 생략 (Expo Go·로컬 알림은 사용 가능). ' +
          '원격 푸시가 필요하면 `npx eas init` 후 EXPO_PUBLIC_EAS_PROJECT_ID를 .env에 넣으세요.',
      );
    }
    return null;
  }

  const granted = await ensureNotificationPermission();
  if (!granted) return null;

  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data ?? null;
  } catch (error) {
    console.warn('[pushToken] registration failed', error);
    return null;
  }
}

export function resolveDeviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Seoul';
  } catch {
    return 'Asia/Seoul';
  }
}
