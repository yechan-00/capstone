import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { chunkSituationTagsIntoRows } from '@/lib/situationTagLayout';
import { EXPENSE_DETAIL_SPACE } from '@/theme/expenseDetailTheme';
import { ExpenseTagChip } from '@/components/expenseDetail/ExpenseTagChip';

type Props = {
  labels: string[];
};

export function SituationTagGrid({ labels }: Props) {
  const rows = useMemo(() => chunkSituationTagsIntoRows(labels), [labels]);

  return (
    <View style={styles.grid}>
      {rows.map((row, rowIndex) => {
        const equalWidth = row.length > 1;
        return (
          <View
            key={`row-${rowIndex}-${row.join('-')}`}
            style={[styles.row, !equalWidth && styles.rowSingle]}
          >
            {row.map((label) => (
              <ExpenseTagChip key={label} label={label} fill={equalWidth} />
            ))}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: EXPENSE_DETAIL_SPACE.chipGap },
  row: {
    flexDirection: 'row',
    gap: EXPENSE_DETAIL_SPACE.chipGap,
    width: '100%',
  },
  rowSingle: {
    alignSelf: 'flex-start',
    width: undefined,
  },
});
