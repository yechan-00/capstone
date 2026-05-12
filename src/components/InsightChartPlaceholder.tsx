import React from 'react';
import { View, Text, StyleSheet, type DimensionValue } from 'react-native';
import { CategoryInsight, MoodInsight, TimeOfDayInsight } from '@/lib/types';
import { EXPENSE_CATEGORIES, EXPENSE_MOODS } from '@/lib/constants';
import { useTheme } from '@/theme/ThemeContext';

interface InsightChartPlaceholderProps {
  data: CategoryInsight[] | MoodInsight[] | TimeOfDayInsight[];
  type: 'category' | 'mood' | 'timeOfDay';
}

export const InsightChartPlaceholder: React.FC<InsightChartPlaceholderProps> = ({
  data,
  type,
}) => {
  const { colors } = useTheme();
  const getLabel = (value: string) => {
    if (type === 'category') {
      return EXPENSE_CATEGORIES.find((c) => c.value === value)?.label || value;
    }
    if (type === 'mood') {
      return EXPENSE_MOODS.find((m) => m.value === value)?.label || value;
    }
    const timeLabels: Record<string, string> = {
      morning: '아침',
      afternoon: '점심',
      evening: '저녁',
      night: '밤',
    };
    return timeLabels[value] || value;
  };

  if (data.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>데이터가 없습니다</Text>
      </View>
    );
  }

  return (
    <View style={styles.container} accessibilityRole="summary">
      {data.map((item, index) => {
        const label = getLabel(
          'category' in item ? item.category : 'mood' in item ? item.mood : item.timeOfDay
        );
        const regretRate = item.regretRate;
        const barWidth = `${Math.min(100, regretRate)}%`;
        const barColor =
          regretRate >= 50 ? colors.errorText : regretRate >= 20 ? colors.starColor : colors.success;

        return (
          <View key={index} style={styles.item}>
            <View style={styles.labelRow}>
              <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
              <Text style={[styles.rate, { color: colors.textSec }]}>{regretRate.toFixed(1)}%</Text>
            </View>
            <View
              style={[styles.barContainer, { backgroundColor: colors.surfaceMuted }]}
              accessibilityLabel={`${label} 후회율 ${regretRate.toFixed(1)}퍼센트`}
            >
              <View
                style={[
                  styles.bar,
                  { width: barWidth as DimensionValue, backgroundColor: barColor },
                ]}
              />
            </View>
            <Text style={[styles.count, { color: colors.textMuted }]}>
              {item.regretCount}/{item.totalCount}
            </Text>
          </View>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  item: {
    marginBottom: 16,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
  rate: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  barContainer: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 4,
  },
  bar: {
    height: '100%',
    borderRadius: 4,
  },
  count: {
    fontSize: 12,
  },
  empty: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
});
