export const APP_LOCAL_NOTIFICATION_KINDS = [
  'review_reminder',
  'regret_pattern_alert',
  'risk_nudge',
] as const;

export type AppLocalNotificationKind = (typeof APP_LOCAL_NOTIFICATION_KINDS)[number];

export type LocalNotificationOwner =
  | 'current_account'
  | 'other_account'
  | 'legacy_unknown'
  | 'unrelated'
  | 'tagged';

export function asNotificationData(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

export function readNotificationKind(data: unknown): string | null {
  const kind = asNotificationData(data).kind;
  return typeof kind === 'string' && kind.length > 0 ? kind : null;
}

export function readNotificationAccountId(data: unknown): string | null {
  const accountId = asNotificationData(data).accountId;
  return typeof accountId === 'string' && accountId.length > 0 ? accountId : null;
}

export function readNotificationSlotId(data: unknown): string | null {
  const slotId = asNotificationData(data).slotId;
  return typeof slotId === 'string' && slotId.length > 0 ? slotId : null;
}

export function isAppLocalNotificationKind(kind: string | null): kind is AppLocalNotificationKind {
  return APP_LOCAL_NOTIFICATION_KINDS.includes(kind as AppLocalNotificationKind);
}

export function withLocalNotificationAccountId(
  data: Record<string, unknown>,
  accountId: string | null | undefined,
): Record<string, unknown> {
  if (typeof accountId !== 'string' || accountId.length === 0) return data;
  return { ...data, accountId };
}

/**
 * 현재 계정 ID가 없으면 current/other를 단정하지 않습니다.
 * accountId가 있는 앱 알림은 tagged, 없는 앱 알림은 legacy_unknown.
 */
export function classifyLocalNotificationOwner(
  data: unknown,
  currentAccountId?: string | null,
): LocalNotificationOwner {
  const kind = readNotificationKind(data);
  if (!isAppLocalNotificationKind(kind)) return 'unrelated';

  const accountId = readNotificationAccountId(data);
  if (!accountId) return 'legacy_unknown';
  if (typeof currentAccountId !== 'string' || currentAccountId.length === 0) return 'tagged';
  return accountId === currentAccountId ? 'current_account' : 'other_account';
}
