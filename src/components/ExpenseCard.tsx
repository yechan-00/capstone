import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Expense } from '@/lib/types';
import { EXPENSE_CATEGORIES } from '@/lib/constants';
import { expenseMoodLabel } from '@/lib/expenseMood';
import { formatDate } from '@/utils/time';
import { useTheme } from '@/theme/ThemeContext';

interface ExpenseCardProps {
  expense: Expense; onPress?: () => void; onDelete?: () => void;
}

export const ExpenseCard: React.FC<ExpenseCardProps> = ({ expense, onPress, onDelete }) => {
  const { colors } = useTheme();
  const categoryLabel = EXPENSE_CATEGORIES.find((c) => c.value === expense.category)?.label || expense.category;
  const moodLabel = expenseMoodLabel(expense.mood, { withEmoji: true });
  const itemLine = (expense.item ?? expense.content ?? '').trim();
  const summary = [expense.summaryEmoji, expense.summaryLine].filter(Boolean).join(' ').trim();

  return (
    <View style={[styles.card, { backgroundColor: colors.surface }]}>
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} disabled={!onPress}>
        {expense.imageUrl ? (
          <Image source={{ uri: expense.imageUrl }} style={[styles.heroImage, { backgroundColor: colors.surfaceMuted }]} resizeMode="cover" />
        ) : null}
        <View style={styles.header}>
          <Text style={[styles.amount, { color: colors.text }]}>{expense.amount.toLocaleString()}원</Text>
        </View>
        {itemLine ? <Text style={[styles.itemLine, { color: colors.text }]} numberOfLines={2}>{itemLine}</Text> : null}
        <Text style={[styles.reason, { color: colors.text }]} numberOfLines={2}>{expense.reason}</Text>
        {summary ? <Text style={[styles.summary, { color: colors.textSec }]} numberOfLines={1}>{summary}</Text> : null}
        <View style={styles.footer}>
          <Text style={[styles.mood, { color: colors.textSec }]}>{moodLabel}</Text>
          <View style={styles.footerRight}>
            <Text style={[styles.category, { color: colors.textSec, backgroundColor: colors.categoryLabelBg }]}>{categoryLabel}</Text>
            <Text style={[styles.date, { color: colors.textMuted }]}>{formatDate(expense.spentAt)}</Text>
          </View>
        </View>
        {expense.tags.length > 0 && (
          <View style={styles.tags}>
            {expense.tags.slice(0, 3).map((tag, idx) => (
              <Text key={idx} style={[styles.tag, { color: colors.textMuted }]}>#{tag}</Text>
            ))}
          </View>
        )}
      </TouchableOpacity>
      {onDelete ? (
        <Pressable
          style={({ pressed }) => [styles.deleteBtn, { backgroundColor: colors.surface, borderColor: '#FECACA' }, pressed && styles.deleteBtnPressed]}
          onPress={onDelete} hitSlop={10} accessibilityLabel="소비 삭제"
        >
          <MaterialIcons name="delete-outline" size={22} color="#B91C1C" />
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  heroImage: { width: '100%', height: 140, borderRadius: 12, marginBottom: 12 },
  card: { position: 'relative', borderRadius: 16, padding: 18, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 10, elevation: 3 },
  deleteBtn: { position: 'absolute', right: 10, top: 10, zIndex: 2, padding: 8, borderRadius: 999, borderWidth: 1 },
  deleteBtnPressed: { opacity: 0.75 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  amount: { fontSize: 22, fontWeight: '900' },
  category: { fontSize: 12, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  itemLine: { fontSize: 15, fontWeight: '800', marginBottom: 6 },
  reason: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  summary: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  footer: { flexDirection: 'row', alignItems: 'flex-end' },
  mood: { fontSize: 14, fontWeight: '600', flex: 1 },
  footerRight: { alignItems: 'flex-end', gap: 4 },
  date: { fontSize: 12, fontWeight: '600' },
  tags: { flexDirection: 'row', marginTop: 10, flexWrap: 'wrap' },
  tag: { fontSize: 12, marginRight: 8 },
});
