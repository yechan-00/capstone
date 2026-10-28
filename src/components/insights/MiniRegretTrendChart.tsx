import React, { useId, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Stop } from 'react-native-svg';
import { INSIGHTS_THEME } from '@/theme/insightsTheme';

type Props = {
  rates: Array<number | null> | null;
  width?: number;
  height?: number;
  /** 데이터 부족 시 muted decorative line (인사이트 기본) */
  showEmptyPlaceholder?: boolean;
  emptyMessage?: string;
  emptyMessageColor?: string;
  strokeColor?: string;
  /** percent: 0~100 고정. fit: 데이터 max 기준 (인사이트 기본) */
  yScale?: 'percent' | 'fit';
  fillTopOpacity?: number;
};

const DEFAULT_W = 160;
const DEFAULT_H = 52;
const STROKE_WIDTH = 2.2;

type ChartGeom =
  | { kind: 'line'; line: string; area: string }
  | { kind: 'point'; x: number; y: number; guideFrom: number; guideTo: number };

function clampRate(rate: number): number {
  return Math.max(0, Math.min(100, rate));
}

function buildGeom(
  rates: Array<number | null>,
  width: number,
  height: number,
  yScale: 'percent' | 'fit',
): ChartGeom | null {
  const defined = rates.filter((rate): rate is number => rate != null && Number.isFinite(rate));
  if (defined.length === 0) return null;

  const padX = Math.max(6, Math.min(10, width * 0.03));
  const padY = Math.max(8, height * 0.12);
  const innerW = Math.max(1, width - padX * 2);
  const innerH = Math.max(1, height - padY * 2);
  const max =
    yScale === 'percent' ? 100 : Math.max(...defined.map(clampRate), 1);
  const yOf = (rate: number) => padY + innerH - (clampRate(rate) / max) * innerH;
  const n = defined.length;
  const xOf = (index: number) =>
    n <= 1 ? padX + innerW / 2 : padX + (index / (n - 1)) * innerW;
  const baseline = height - padY;

  if (n === 1) {
    const x = xOf(0);
    const y = yOf(defined[0]!);
    const guideHalf = Math.min(innerW * 0.18, 22);
    return {
      kind: 'point',
      x,
      y,
      guideFrom: Math.max(padX, x - guideHalf),
      guideTo: Math.min(padX + innerW, x + guideHalf),
    };
  }

  const pts = defined.map((rate, index) => ({ x: xOf(index), y: yOf(rate) }));
  const line = pts
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(' ');
  const area = `${line} L ${pts[pts.length - 1]!.x.toFixed(1)} ${baseline.toFixed(1)} L ${pts[0]!.x.toFixed(1)} ${baseline.toFixed(1)} Z`;
  return { kind: 'line', line, area };
}

export function MiniRegretTrendChart({
  rates,
  width = DEFAULT_W,
  height = DEFAULT_H,
  showEmptyPlaceholder = false,
  emptyMessage,
  emptyMessageColor,
  strokeColor = INSIGHTS_THEME.primary,
  yScale = 'fit',
  fillTopOpacity = 0.14,
}: Props) {
  const reactId = useId();
  const gradientId = `regretTrendFill-${reactId.replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const geom = useMemo(
    () => (rates && rates.length > 0 ? buildGeom(rates, width, height, yScale) : null),
    [rates, width, height, yScale],
  );

  if (width <= 0 || height <= 0) return null;

  if (!geom) {
    if (emptyMessage) {
      return (
        <View style={[styles.empty, { width, height }]}>
          <Text
            style={[styles.emptyText, emptyMessageColor ? { color: emptyMessageColor } : null]}
            numberOfLines={2}
          >
            {emptyMessage}
          </Text>
        </View>
      );
    }
    if (!showEmptyPlaceholder) return null;
    return (
      <View style={[styles.placeholder, { width, height }]}>
        <View style={styles.decorLine} />
      </View>
    );
  }

  return (
    <View style={{ width, height }} pointerEvents="none">
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        {geom.kind === 'line' ? (
          <>
            <Defs>
              <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={strokeColor} stopOpacity={fillTopOpacity} />
                <Stop offset="1" stopColor={strokeColor} stopOpacity={0} />
              </LinearGradient>
            </Defs>
            <Path d={geom.area} fill={`url(#${gradientId})`} />
            <Path
              d={geom.line}
              fill="none"
              stroke={strokeColor}
              strokeWidth={STROKE_WIDTH}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        ) : (
          <>
            <Line
              x1={geom.guideFrom}
              y1={geom.y}
              x2={geom.guideTo}
              y2={geom.y}
              stroke={strokeColor}
              strokeWidth={1}
              strokeOpacity={0.28}
              strokeLinecap="round"
            />
            <Circle cx={geom.x} cy={geom.y} r={3.5} fill={strokeColor} />
          </>
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    justifyContent: 'center',
    alignItems: 'stretch',
    opacity: 0.45,
  },
  decorLine: {
    height: 2,
    borderRadius: 1,
    backgroundColor: INSIGHTS_THEME.primary,
    opacity: 0.35,
    marginHorizontal: 4,
  },
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
    color: INSIGHTS_THEME.textMuted,
  },
});
