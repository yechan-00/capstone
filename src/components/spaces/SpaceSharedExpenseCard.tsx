import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { expenseCategoryLabel } from '@/lib/expenseCategoryLabel';
import { formatSpaceDayHeading } from '@/lib/spaceEvent';
import {
  formatSharedExpenseAmount,
  resolveSpaceSharedExpenseMember,
  type SpaceSharedExpense,
} from '@/lib/spaceSharedExpense';
import type { SpaceMember } from '@/lib/spaceMembersClient';
import { useTheme } from '@/theme/ThemeContext';

type Props = {
  expense: SpaceSharedExpense;
  members: SpaceMember[];
  accent: string;
  onPress: () => void;
};

export function SpaceSharedExpenseCard({ expense, members, accent, onPress }: Props) {
  const { colors } = useTheme();
  const paidBy = resolveSpaceSharedExpenseMember(expense.paidByUid, members);
  const category = expenseCategoryLabel(expense.category);

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border, opacity: pressed ? 0.9 : 1 },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${expense.title}, ${formatSharedExpenseAmount(expense.amount)}`}
    >
      <View style={styles.top}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
          {expense.title}
        </Text>
        <Text style={[styles.amount, { color: accent }]}>{formatSharedExpenseAmount(expense.amount)}</Text>
      </View>
      <Text style={[styles.meta, { color: colors.textSec }]}>
        {formatSpaceDayHeading(expense.dateKey)} · {category}
      </Text>
      <View style={styles.payer}>
        <ProfileAvatar uri={paidBy.photoURL} name={paidBy.displayName} size={22} accent={accent} />
        <Text style={[styles.payerText, { color: colors.textSec }]} numberOfLines={1}>
          {paidBy.displayName} · {expense.participantUids.length}명
        </Text>
      </View>
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
  payer: {
    marginTop: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  payerText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '600',
  },
});
