import React from 'react';
import { StyleSheet, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { HOME } from '@/components/home/homeTheme';
import { HomeText } from '@/components/home/HomeText';

const WEEKDAYS = ['월', '화', '수', '목', '금', '토', '일'] as const;
const BAR_HEIGHTS = [42, 38, 45, 50, 88, 92, 48];

const EMOTIONS = [
  { label: '스트레스', value: 0.72 },
  { label: '외로움', value: 0.58 },
  { label: '피곤함', value: 0.34 },
  { label: '행복함', value: 0.18 },
  { label: '평온함', value: 0.09 },
] as const;

export function AnalysisDashboardPanel() {
  return (
    <View style={styles.root}>
      <View style={styles.panel}>
        <View style={styles.panelHeader}>
          <HomeText style={styles.panelTitle}>요일별 지출 패턴</HomeText>
          <View style={styles.chip}>
            <MaterialIcons name="north-east" size={12} color={HOME.neon} />
            <HomeText style={styles.chipText}>금·토 42%↑</HomeText>
          </View>
        </View>
        <View style={styles.barChart}>
          {WEEKDAYS.map((day, i) => {
            const peak = i === 4 || i === 5;
            return (
              <View key={day} style={styles.barCol}>
                <View style={[styles.barTrack, { height: 100 }]}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        height: `${BAR_HEIGHTS[i]}%`,
                        backgroundColor: peak ? HOME.neon : 'rgba(255,255,255,0.12)',
                      },
                    ]}
                  />
                </View>
                <HomeText style={[styles.barLabel, peak && styles.barLabelActive]}>{day}</HomeText>
              </View>
            );
          })}
        </View>
      </View>

      <View style={styles.bottomRow}>
        <View style={[styles.panel, styles.halfPanel]}>
          <HomeText style={styles.panelTitle}>시간대별 지출</HomeText>
          <View style={styles.heatmap}>
            {Array.from({ length: 35 }).map((_, i) => (
              <View
                key={i}
                style={[
                  styles.heatCell,
                  {
                    opacity: 0.12 + ((i * 7) % 10) * 0.07 + (i > 20 ? 0.15 : 0),
                    backgroundColor: HOME.neon,
                  },
                ]}
              />
            ))}
          </View>
          <HomeText style={styles.heatCaption}>오후 9시~12시 피크</HomeText>
        </View>

        <View style={[styles.panel, styles.halfPanel]}>
          <HomeText style={styles.panelTitle}>감정별 상관도</HomeText>
          {EMOTIONS.map((row) => (
            <View key={row.label} style={styles.emotionRow}>
              <HomeText style={styles.emotionLabel}>{row.label}</HomeText>
              <View style={styles.emotionTrack}>
                <View
                  style={[styles.emotionFill, { width: `${row.value * 100}%` }]}
                />
              </View>
              <HomeText style={styles.emotionVal}>{row.value.toFixed(2)}</HomeText>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 14, width: '100%' },
  panel: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(125,255,154,0.12)',
    padding: 18,
    gap: 14,
  },
  panelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  panelTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: HOME.white,
    letterSpacing: -0.2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(125,255,154,0.12)',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  chipText: { fontSize: 11, fontWeight: '800', color: HOME.neon },
  barChart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 6,
    paddingTop: 8,
  },
  barCol: { flex: 1, alignItems: 'center', gap: 8 },
  barTrack: {
    width: '100%',
    maxWidth: 32,
    justifyContent: 'flex-end',
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  barFill: { width: '100%', borderRadius: 8, minHeight: 8 },
  barLabel: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.35)' },
  barLabelActive: { color: HOME.neon },
  bottomRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  halfPanel: { flex: 1, minWidth: 0 },
  heatmap: { flexDirection: 'row', flexWrap: 'wrap', gap: 3 },
  heatCell: { width: 12, height: 12, borderRadius: 2 },
  heatCaption: { fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.45)' },
  emotionRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  emotionLabel: { width: 52, fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.7)' },
  emotionTrack: {
    flex: 1,
    height: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  emotionFill: { height: '100%', borderRadius: 999, backgroundColor: HOME.neon },
  emotionVal: { width: 32, fontSize: 10, fontWeight: '800', color: HOME.neon, textAlign: 'right' },
});
