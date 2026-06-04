import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { AnimatedBarFill } from '@/components/AnimatedBarFill';
import { moodRegretSummary, regretBarColor } from '@/lib/moodInsightDetail';
import { useTheme } from '@/theme/ThemeContext';

type Props = {
  periodLabel: string;
  regretRate: number;
  regretCount: number;
  recordCount: number;
  totalSpendKrw: number;
  headline: string | null;
};

export function MoodInsightHeroCard({
  periodLabel,
  regretRate,
  regretCount,
  recordCount,
  totalSpendKrw,
  headline,
}: Props) {
  const { colors, isDark } = useTheme();
  const [replay, setReplay] = useState(0);
  const barColor = regretBarColor(regretRate, colors);
  const barPct = Math.min(100, Math.max(0, regretRate));
  const summary = moodRegretSummary(regretRate, recordCount, regretCount);

  const heroBg = isDark ? '#152033' : '#1B2838';
  const heroBorder = isDark ? '#243049' : '#243049';
  const heroMuted = isDark ? '#94a3b8' : '#9CA3AF';
  const heroText = '#F8FAFC';

  return (
    <Pressable
      onPress={() => setReplay((r) => r + 1)}
      style={[styles.wrap, { backgroundColor: heroBg, borderColor: heroBorder }]}
      accessibilityRole="button"
      accessibilityLabel="탭하면 그래프 애니메이션 다시 보기"
    >
      <View style={styles.top}>
        <View style={styles.topMain}>
          <Text style={[styles.title, { color: heroText }]} numberOfLines={1}>
            전체 후회율
          </Text>
          <Text style={[styles.sub, { color: heroMuted }]} numberOfLines={1}>
            {periodLabel}
          </Text>
        </View>
      </View>

      <View style={styles.mainRow}>
        <Text style={[styles.pct, { color: barColor }]}>{regretRate.toFixed(0)}%</Text>
        <Text style={[styles.pctLabel, { color: heroMuted }]}>후회율</Text>
      </View>

      <View style={[styles.barTrack, { backgroundColor: isDark ? '#0f172a' : '#111827' }]}>
        <AnimatedBarFill pct={barPct} duration={750} replay={replay} style={[styles.barFill, { backgroundColor: barColor }]} />
      </View>

      {headline ? (
        <Text style={[styles.insight, { color: heroText }]} numberOfLines={1} ellipsizeMode="tail">
          {headline}
        </Text>
      ) : (
        <Text style={[styles.insight, { color: heroMuted }]} numberOfLines={1}>
          {summary}
        </Text>
      )}

      <View style={[styles.footer, { borderTopColor: isDark ? '#243049' : '#374151' }]}>
        <View style={styles.footerItem}>
          <MaterialIcons name="sentiment-dissatisfied" size={14} color={heroMuted} />
          <Text style={[styles.footerText, { color: heroMuted }]} numberOfLines={1}>
            후회 {regretCount}건
          </Text>
        </View>
        <View style={[styles.footerDivider, { backgroundColor: isDark ? '#243049' : '#374151' }]} />
        <View style={styles.footerItem}>
          <MaterialIcons name="receipt-long" size={14} color={heroMuted} />
          <Text style={[styles.footerText, { color: heroMuted }]} numberOfLines={1}>
            기록 {recordCount}건
          </Text>
        </View>
        <View style={[styles.footerDivider, { backgroundColor: isDark ? '#243049' : '#374151' }]} />
        <View style={styles.footerItem}>
          <MaterialIcons name="payments" size={14} color={heroMuted} />
          <Text style={[styles.footerText, { color: heroMuted }]} numberOfLines={1}>
            {totalSpendKrw.toLocaleString()}원
          </Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 8,
  },
  top: { flexDirection: 'row', alignItems: 'flex-start' },
  topMain: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 14, fontWeight: '900' },
  sub: { fontSize: 11, fontWeight: '700' },
  mainRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  pct: { fontSize: 34, fontWeight: '900', letterSpacing: -1 },
  pctLabel: { fontSize: 12, fontWeight: '800', marginBottom: 6 },
  barTrack: { height: 6, borderRadius: 999, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999 },
  insight: { fontSize: 12, fontWeight: '700' },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 8,
    marginTop: 2,
  },
  footerItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 0,
  },
  footerDivider: { width: StyleSheet.hairlineWidth, height: 14 },
  footerText: { fontSize: 10, fontWeight: '700', flexShrink: 1 },
});
