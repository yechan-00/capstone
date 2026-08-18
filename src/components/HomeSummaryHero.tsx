import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { useTheme } from '@/theme/ThemeContext';

type Props = {
  title: string;
  subtitle: string;
  totalAmount: number;
  budgetKrw: number;
};

const RING_SIZE = 72;
const STROKE = 6;

export function HomeSummaryHero({ title, subtitle, totalAmount, budgetKrw }: Props) {
  const { colors } = useTheme();
  const pct = budgetKrw > 0 ? Math.min(100, Math.round((totalAmount / budgetKrw) * 100)) : 0;
  const radius = (RING_SIZE - STROKE) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - pct / 100);

  const budgetLabel = useMemo(() => {
    if (budgetKrw <= 0) return '예산 미설정';
    return `예산 ${budgetKrw.toLocaleString()}원`;
  }, [budgetKrw]);

  return (
    <View style={[styles.card, { backgroundColor: colors.primary }]}>
      <View style={styles.copyCol}>
        <Text style={styles.kicker}>{title}</Text>
        <Text style={styles.amount}>{totalAmount.toLocaleString()}원</Text>
        <Text style={styles.budget}>{budgetLabel}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      <View style={styles.ringWrap}>
        <Svg width={RING_SIZE} height={RING_SIZE}>
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={radius}
            stroke="rgba(255,255,255,0.28)"
            strokeWidth={STROKE}
            fill="none"
          />
          <Circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={radius}
            stroke="#FFFFFF"
            strokeWidth={STROKE}
            fill="none"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
            rotation={-90}
            origin={`${RING_SIZE / 2}, ${RING_SIZE / 2}`}
          />
        </Svg>
        <View style={styles.ringLabelWrap} pointerEvents="none">
          <Text style={styles.ringLabel}>{budgetKrw > 0 ? `${pct}%` : '—'}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    shadowColor: '#34C36F',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 6,
  },
  copyCol: { flex: 1, minWidth: 0, gap: 4 },
  kicker: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.88)',
  },
  amount: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.8,
  },
  budget: {
    fontSize: 12,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.82)',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 11,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.65)',
  },
  ringWrap: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringLabelWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringLabel: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
  },
});
