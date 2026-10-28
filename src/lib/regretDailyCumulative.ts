export type DailyRegretPoint = {
  day: number;
  dayKey: string;
  ratePercent: number | null;
  regretCount: number;
  reviewCount: number;
};

export type DayReviewDelta = {
  day: number;
  reviewCount: number;
  regretCount: number;
};

/** 로컬 달력 기준 YYYY-MM-DD. UTC Date.parse를 쓰지 않는다. */
export function localDayKey(year: number, monthIndex: number, day: number): string {
  const month = String(monthIndex + 1).padStart(2, '0');
  const date = String(day).padStart(2, '0');
  return `${year}-${month}-${date}`;
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/**
 * 그래프 X축 마지막 일.
 * 현재 월: 오늘, 과거 월: 말일, 미래 월: 0 (임의 미래 날짜를 그리지 않음).
 */
export function chartEndDay(viewingMonth: Date, now: Date): number {
  const year = viewingMonth.getFullYear();
  const monthIndex = viewingMonth.getMonth();
  const last = daysInMonth(year, monthIndex);
  const nowYear = now.getFullYear();
  const nowMonth = now.getMonth();
  if (year > nowYear || (year === nowYear && monthIndex > nowMonth)) return 0;
  if (year === nowYear && monthIndex === nowMonth) {
    return Math.max(1, Math.min(now.getDate(), last));
  }
  return last;
}

/** 1일~endDay 날짜별 누적 후회율. 첫 리뷰 이전은 null, 이후 리뷰가 없으면 직전 값을 유지. */
export function accumulateDailyRegretRates(
  year: number,
  monthIndex: number,
  endDay: number,
  deltas: ReadonlyArray<DayReviewDelta>,
): DailyRegretPoint[] {
  if (endDay <= 0) return [];

  const byDay = new Map<number, { reviewCount: number; regretCount: number }>();
  for (const delta of deltas) {
    if (delta.day < 1 || delta.day > endDay) continue;
    const previous = byDay.get(delta.day) ?? { reviewCount: 0, regretCount: 0 };
    byDay.set(delta.day, {
      reviewCount: previous.reviewCount + delta.reviewCount,
      regretCount: previous.regretCount + delta.regretCount,
    });
  }

  let reviewCount = 0;
  let regretCount = 0;
  const points: DailyRegretPoint[] = [];
  for (let day = 1; day <= endDay; day += 1) {
    const added = byDay.get(day);
    if (added) {
      reviewCount += added.reviewCount;
      regretCount += added.regretCount;
    }
    points.push({
      day,
      dayKey: localDayKey(year, monthIndex, day),
      ratePercent: reviewCount > 0 ? (regretCount / reviewCount) * 100 : null,
      regretCount,
      reviewCount,
    });
  }
  return points;
}

export function formatRegretRateLabel(ratePercent: number | null): string {
  if (ratePercent == null || !Number.isFinite(ratePercent)) return '—%';
  return `${ratePercent.toFixed(0)}%`;
}

export function firstDefinedRateIndex(points: ReadonlyArray<DailyRegretPoint>): number {
  return points.findIndex((point) => point.ratePercent != null);
}

/** 첫·마지막 일은 가능하면 유지하고, 중간 라벨은 간격이 충분할 때만 넣는다. */
export function pickChartDayLabels(endDay: number, plotWidth: number): number[] {
  if (endDay <= 0) return [];
  if (endDay === 1) return [1];

  const minGap = plotWidth < 160 ? 32 : 28;
  const maxLabels = Math.max(2, Math.min(6, Math.floor(plotWidth / minGap)));
  const innerCount = plotWidth < 120 ? 0 : Math.max(0, maxLabels - 2);
  const candidates = [1];
  for (let i = 1; i <= innerCount; i += 1) {
    const day = Math.round((i * (endDay - 1)) / (innerCount + 1)) + 1;
    if (day > 1 && day < endDay && !candidates.includes(day)) candidates.push(day);
  }
  candidates.push(endDay);
  candidates.sort((a, b) => a - b);

  const xOf = (day: number) => ((day - 1) / (endDay - 1)) * plotWidth;
  const kept: number[] = [];
  for (const day of candidates) {
    if (kept.length === 0) {
      kept.push(day);
      continue;
    }
    if (day === endDay) {
      while (kept.length > 1 && xOf(day) - xOf(kept[kept.length - 1]!) < minGap) {
        kept.pop();
      }
      kept.push(day);
      continue;
    }
    const farFromPrev = xOf(day) - xOf(kept[kept.length - 1]!) >= minGap;
    const farFromLast = xOf(endDay) - xOf(day) >= minGap;
    if (farFromPrev && farFromLast) kept.push(day);
  }
  return kept;
}
