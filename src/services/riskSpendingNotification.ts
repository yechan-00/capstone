import { Platform } from 'react-native';
import { scheduleReviewReminder } from '@/services/notificationService';
import { toMonthlyIncomeKrw, resolveReviewReminderEnabled } from '@/lib/accountSettings';
import { isDeliveryOrTakeout } from '@/lib/categoryAnalytics';
import type { Account } from '@/lib/types';
import type { ExpenseCategory } from '@/lib/types';

const RISK_DELAY_MS = 14_000;

type RiskParams = {
  amount: number;
  category: ExpenseCategory;
  tags: string[];
  reason: string;
  spentAt: Date;
  account: Account | null;
};

/**
 * 소비 저장 직후, 과소비·시간대·태그 휴리스틱에 따라 짧은 지연 로컬 알림 1건 (중복 완화).
 * 저장 직후 다른 안내 알림과 겹치지 않게 약간 늦게 스케줄.
 */
export async function scheduleRiskAwarenessAfterExpense(params: RiskParams): Promise<void> {
  if (Platform.OS === 'web') return;
  if (!resolveReviewReminderEnabled(params.account)) return;

  const body = buildRiskMessage(params);
  if (!body) return;

  const dueAt = new Date(Date.now() + RISK_DELAY_MS);
  try {
    await scheduleReviewReminder({
      title: '소비 점검',
      body,
      dueAt,
      data: { kind: 'risk_nudge' },
    });
  } catch {
    // 알림 실패는 무시
  }
}

function buildRiskMessage(p: RiskParams): string | null {
  const { amount, category, tags, reason, spentAt, account } = p;
  const monthly = toMonthlyIncomeKrw(account ?? {});
  const ratio = monthly > 0 ? amount / monthly : 0;
  const hour = spentAt.getHours();
  const isNight = hour >= 23 || hour < 5;
  const tagStr = tags.join(' ');
  const impulse =
    /충동|시발|스트레스|보상|야식/i.test(tagStr) || /충동|스트레스|보상/i.test(reason);
  const deliveryOut = isDeliveryOrTakeout(category);

  if (ratio >= 0.12) {
    return `이번 소비가 월 수입의 ${(ratio * 100).toFixed(0)}%에 가까워요. 내일 한 끼는 계획을 짧게 잡아 보는 건 어때요?`;
  }
  if (ratio >= 0.06) {
    return `이번 금액이 수입 대비 꽤 커요(약 ${(ratio * 100).toFixed(0)}%). 지금 느낀 감정을 한 줄만 더 적어 두면 나중에 패턴이 보여요.`;
  }
  if (amount >= 90_000 && deliveryOut) {
    return '고액 배달·외식이에요. 다음엔 메뉴를 미리 정해 두거나, 장바구니 10분 뒤에 다시 열어 보는 것도 방법이에요.';
  }
  if (isNight && deliveryOut) {
    return '늦은 시간 배달·외식은 다음날 부담으로 느껴질 때가 많아요. 물 한 잔 먼저 마시고, 기록 화면에 한 줄만 적어 두어도 충분해요.';
  }
  if (impulse && amount >= 25_000) {
    return '감정·습관 태그가 보여요. 비슷한 상황이 오면 “5분만 미루기”를 한번 시험해 보세요.';
  }
  return null;
}
