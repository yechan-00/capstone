import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { expenseTagStyle } from '@/lib/expenseTagStyles';

type Props = {
  label: string;
  /** 2개 이상 태그가 한 row일 때 균등 너비 */
  fill?: boolean;
};

export function ExpenseTagChip({ label, fill = false }: Props) {
  const style = expenseTagStyle(label);
  return (
    <View
      style={[
        styles.chip,
        fill && styles.chipFill,
        { backgroundColor: style.bg },
      ]}
    >
      <Text style={[styles.text, { color: style.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: {
    height: 34,
    paddingHorizontal: 14,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-start',
  },
  chipFill: {
    flex: 1,
    alignSelf: 'stretch',
    minWidth: 0,
  },
  text: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
});
