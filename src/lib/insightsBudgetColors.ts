import { INSIGHTS_THEME } from '@/theme/insightsTheme';

/** 기존 insights 화면 spendRatioBarColor 기준과 동일 */
export function budgetRatioColor(pct: number): string {
  if (pct >= 100) return INSIGHTS_THEME.negative;
  if (pct >= 75) return INSIGHTS_THEME.amber;
  return INSIGHTS_THEME.positive;
}

export function budgetRemainColor(isOver: boolean): string {
  return isOver ? INSIGHTS_THEME.negative : INSIGHTS_THEME.primary;
}

export function shouldShowBudgetAlert(pct: number, isOver: boolean): boolean {
  return isOver || pct >= 80;
}
