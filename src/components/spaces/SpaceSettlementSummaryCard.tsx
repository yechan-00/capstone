import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatSettlementAmount, type SettlementSummary } from '@/lib/spaceSettlement';
import { spaceTypeSoftFill } from '@/lib/spaceTypes';
import { useTheme } from '@/theme/ThemeContext';

type Props = {
  summary: SettlementSummary;
  accent: string;
};

export function SpaceSettlementSummaryCard({ summary, accent }: Props) {
  const { colors, isDark } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[styles.title, { color: colors.text }]}>정산 현황</Text>
      <View style={styles.row}>
        <Stat label="진행 중" value={`${summary.openCount}건`} color={colors.text} />
        <Stat label="완료" value={`${summary.completedCount}건`} color={colors.text} />
        <Stat label="미정산" value={formatSettlementAmount(summary.unpaidTotal)} color={accent} />
      </View>
      <View style={[styles.mine, { backgroundColor: spaceTypeSoftFill(accent, isDark) }]}>
        <Text style={[styles.mineText, { color: colors.text }]}>
          받을 금액 {formatSettlementAmount(summary.myToReceive)}
        </Text>
        <Text style={[styles.mineText, { color: colors.text }]}>
          보낼 금액 {formatSettlementAmount(summary.myToSend)}
        </Text>
      </View>
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        여러 건을 서로 상계하지 않아요. 각 정산의 미정산 금액을 합친 값이에요.
      </Text>
    </View>
  );
}

function Stat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statLabel, { color }]}>{label}</Text>
      <Text style={[styles.statValue, { color }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 14,
    marginBottom: 16,
  },
  title: { fontSize: 15, fontWeight: '800', marginBottom: 12 },
  row: { flexDirection: 'row', gap: 8 },
  stat: { flex: 1 },
  statLabel: { fontSize: 11, fontWeight: '700' },
  statValue: { marginTop: 4, fontSize: 14, fontWeight: '800' },
  mine: {
    marginTop: 12,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 4,
  },
  mineText: { fontSize: 13, fontWeight: '700' },
  hint: { marginTop: 10, fontSize: 11, fontWeight: '600', lineHeight: 16 },
});
