import type { Account } from '@/lib/types';

/** 리뷰 로컬 알림 기본 시각 (HH:mm) */
export const DEFAULT_REVIEW_REMINDER_TIME = '19:00';

export const DEFAULT_EXCHANGE_USD_KRW = 1470.05;

/**
 * 계정에 저장된 월 수입을 원화 기준으로 환산합니다.
 * 인사이트(배달/카테고리/후회 비율, 위험 알림)에서 동일 함수를 재사용하세요.
 */
export function toMonthlyIncomeKrw(account: {
  monthlyIncomeAmount?: number;
  monthlyIncomeCurrency?: 'KRW' | 'USD';
  exchangeRateUsdToKrw?: number;
}): number {
  const amount = typeof account.monthlyIncomeAmount === 'number' ? account.monthlyIncomeAmount : 0;
  if (account.monthlyIncomeCurrency === 'USD') {
    const rate = account.exchangeRateUsdToKrw ?? DEFAULT_EXCHANGE_USD_KRW;
    return Math.round(amount * rate);
  }
  return amount;
}

/** Firestore에 값이 없을 때 사용할 리뷰 알림 시각 */
export function resolveReviewReminderTime(account: Account | null): string {
  if (!account) return DEFAULT_REVIEW_REMINDER_TIME;
  const t = account.reviewReminderTime || account.notificationTime;
  if (typeof t === 'string' && /^\d{1,2}:\d{2}$/.test(t)) {
    const [h, m] = t.split(':').map((x) => Number(x));
    if (!Number.isNaN(h) && !Number.isNaN(m)) {
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }
  }
  return DEFAULT_REVIEW_REMINDER_TIME;
}

export function resolveReviewReminderEnabled(account: Account | null): boolean {
  if (!account) return true;
  return account.reviewReminderEnabled !== false;
}
