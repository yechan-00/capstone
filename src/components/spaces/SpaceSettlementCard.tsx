import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatSpaceDayHeading } from '@/lib/spaceEvent';
import {
  formatSettlementAmount,
  settlementOverallLabel,
  type SpaceSettlement,
} from '@/lib/spaceSettlement';
import { useTheme } from '@/theme/ThemeContext';

type Props = {
  settlement: SpaceSettlement;
  accent: string;
  onPress: () => void;
};

export function SpaceSettlementCard({ settlement, accent, onPress }: Props) {
  const { colors } = useTheme();
  const label = settlementOverallLabel(settlement.status, settlement.transfers);
  const unpaid = settlement.status === 'cancelled' ? 0 : settlement.pendingAmount;
  const totalTransfers = settlement.transfers.length;
  const done = settlement.completedTransferCount;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${settlement.titleSnapshot}, ${formatSettlementAmount(settlement.amountSnapshot)}, ${label}`}
    >
      <View style={styles.top}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {settlement.titleSnapshot}
        </Text>
        <Text style={[styles.amount, { color: accent }]}>
          {formatSettlementAmount(settlement.amountSnapshot)}
        </Text>
      </View>
      <Text style={[styles.meta, { color: colors.textSec }]}>
        {formatSpaceDayHeading(settlement.dateKeySnapshot)} · {label}
      </Text>
      <Text style={[styles.meta, { color: colors.textSec }]}>
        {totalTransfers === 0
          ? '송금할 금액 없음'
          : `완료 ${done}/${totalTransfers} · 미정산 ${formatSettlementAmount(unpaid)}`}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
  },
  amount: {
    fontSize: 15,
    fontWeight: '800',
  },
  meta: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
  },
});
