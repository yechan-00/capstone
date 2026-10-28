import {
  accumulateDailyRegretRates,
  chartEndDay,
  daysInMonth,
  firstDefinedRateIndex,
  formatRegretRateLabel,
  localDayKey,
  pickChartDayLabels,
} from '../src/lib/regretDailyCumulative.ts';
import {
  chartXForDay,
  dataRangeDayLabels,
  dayFromChartX,
  shouldCompressLead,
} from '../src/lib/regretChartXScale.ts';

function assertEqual(actual: unknown, expected: unknown, message: string) {
  if (actual !== expected) {
    throw new Error(`${message}: expected ${String(expected)}, got ${String(actual)}`);
  }
}

function assertOk(value: unknown, message: string) {
  if (!value) throw new Error(message);
}

function assertClose(actual: number | null, expected: number, message: string) {
  if (actual == null || !Number.isFinite(actual) || Math.abs(actual - expected) > 1e-9) {
    throw new Error(`${message}: expected ~${String(expected)}, got ${String(actual)}`);
  }
}

function run(name: string, fn: () => void) {
  fn();
  console.log(`ok ${name}`);
}

run('localDayKey does not shift across UTC', () => {
  assertEqual(localDayKey(2026, 9, 14), '2026-10-14', 'oct 14');
  assertEqual(localDayKey(2026, 0, 1), '2026-01-01', 'jan 1');
});

run('daysInMonth covers 28/29/30/31', () => {
  assertEqual(daysInMonth(2026, 1), 28, 'feb 2026');
  assertEqual(daysInMonth(2024, 1), 29, 'feb 2024 leap');
  assertEqual(daysInMonth(2026, 8), 30, 'sep');
  assertEqual(daysInMonth(2026, 9), 31, 'oct');
});

run('chartEndDay uses today for current month and last day for past month', () => {
  const now = new Date(2026, 9, 14);
  assertEqual(chartEndDay(new Date(2026, 9, 1), now), 14, 'current oct 14');
  assertEqual(chartEndDay(new Date(2026, 8, 1), now), 30, 'september');
  assertEqual(chartEndDay(new Date(2026, 1, 1), now), 28, 'feb 2026');
  assertEqual(chartEndDay(new Date(2024, 1, 1), now), 29, 'feb 2024');
  assertEqual(chartEndDay(new Date(2026, 10, 1), now), 0, 'future november');
});

run('chartEndDay on the first of the current month is 1', () => {
  assertEqual(chartEndDay(new Date(2026, 9, 1), new Date(2026, 9, 1)), 1, 'oct 1');
});

run('empty reviews stay null and are not filled with 0%', () => {
  const points = accumulateDailyRegretRates(2026, 9, 14, []);
  assertEqual(points.length, 14, 'length');
  assertOk(points.every((point) => point.ratePercent == null), 'all null');
  assertEqual(firstDefinedRateIndex(points), -1, 'no first rate');
});

run('example cumulative series from the spec', () => {
  const points = accumulateDailyRegretRates(2026, 9, 7, [
    { day: 1, reviewCount: 1, regretCount: 1 },
    { day: 2, reviewCount: 1, regretCount: 0 },
    { day: 3, reviewCount: 1, regretCount: 0 },
    { day: 4, reviewCount: 1, regretCount: 1 },
    { day: 5, reviewCount: 1, regretCount: 0 },
    { day: 7, reviewCount: 1, regretCount: 0 },
  ]);
  assertClose(points[0]!.ratePercent, 100, 'day 1');
  assertClose(points[1]!.ratePercent, 50, 'day 2');
  assertClose(points[2]!.ratePercent, 100 / 3, 'day 3');
  assertClose(points[3]!.ratePercent, 50, 'day 4');
  assertClose(points[4]!.ratePercent, 40, 'day 5');
  assertClose(points[5]!.ratePercent, 40, 'day 6 hold');
  assertEqual(points[5]!.reviewCount, 5, 'day 6 reviews');
  assertClose(points[6]!.ratePercent, 100 / 3, 'day 7');
  assertEqual(points[6]!.regretCount, 2, 'day 7 regrets');
  assertEqual(points[6]!.reviewCount, 6, 'day 7 reviews');
  assertEqual(formatRegretRateLabel(points[6]!.ratePercent), '33%', 'display');
});

run('first review in mid-month stays null before that day', () => {
  const points = accumulateDailyRegretRates(2026, 9, 14, [
    { day: 3, reviewCount: 1, regretCount: 1 },
  ]);
  assertEqual(points[0]!.ratePercent, null, 'day 1');
  assertEqual(points[1]!.ratePercent, null, 'day 2');
  assertEqual(points[2]!.ratePercent, 100, 'day 3');
  assertEqual(points[13]!.ratePercent, 100, 'day 14 hold');
  assertEqual(firstDefinedRateIndex(points), 2, 'first index');
});

run('one non-regret review holds 0%', () => {
  const points = accumulateDailyRegretRates(2026, 9, 14, [
    { day: 3, reviewCount: 1, regretCount: 0 },
  ]);
  assertEqual(points[2]!.ratePercent, 0, 'day 3');
  assertEqual(points[13]!.ratePercent, 0, 'day 14');
});

run('same-day reviews collapse into one cumulative day', () => {
  const points = accumulateDailyRegretRates(2026, 9, 10, [
    { day: 4, reviewCount: 1, regretCount: 1 },
    { day: 4, reviewCount: 1, regretCount: 0 },
    { day: 4, reviewCount: 1, regretCount: 1 },
  ]);
  assertEqual(points[3]!.reviewCount, 3, 'reviews');
  assertEqual(points[3]!.regretCount, 2, 'regrets');
  assertClose(points[3]!.ratePercent, (2 / 3) * 100, 'rate');
  assertClose(points[9]!.ratePercent, points[3]!.ratePercent ?? -1, 'hold');
});

run('all regret and all non-regret hold flat', () => {
  const regrets = accumulateDailyRegretRates(2026, 8, 30, [
    { day: 1, reviewCount: 1, regretCount: 1 },
    { day: 10, reviewCount: 1, regretCount: 1 },
    { day: 20, reviewCount: 1, regretCount: 1 },
  ]);
  assertEqual(regrets[29]!.ratePercent, 100, 'all regret');
  const none = accumulateDailyRegretRates(2026, 8, 30, [
    { day: 1, reviewCount: 1, regretCount: 0 },
    { day: 10, reviewCount: 1, regretCount: 0 },
  ]);
  assertEqual(none[29]!.ratePercent, 0, 'no regret');
});

run('future-dated deltas after endDay are ignored', () => {
  const points = accumulateDailyRegretRates(2026, 9, 14, [
    { day: 10, reviewCount: 1, regretCount: 0 },
    { day: 20, reviewCount: 1, regretCount: 1 },
  ]);
  assertEqual(points[13]!.reviewCount, 1, 'as-of today');
  assertEqual(points[13]!.ratePercent, 0, 'rate');
});

run('pickChartDayLabels keeps first and last', () => {
  const labels = pickChartDayLabels(14, 240);
  assertEqual(labels[0], 1, 'first');
  assertEqual(labels[labels.length - 1], 14, 'last');
  assertOk(labels.length >= 2 && labels.length <= 6, 'count');
  assertEqual(pickChartDayLabels(1, 240)[0], 1, 'single');
});

run('lead compression starts only when first data is after day 1', () => {
  assertEqual(shouldCompressLead(1, 14), false, 'day 1');
  assertEqual(shouldCompressLead(8, 14), true, 'day 8');
  assertEqual(shouldCompressLead(null, 14), false, 'empty');
});

run('compressed x keeps data days equally spaced after the lead', () => {
  const x8 = chartXForDay(8, 14, 8, 0, 200);
  const x11 = chartXForDay(11, 14, 8, 0, 200);
  const x14 = chartXForDay(14, 14, 8, 0, 200);
  assertClose(x8, 20, 'first data at 10%');
  assertClose(x14, 200, 'last day at end');
  assertClose(x11 - x8, x14 - x11, 'equal gaps after first data');
  assertOk(chartXForDay(1, 14, 8, 0, 200) < x8, 'empty days stay in lead');
  assertEqual(dataRangeDayLabels(8, 14).join(','), '8,11,14', 'labels');
});

run('no compression when first data is day 1', () => {
  assertClose(chartXForDay(1, 14, 1, 0, 200), 0, 'day 1');
  assertClose(chartXForDay(14, 14, 1, 0, 200), 200, 'day 14');
});

run('touch mapping follows compressed x', () => {
  const gap = dayFromChartX(8, 14, 8, 0, 200);
  assertEqual(gap.inCompressedGap, true, 'lead is empty');
  assertOk(gap.day < 8, 'lead day before first data');
  const first = dayFromChartX(20, 14, 8, 0, 200);
  assertEqual(first.day, 8, 'first data');
  assertEqual(first.inCompressedGap, false, 'data zone');
  const last = dayFromChartX(200, 14, 8, 0, 200);
  assertEqual(last.day, 14, 'last day');
});

console.log('all daily regret series tests passed');
