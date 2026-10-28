import type { Account, RegretPatternAlertSlot, WeekdayTimeCell } from '@/lib/types';
import { resolveRegretPatternAlertEnabled } from '@/lib/accountSettings';
import {
  TIME_OF_DAY_LABELS,
  TIME_OF_DAY_ORDER,
  WEEKDAY_DISPLAY_ORDER,
  weekdayLabel,
} from '@/lib/timePatternInsight';
import { INSIGHTS_THEME } from '@/theme/insightsTheme';

export function regretHeatmapCellColor(
  cell: WeekdayTimeCell,
  isPeak: boolean,
): string {
  if (cell.totalCount === 0) return INSIGHTS_THEME.heatmapEmpty;
  if (cell.regretRate === 0) return INSIGHTS_THEME.heatmapZero;
  if (isPeak) return INSIGHTS_THEME.heatmapPeak;
  if (cell.regretRate >= 50) return INSIGHTS_THEME.heatmapHigh;
  if (cell.regretRate >= 25) return INSIGHTS_THEME.heatmapMid;
  return INSIGHTS_THEME.heatmapLow;
}

export function findPeakHeatmapCell(cells: WeekdayTimeCell[]): WeekdayTimeCell | null {
  const candidates = cells.filter((c) => c.totalCount > 0 && c.regretCount > 0);
  if (candidates.length === 0) return null;
  return candidates.sort(
    (a, b) => b.regretRate - a.regretRate || b.regretCount - a.regretCount || b.totalCount - a.totalCount,
  )[0]!;
}

export function buildPatternHero(peak: WeekdayTimeCell | null): {
  dayTime: string;
  subtitle: string;
  rate: number;
} | null {
  if (!peak || peak.regretCount <= 0) return null;
  return {
    dayTime: `${weekdayLabel(peak.weekday)} · ${TIME_OF_DAY_LABELS[peak.timeOfDay]}`,
    subtitle: '후회가 가장 많이 반복됐어요.',
    rate: peak.regretRate,
  };
}

export function buildHeatmapHeadline(cells: WeekdayTimeCell[]): string | null {
  const hero = buildPatternHero(findPeakHeatmapCell(cells));
  if (!hero) return null;
  return `${hero.dayTime}\n${hero.subtitle}`;
}

export function cellAccessibilityLabel(cell: WeekdayTimeCell): string {
  const day = `${weekdayLabel(cell.weekday)}요일`;
  const time = TIME_OF_DAY_LABELS[cell.timeOfDay];
  if (cell.totalCount === 0) return `${day} ${time}, 기록 없음`;
  if (cell.regretCount === 0) return `${day} ${time}, 후회율 0%, ${cell.totalCount}건`;
  return `${day} ${time}, 후회율 ${cell.regretRate.toFixed(0)}%, ${cell.totalCount}건 중 후회 ${cell.regretCount}건`;
}

export function buildHeatmapGrid(cells: WeekdayTimeCell[]) {
  const byKey = new Map(cells.map((c) => [`${c.weekday}:${c.timeOfDay}`, c] as const));
  return TIME_OF_DAY_ORDER.map((timeOfDay) =>
    WEEKDAY_DISPLAY_ORDER.map((weekday) => byKey.get(`${weekday}:${timeOfDay}`) ?? {
      weekday,
      timeOfDay,
      totalCount: 0,
      regretCount: 0,
      regretRate: 0,
      totalAmountKrw: 0,
    }),
  );
}

export type RegretAlertStatus = {
  label: string;
  regretRate: number;
  active: boolean;
};

export function buildRegretAlertStatus(
  account: Account | null | undefined,
  peak: WeekdayTimeCell | null,
): RegretAlertStatus | null {
  if (!account || !peak || peak.regretCount <= 0) return null;
  if (!resolveRegretPatternAlertEnabled(account)) return null;

  const slots = account.regretPatternAlertSlots ?? [];
  if (slots.length === 0) return null;

  const matched = slots.find((slot) => slotMatchesPeak(slot, peak));
  if (!matched) return null;

  return {
    label: `${weekdayLabel(peak.weekday)}요일 ${TIME_OF_DAY_LABELS[peak.timeOfDay]}`,
    regretRate: peak.regretRate,
    active: true,
  };
}

function slotMatchesPeak(slot: RegretPatternAlertSlot, peak: WeekdayTimeCell): boolean {
  if (slot.kind === 'weekday' && slot.weekday === peak.weekday) return true;
  if (slot.kind === 'time' && slot.timeOfDay === peak.timeOfDay) return true;
  return false;
}

export function hasAnyHeatmapData(cells: WeekdayTimeCell[]): boolean {
  return cells.some((c) => c.totalCount > 0);
}

export function hasAnyRegretHeatmapData(cells: WeekdayTimeCell[]): boolean {
  return cells.some((c) => c.regretCount > 0);
}
