/** 첫 리뷰 이전 빈 구간이 Plot에서 차지하는 비율. 이후 구간은 나머지를 균등 분할한다. */
export const CHART_LEAD_RATIO = 0.1;

export function shouldCompressLead(firstDataDay: number | null, endDay: number): boolean {
  return firstDataDay != null && firstDataDay > 1 && endDay >= firstDataDay;
}

export function chartXForDay(
  day: number,
  endDay: number,
  firstDataDay: number | null,
  plotLeft: number,
  plotW: number,
  leadRatio: number = CHART_LEAD_RATIO,
): number {
  if (endDay <= 1) return plotLeft + plotW / 2;
  if (!shouldCompressLead(firstDataDay, endDay) || firstDataDay == null) {
    return plotLeft + ((day - 1) / (endDay - 1)) * plotW;
  }

  const leadW = plotW * leadRatio;
  const restW = plotW - leadW;
  const start = firstDataDay;
  if (day < start) {
    const emptySpan = start - 1;
    return plotLeft + ((day - 1) / emptySpan) * leadW;
  }
  if (endDay === start) return plotLeft + leadW;
  return plotLeft + leadW + ((day - start) / (endDay - start)) * restW;
}

export function dayFromChartX(
  locationX: number,
  endDay: number,
  firstDataDay: number | null,
  plotLeft: number,
  plotW: number,
  leadRatio: number = CHART_LEAD_RATIO,
): { day: number; inCompressedGap: boolean } {
  if (endDay <= 1) return { day: 1, inCompressedGap: false };

  if (!shouldCompressLead(firstDataDay, endDay) || firstDataDay == null) {
    const t = (locationX - plotLeft) / plotW;
    const day = Math.round(t * (endDay - 1)) + 1;
    return {
      day: Math.max(1, Math.min(endDay, day)),
      inCompressedGap: false,
    };
  }

  const leadW = plotW * leadRatio;
  const dataStartX = plotLeft + leadW;
  if (locationX < dataStartX) {
    const emptySpan = firstDataDay - 1;
    const t = Math.max(0, Math.min(0.999, (locationX - plotLeft) / leadW));
    const day = emptySpan <= 1 ? 1 : Math.round(t * (emptySpan - 1)) + 1;
    return {
      day: Math.max(1, Math.min(firstDataDay - 1, day)),
      inCompressedGap: true,
    };
  }

  if (endDay === firstDataDay) {
    return { day: firstDataDay, inCompressedGap: false };
  }
  const t = (locationX - dataStartX) / Math.max(1, plotW - leadW);
  const day = firstDataDay + Math.round(t * (endDay - firstDataDay));
  return {
    day: Math.max(firstDataDay, Math.min(endDay, day)),
    inCompressedGap: false,
  };
}

/** 첫 데이터일·중간·마지막. 압축 구간 날짜는 넣지 않는다. */
export function dataRangeDayLabels(firstDataDay: number, endDay: number): number[] {
  if (endDay < firstDataDay) return [];
  if (endDay === firstDataDay) return [firstDataDay];
  if (endDay === firstDataDay + 1) return [firstDataDay, endDay];
  const mid = firstDataDay + Math.floor((endDay - firstDataDay) / 2);
  return [firstDataDay, mid, endDay];
}
