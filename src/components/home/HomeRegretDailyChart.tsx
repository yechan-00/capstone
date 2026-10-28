import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, G, Line, Path, Text as SvgText } from 'react-native-svg';
import {
  chartXForDay,
  dataRangeDayLabels,
  dayFromChartX,
  shouldCompressLead,
} from '@/lib/regretChartXScale';
import {
  firstDefinedRateIndex,
  pickChartDayLabels,
  type DailyRegretPoint,
} from '@/lib/regretDailyCumulative';
import { BRAND_GREEN, useTheme } from '@/theme/ThemeContext';

export type HomeRegretDailyChartHandle = {
  clearSelection: () => void;
};

type Props = {
  points: DailyRegretPoint[];
  width: number;
  height: number;
  emptyMessage?: string;
  compact?: boolean;
  onSelectPoint?: (point: DailyRegretPoint | null) => void;
};

const Y_TICKS_FULL = [0, 20, 40, 60, 80, 100] as const;
const Y_TICKS_COMPACT = [0, 50, 100] as const;
const STROKE_WIDTH = 2.3;

function compactDayLabels(endDay: number): number[] {
  if (endDay <= 0) return [];
  if (endDay === 1) return [1];
  if (endDay === 2) return [1, 2];
  return [1, Math.floor(endDay / 2), endDay];
}

export const HomeRegretDailyChart = forwardRef<HomeRegretDailyChartHandle, Props>(
  function HomeRegretDailyChart(
    {
      points,
      width,
      height,
      emptyMessage = '리뷰가 쌓이면 변화가 보여요',
      compact = false,
      onSelectPoint,
    },
    ref,
  ) {
    const { colors, isDark } = useTheme();
    const [selectedDay, setSelectedDay] = useState<number | null>(null);

    const yTicks = compact ? Y_TICKS_COMPACT : Y_TICKS_FULL;
    const yAxisW = compact ? 18 : 28;
    const xAxisH = compact ? 12 : 18;
    const padTop = compact ? 2 : 6;
    const padRight = compact ? 3 : 8;
    const axisFont = compact ? 7 : 9;
    const plotLeft = yAxisW;
    const plotTop = padTop;
    const plotW = Math.max(1, width - yAxisW - padRight);
    const plotH = Math.max(1, height - padTop - xAxisH);
    const endDay = points.length;
    const firstIdx = firstDefinedRateIndex(points);
    const firstDataDay = firstIdx >= 0 ? points[firstIdx]!.day : null;
    const compressLead = shouldCompressLead(firstDataDay, endDay);
    const hasLine = firstIdx >= 0;

    const clearSelection = useCallback(() => {
      setSelectedDay(null);
      onSelectPoint?.(null);
    }, [onSelectPoint]);

    useImperativeHandle(ref, () => ({ clearSelection }), [clearSelection]);

    const xOf = useCallback(
      (day: number) => chartXForDay(day, endDay, firstDataDay, plotLeft, plotW),
      [endDay, firstDataDay, plotLeft, plotW],
    );

    const yOf = useCallback(
      (rate: number) => plotTop + plotH - (Math.max(0, Math.min(100, rate)) / 100) * plotH,
      [plotH, plotTop],
    );

    const linePath = useMemo(() => {
      if (!hasLine || firstIdx < 0) return null;
      const segment = points.slice(firstIdx);
      if (segment.length < 2) return null;
      return segment
        .map((point, index) => {
          const x = xOf(point.day);
          const y = yOf(point.ratePercent ?? 0);
          return `${index === 0 ? 'M' : 'L'} ${x.toFixed(1)} ${y.toFixed(1)}`;
        })
        .join(' ');
    }, [firstIdx, hasLine, points, xOf, yOf]);

    const singlePoint =
      hasLine && firstIdx >= 0 && points.slice(firstIdx).length === 1 ? points[firstIdx]! : null;

    const xLabels = useMemo(() => {
      if (firstDataDay != null && compressLead) return dataRangeDayLabels(firstDataDay, endDay);
      return compact ? compactDayLabels(endDay) : pickChartDayLabels(endDay, plotW);
    }, [compact, compressLead, endDay, firstDataDay, plotW]);
    const selected = selectedDay != null ? points[selectedDay - 1] ?? null : null;

    const selectAtX = useCallback(
      (locationX: number) => {
        if (!hasLine || endDay <= 0) return;
        const { day } = dayFromChartX(locationX, endDay, firstDataDay, plotLeft, plotW);
        setSelectedDay(day);
        onSelectPoint?.(points[day - 1] ?? null);
      },
      [endDay, firstDataDay, hasLine, onSelectPoint, plotLeft, plotW, points],
    );

    if (width <= 0 || height <= 0) return null;

    if (!hasLine) {
      return (
        <View style={[styles.empty, { width, height }]}>
          <Text style={[styles.emptyText, { color: colors.textMuted }]} numberOfLines={2}>
            {emptyMessage}
          </Text>
        </View>
      );
    }

    const selectedX = selected ? xOf(selected.day) : 0;
    const selectedY = selected?.ratePercent != null ? yOf(selected.ratePercent) : plotTop + plotH / 2;
    const shortHalf = Math.min(plotW * 0.22, 22);
    const guideColor = isDark ? colors.border : '#E8EEEA';

    return (
      <View
        style={{ width, height, overflow: 'hidden' }}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={(event) => selectAtX(event.nativeEvent.locationX)}
        onResponderMove={(event) => selectAtX(event.nativeEvent.locationX)}
        accessibilityRole="adjustable"
        accessibilityLabel="이번 달 날짜별 누적 후회율 그래프"
      >
        <Svg width={width} height={height}>
          {yTicks.map((tick) => {
            const y = yOf(tick);
            return (
              <G key={tick}>
                <Line
                  x1={plotLeft}
                  y1={y}
                  x2={plotLeft + plotW}
                  y2={y}
                  stroke={guideColor}
                  strokeWidth={StyleSheet.hairlineWidth}
                  strokeOpacity={0.7}
                />
                <SvgText
                  x={yAxisW - 3}
                  y={y + 2.5}
                  fill={colors.textMuted}
                  fontSize={axisFont}
                  fontWeight="600"
                  textAnchor="end"
                >
                  {tick}
                </SvgText>
              </G>
            );
          })}

          {linePath ? (
            <Path
              d={linePath}
              fill="none"
              stroke={BRAND_GREEN}
              strokeWidth={STROKE_WIDTH}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}

          {singlePoint && singlePoint.ratePercent != null ? (
            <Line
              x1={Math.max(plotLeft, xOf(singlePoint.day) - shortHalf)}
              y1={yOf(singlePoint.ratePercent)}
              x2={Math.min(plotLeft + plotW, xOf(singlePoint.day) + shortHalf)}
              y2={yOf(singlePoint.ratePercent)}
              stroke={BRAND_GREEN}
              strokeWidth={STROKE_WIDTH}
              strokeLinecap="round"
            />
          ) : null}

          {compressLead ? (
            <SvgText
              x={plotLeft + plotW * 0.045}
              y={plotTop + plotH + 9}
              fill={colors.textMuted}
              fontSize={axisFont}
              fontWeight="600"
              textAnchor="middle"
            >
              ···
            </SvgText>
          ) : null}

          {xLabels.map((day) => (
            <SvgText
              key={`x-${day}`}
              x={xOf(day)}
              y={plotTop + plotH + 9}
              fill={colors.textMuted}
              fontSize={axisFont}
              fontWeight="600"
              textAnchor={
                day === xLabels[0] && !compressLead
                  ? 'start'
                  : day === endDay
                    ? 'end'
                    : 'middle'
              }
            >
              {day}
            </SvgText>
          ))}

          {selected ? (
            <>
              <Line
                x1={selectedX}
                y1={plotTop}
                x2={selectedX}
                y2={plotTop + plotH}
                stroke={BRAND_GREEN}
                strokeWidth={1}
                strokeOpacity={0.28}
              />
              {selected.ratePercent != null ? (
                <Circle cx={selectedX} cy={selectedY} r={3.5} fill={BRAND_GREEN} />
              ) : null}
            </>
          ) : null}
        </Svg>
      </View>
    );
  },
);

const styles = StyleSheet.create({
  empty: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  emptyText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
});
