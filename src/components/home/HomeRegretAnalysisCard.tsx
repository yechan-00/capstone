import React, { useRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import {
  HomeRegretDailyChart,
  type HomeRegretDailyChartHandle,
} from '@/components/home/HomeRegretDailyChart';
import { HomeRegretRateHelpSheet } from '@/components/home/HomeRegretRateHelpSheet';
import { formatRegretRateLabel, type DailyRegretPoint } from '@/lib/regretDailyCumulative';
import { useTheme } from '@/theme/ThemeContext';

type Props = {
  rate: number | null;
  deltaPp: number | null;
  dailyPoints: DailyRegretPoint[];
  regretCount: number;
  reviewCount: number;
};

function formatDelta(deltaPp: number): string {
  const value = Math.abs(deltaPp);
  const amount = value % 1 === 0 ? value.toFixed(0) : value.toFixed(1);
  if (deltaPp < 0) return `지난달보다 ${amount}%p 개선됐어요`;
  if (deltaPp > 0) return `지난달보다 ${amount}%p 높아졌어요`;
  return '지난달과 같은 수준이에요';
}

function statusCopy(rate: number | null, improved: boolean, worsened: boolean): string {
  if (rate === null) return '아직 평가 기록 없음';
  if (rate === 0) return '후회한 기록 없음';
  if (improved) return '지난달보다 후회 감소';
  if (worsened) return '지난달보다 후회 증가';
  return '이번 달 소비 후회율';
}

export function HomeRegretAnalysisCard({
  rate,
  deltaPp,
  dailyPoints,
  regretCount,
  reviewCount,
}: Props) {
  const { colors, isDark } = useTheme();
  const windowWidth = useWindowDimensions().width;
  const compact = windowWidth < 360;
  const chartHeight = compact ? 80 : 92;
  const [chartWidth, setChartWidth] = React.useState(0);
  const [helpOpen, setHelpOpen] = React.useState(false);
  const [selectedPoint, setSelectedPoint] = React.useState<DailyRegretPoint | null>(null);
  const chartRef = useRef<HomeRegretDailyChartHandle>(null);

  const improved = deltaPp !== null && deltaPp < 0;
  const worsened = deltaPp !== null && deltaPp > 0;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          shadowOpacity: isDark ? 0 : 0.04,
        },
      ]}
    >
      <View style={styles.labelRow}>
        <Text style={[styles.label, { color: colors.text }]}>이번 달 후회율</Text>
        <Pressable
          onPress={() => setHelpOpen(true)}
          hitSlop={8}
          style={styles.infoBtn}
          accessibilityRole="button"
          accessibilityLabel="후회율 계산 방법 보기"
        >
          <MaterialIcons name="info-outline" size={16} color={colors.textMuted} />
        </Pressable>
      </View>

      <View style={styles.metricRow}>
        <Pressable
          style={styles.copy}
          onPress={() => {
            chartRef.current?.clearSelection();
            setSelectedPoint(null);
          }}
          accessibilityRole="button"
        >
          <Text
            style={[styles.rate, { color: rate === null ? colors.textMuted : colors.text }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.7}
          >
            {formatRegretRateLabel(rate)}
          </Text>
          <Text style={[styles.headline, { color: colors.text }]} numberOfLines={2}>
            {statusCopy(rate, improved, worsened)}
          </Text>
          {deltaPp !== null ? (
            <Text style={[styles.comparison, { color: colors.textMuted }]} numberOfLines={2}>
              {formatDelta(deltaPp)}
            </Text>
          ) : null}
        </Pressable>

        <View
          style={styles.trendCol}
          onLayout={(event) => {
            const next = Math.round(event.nativeEvent.layout.width);
            if (next > 0 && next !== chartWidth) setChartWidth(next);
          }}
        >
          <View style={[styles.chartSlot, { height: chartHeight }]}>
            {chartWidth > 0 ? (
              <HomeRegretDailyChart
                ref={chartRef}
                points={dailyPoints}
                width={chartWidth}
                height={chartHeight}
                compact
                onSelectPoint={setSelectedPoint}
              />
            ) : null}
          </View>
          <Text style={[styles.trendCaption, { color: colors.textMuted }]} numberOfLines={1}>
            {selectedPoint
              ? selectedPoint.ratePercent == null
                ? '데이터 없음'
                : `${selectedPoint.day}일 · ${formatRegretRateLabel(selectedPoint.ratePercent)}`
              : '후회율 변화'}
          </Text>
        </View>
      </View>

      <View style={[styles.footer, { borderTopColor: colors.border }]}>
        <Text style={[styles.footerText, { color: colors.text }]}>후회 {regretCount}건</Text>
        <View style={[styles.footerDot, { backgroundColor: colors.border }]} />
        <Text style={[styles.footerText, { color: colors.text }]}>리뷰 {reviewCount}건</Text>
      </View>

      <HomeRegretRateHelpSheet visible={helpOpen} onClose={() => setHelpOpen(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 10,
    shadowColor: '#123C2B',
    shadowOffset: { width: 0, height: 8 },
    shadowRadius: 20,
    elevation: 4,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
    marginBottom: 2,
  },
  label: { fontSize: 13, fontWeight: '800', letterSpacing: -0.2 },
  infoBtn: {
    width: 44,
    height: 44,
    marginVertical: -14,
    marginRight: -10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  copy: {
    flexGrow: 0,
    flexShrink: 1,
    flexBasis: '36%',
    minWidth: 0,
    paddingRight: 4,
  },
  rate: {
    fontSize: 38,
    lineHeight: 43,
    fontWeight: '800',
    letterSpacing: -1.4,
    ...Platform.select({ ios: { fontVariant: ['tabular-nums' as const] }, default: {} }),
  },
  headline: { marginTop: 2, fontSize: 13, lineHeight: 18, fontWeight: '700' },
  comparison: { marginTop: 4, fontSize: 10, lineHeight: 13, fontWeight: '600' },
  trendCol: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: '64%',
    minWidth: 0,
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  chartSlot: {
    width: '100%',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  trendCaption: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 5,
  },
  footer: {
    marginTop: 6,
    paddingTop: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 7,
  },
  footerText: { fontSize: 12, fontWeight: '700' },
  footerDot: { width: 3, height: 3, borderRadius: 2 },
});
