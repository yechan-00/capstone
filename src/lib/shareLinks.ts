import { Platform, Share } from 'react-native';
import type { ExpenseCategory } from '@/lib/types';
import { expenseCategoryLabel } from '@/lib/expenseCategoryLabel';

/** 카카오톡 OG·공유 메시지에 쓰는 초대 문구 */
export const SHARE_INVITE_LINE = '놀러오셔서 추억을 기록해봐요!';

/** 웹 공유 페이지 기본 URL (Firebase Hosting) */
export const SHARE_WEB_BASE_URL =
  (process.env.EXPO_PUBLIC_SHARE_BASE_URL ?? 'https://regret-wallet-3db60.web.app').replace(/\/$/, '');

export const SHARE_OG_BRAND_URL = `${SHARE_WEB_BASE_URL}/og-brand.png`;

export function buildShareWebUrl(token: string): string {
  return `${SHARE_WEB_BASE_URL}/share/${token}`;
}

export function buildShareDeepLink(token: string): string {
  return `regretwallet://share/${token}`;
}

export function formatShareMessage(input: {
  title: string;
  subtitle: string;
  amount?: number;
  category: ExpenseCategory;
  webUrl: string;
}): string {
  const amountStr =
    input.amount != null ? `${Number(input.amount).toLocaleString()}원` : '금액 없음';
  const menuLine = [input.subtitle, amountStr].filter(Boolean).join(' · ');
  const lines = [
    '🍽 후회가계부',
    '',
    input.title,
    menuLine,
    expenseCategoryLabel(input.category),
    '',
    `${SHARE_INVITE_LINE} 👇`,
    input.webUrl,
  ];
  return lines.filter((l, i, arr) => !(l === '' && arr[i + 1] === '')).join('\n');
}

/** iOS는 url 필드를 따로 넘기면 카카오톡 등에서 링크 미리보기가 잘 붙는 경우가 많음 */
export async function shareExpenseLink(input: {
  title: string;
  subtitle: string;
  amount?: number;
  category: ExpenseCategory;
  webUrl: string;
}): Promise<void> {
  const message = formatShareMessage(input);
  if (Platform.OS === 'ios') {
    await Share.share({ message, url: input.webUrl });
    return;
  }
  await Share.share({ message });
}
