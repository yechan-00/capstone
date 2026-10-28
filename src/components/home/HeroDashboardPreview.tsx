import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { MaterialIcons } from '@expo/vector-icons';
import { BrandAppIcon } from '@/components/BrandAppIcon';
import { HOME } from '@/components/home/homeTheme';
import { HomeText } from '@/components/home/HomeText';
import { WEB_NO_TRANSLATE } from '@/components/home/homeWeb';

const DONUT = [
  { color: '#34785F', pct: 36 },
  { color: '#42A5F5', pct: 14 },
  { color: '#FFA726', pct: 22 },
  { color: '#EF5350', pct: 18 },
  { color: '#BDBDBD', pct: 10 },
] as const;

const CATEGORIES = [
  { label: '식비', amount: '450,000', pct: '36%', color: '#34785F' },
  { label: '교통', amount: '180,000', pct: '14%', color: '#42A5F5' },
  { label: '쇼핑', amount: '280,000', pct: '22%', color: '#FFA726' },
  { label: '문화/여가', amount: '220,000', pct: '18%', color: '#EF5350' },
  { label: '기타', amount: '120,000', pct: '10%', color: '#BDBDBD' },
] as const;

function ProgressRing({ size, progress }: { size: number; progress: number }) {
  const stroke = 5;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * progress;

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E8ECE8"
          strokeWidth={stroke}
          fill="none"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={HOME.green}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${dash} ${circumference}`}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Text style={styles.ringPct}>{Math.round(progress * 100)}%</Text>
    </View>
  );
}

function DonutChart({ size }: { size: number }) {
  const stroke = 14;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <Svg width={size} height={size}>
      {DONUT.map((seg) => {
        const dash = (seg.pct / 100) * circumference;
        const circle = (
          <Circle
            key={seg.color}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={seg.color}
            strokeWidth={stroke}
            fill="none"
            strokeDasharray={`${dash} ${circumference}`}
            strokeLinecap="butt"
            transform={`rotate(${-90 + (offset / circumference) * 360} ${size / 2} ${size / 2})`}
          />
        );
        offset += dash;
        return circle;
      })}
    </Svg>
  );
}

/** 히어로 폰 목업 — 대시보드 UI */
export function HeroDashboardPreview() {
  return (
    <View style={styles.root} {...WEB_NO_TRANSLATE}>
      <View style={styles.appTop}>
        <View style={styles.appBrand}>
          <BrandAppIcon size={18} />
          <HomeText style={styles.appTitle}>후회가계부</HomeText>
        </View>
        <MaterialIcons name="notifications-none" size={18} color={HOME.dark} />
      </View>

      <View style={styles.scroll}>
        <View style={styles.monthCard}>
          <HomeText style={styles.monthLabel}>이번 달 현황</HomeText>
          <View style={styles.monthRow}>
            <View style={{ flex: 1 }}>
              <HomeText style={styles.monthCaption}>총 지출</HomeText>
              <HomeText style={styles.monthAmount}>1,250,000원</HomeText>
              <HomeText style={styles.monthBudget}>예산 1,800,000원</HomeText>
            </View>
            <ProgressRing size={54} progress={0.69} />
          </View>
        </View>

        <View style={styles.tipCard}>
          <View style={styles.tipIcon}>
            <MaterialIcons name="lightbulb-outline" size={14} color="#F9A825" />
          </View>
          <HomeText style={styles.tipText}>
            시간대별로 커피를 자주 구매하고 있어요.{'\n'}
            <HomeText style={styles.tipHighlight}>62,000원</HomeText> 절약해보세요!
          </HomeText>
        </View>

        <View style={styles.analysisCard}>
          <HomeText style={styles.analysisTitle}>소비 분석</HomeText>
          <View style={styles.analysisRow}>
            <DonutChart size={72} />
            <View style={styles.legend}>
              {CATEGORIES.map((item) => (
                <View key={item.label} style={styles.legendRow}>
                  <View style={[styles.legendDot, { backgroundColor: item.color }]} />
                  <HomeText style={styles.legendLabel}>{item.label}</HomeText>
                  <HomeText style={styles.legendAmount}>{item.amount}</HomeText>
                  <HomeText style={styles.legendPct}>{item.pct}</HomeText>
                </View>
              ))}
            </View>
          </View>
        </View>

        <HomeText style={styles.habitTitle}>후회 없는 소비 습관</HomeText>
        <View style={styles.habitRow}>
          <View style={[styles.habitCard, styles.habitRegret]}>
            <Text style={styles.habitEmoji}>😟</Text>
            <HomeText style={styles.habitCardLabel}>이번 달 후회 소비</HomeText>
            <HomeText style={styles.habitRegretAmount}>87,000원</HomeText>
          </View>
          <View style={[styles.habitCard, styles.habitSave]}>
            <Text style={styles.habitEmoji}>😊</Text>
            <HomeText style={styles.habitCardLabel}>절약한 금액</HomeText>
            <HomeText style={styles.habitSaveAmount}>124,000원</HomeText>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#F7F9F7',
  },
  appTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 36,
    paddingBottom: 8,
    backgroundColor: HOME.white,
  },
  appBrand: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  appTitle: { fontSize: 13, fontWeight: '800', color: HOME.dark },
  scroll: { padding: 10, gap: 8 },
  monthCard: {
    backgroundColor: HOME.white,
    borderRadius: 14,
    padding: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  monthLabel: { fontSize: 11, fontWeight: '700', color: HOME.textMuted },
  monthRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  monthCaption: { fontSize: 10, fontWeight: '600', color: HOME.textMuted },
  monthAmount: { fontSize: 18, fontWeight: '800', color: HOME.dark, letterSpacing: -0.5 },
  monthBudget: { fontSize: 9, fontWeight: '600', color: HOME.textMuted, marginTop: 2 },
  ringPct: {
    position: 'absolute',
    fontSize: 11,
    fontWeight: '800',
    color: HOME.green,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    backgroundColor: '#FFF9E6',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FFE082',
  },
  tipIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFF3C4',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipText: { flex: 1, fontSize: 9, lineHeight: 14, fontWeight: '600', color: '#5D4037' },
  tipHighlight: { fontWeight: '800', color: HOME.green },
  analysisCard: {
    backgroundColor: HOME.white,
    borderRadius: 14,
    padding: 10,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  analysisTitle: { fontSize: 11, fontWeight: '800', color: HOME.dark },
  analysisRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  legend: { flex: 1, gap: 3 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendLabel: { fontSize: 8, fontWeight: '700', color: HOME.dark, width: 36 },
  legendAmount: { flex: 1, fontSize: 8, fontWeight: '600', color: HOME.textSec, textAlign: 'right' },
  legendPct: { fontSize: 8, fontWeight: '700', color: HOME.textMuted, width: 24, textAlign: 'right' },
  habitTitle: { fontSize: 10, fontWeight: '800', color: HOME.dark, marginTop: 2 },
  habitRow: { flexDirection: 'row', gap: 8 },
  habitCard: {
    flex: 1,
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
    gap: 4,
  },
  habitRegret: { backgroundColor: '#FFF3E0' },
  habitSave: { backgroundColor: '#E8F8EE' },
  habitEmoji: { fontSize: 16 },
  habitCardLabel: { fontSize: 8, fontWeight: '600', color: HOME.textSec, textAlign: 'center' },
  habitRegretAmount: { fontSize: 11, fontWeight: '800', color: '#E65100' },
  habitSaveAmount: { fontSize: 11, fontWeight: '800', color: HOME.green },
});
