import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeContext';

export type DonutSlice = { key: string; color: string; pct: number };

const VB = 100;
const CX = 50;
const CY = 50;
const R_OUT = 38;
const R_IN = 24;

function polar(cx: number, cy: number, r: number, rad: number) {
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

/** 도넛 링의 한 조각 (라디안 a0 → a1, 시계 반대) */
function ringSegment(cx: number, cy: number, r0: number, r1: number, a0: number, a1: number): string {
  if (a1 - a0 <= 0.0001) return '';
  const p0 = polar(cx, cy, r1, a0);
  const p1 = polar(cx, cy, r1, a1);
  const p2 = polar(cx, cy, r0, a1);
  const p3 = polar(cx, cy, r0, a0);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return [
    `M ${p0.x} ${p0.y}`,
    `A ${r1} ${r1} 0 ${large} 1 ${p1.x} ${p1.y}`,
    `L ${p2.x} ${p2.y}`,
    `A ${r0} ${r0} 0 ${large} 0 ${p3.x} ${p3.y}`,
    'Z',
  ].join(' ');
}

/** 100% 한 덩어리일 때 전체 링 (반원 두 번) */
function fullRing(cx: number, cy: number, r0: number, r1: number, aStart: number): string {
  const mid = aStart + Math.PI;
  const end = aStart + 2 * Math.PI;
  const o0 = polar(cx, cy, r1, aStart);
  const o1 = polar(cx, cy, r1, mid);
  const o2 = polar(cx, cy, r1, end);
  const i0 = polar(cx, cy, r0, aStart);
  const i1 = polar(cx, cy, r0, mid);
  const i2 = polar(cx, cy, r0, end);
  return [
    `M ${o0.x} ${o0.y}`,
    `A ${r1} ${r1} 0 1 1 ${o1.x} ${o1.y}`,
    `A ${r1} ${r1} 0 1 1 ${o2.x} ${o2.y}`,
    `L ${i2.x} ${i2.y}`,
    `A ${r0} ${r0} 0 1 0 ${i1.x} ${i1.y}`,
    `A ${r0} ${r0} 0 1 0 ${i0.x} ${i0.y}`,
    'Z',
  ].join(' ');
}

type Props = {
  slices: DonutSlice[];
  /** 가운데 짧은 라벨 (예: "3건") */
  centerLabel?: string;
  size?: number;
};

export function CategoryDonutChart({ slices, centerLabel, size = 176 }: Props) {
  const { colors } = useTheme();

  const paths = useMemo(() => {
    const valid = slices.filter((s) => s.pct > 0);
    if (valid.length === 0) return [];

    const norm = valid.reduce((s, x) => s + x.pct, 0) || 1;
    const unit = (2 * Math.PI) / norm;
    let angle = -Math.PI / 2;
    const out: { key: string; d: string; color: string }[] = [];

    if (valid.length === 1) {
      const s = valid[0];
      out.push({
        key: s.key,
        color: s.color,
        d: fullRing(CX, CY, R_IN, R_OUT, -Math.PI / 2),
      });
      return out;
    }

    for (const s of valid) {
      const sweep = (s.pct / norm) * 2 * Math.PI;
      const a0 = angle;
      const a1 = angle + sweep;
      const d = ringSegment(CX, CY, R_IN, R_OUT, a0, a1);
      if (d) out.push({ key: s.key, color: s.color, d });
      angle = a1;
    }
    return out;
  }, [slices]);

  if (paths.length === 0) {
    return (
      <View style={[styles.wrap, { width: size, height: size }]}>
        <Svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`}>
          <Path
            d={fullRing(CX, CY, R_IN, R_OUT, -Math.PI / 2)}
            fill={colors.surfaceMuted}
          />
        </Svg>
      </View>
    );
  }

  return (
    <View style={[styles.wrap, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox={`0 0 ${VB} ${VB}`}>
        {paths.map((p) => (
          <Path key={p.key} d={p.d} fill={p.color} stroke="none" />
        ))}
      </Svg>
      {centerLabel ? (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
          <View style={styles.centerBox}>
            <Text style={[styles.centerText, { color: colors.textSec }]} numberOfLines={1}>
              {centerLabel}
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center', position: 'relative' },
  centerBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
  },
  centerText: { fontSize: 12, fontWeight: '800' },
});
