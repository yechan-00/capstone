import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import {
  buildSpaceCalendarGrid,
  formatSpaceMonth,
  localDateFromDateKey,
  type SpaceCalendarCell,
} from '@/lib/spaceEvent';
import { useTheme } from '@/theme/ThemeContext';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'] as const;

type Props = {
  month: Date;
  selectedDateKey: string;
  todayKey: string;
  eventDateKeys: Set<string>;
  memoryDateKeys: Set<string>;
  expenseDateKeys?: Set<string>;
  accent: string;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  onSelectDate: (cell: SpaceCalendarCell) => void;
};

export function SpaceEventCalendar({
  month,
  selectedDateKey,
  todayKey,
  eventDateKeys,
  memoryDateKeys,
  expenseDateKeys,
  accent,
  onPrevMonth,
  onNextMonth,
  onToday,
  onSelectDate,
}: Props) {
  const { colors } = useTheme();
  const cells = React.useMemo(() => buildSpaceCalendarGrid(month), [month]);

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.monthHeader}>
        <Pressable onPress={onPrevMonth} hitSlop={8} accessibilityRole="button" accessibilityLabel="이전 달">
          <MaterialIcons name="chevron-left" size={28} color={colors.text} />
        </Pressable>
        <Text style={[styles.monthTitle, { color: colors.text }]}>{formatSpaceMonth(month)}</Text>
        <View style={styles.monthHeaderRight}>
          <Pressable
            style={[styles.todayBtn, { borderColor: colors.border, backgroundColor: colors.surface }]}
            onPress={onToday}
            accessibilityRole="button"
            accessibilityLabel="오늘로 이동"
          >
            <Text style={[styles.todayBtnText, { color: colors.textSec }]}>오늘</Text>
          </Pressable>
          <Pressable onPress={onNextMonth} hitSlop={8} accessibilityRole="button" accessibilityLabel="다음 달">
            <MaterialIcons name="chevron-right" size={28} color={colors.text} />
          </Pressable>
        </View>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((label, index) => (
          <Text
            key={label}
            style={[
              styles.weekText,
              { color: index === 0 ? '#C47A7A' : index === 6 ? '#7A8A94' : colors.textSec },
            ]}
          >
            {label}
          </Text>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((cell) => {
          const selected = cell.dateKey === selectedDateKey;
          const today = cell.dateKey === todayKey;
          const hasEvents = eventDateKeys.has(cell.dateKey);
          const hasMemories = memoryDateKeys.has(cell.dateKey);
          const hasExpenses = expenseDateKeys?.has(cell.dateKey) ?? false;
          const dow = localDateFromDateKey(cell.dateKey)?.getDay() ?? 0;
          const weekdayColor =
            !cell.inMonth
              ? colors.textMuted
              : dow === 0
                ? '#C47A7A'
                : dow === 6
                  ? '#7A8A94'
                  : colors.text;

          return (
            <Pressable
              key={cell.dateKey}
              onPress={() => onSelectDate(cell)}
              style={styles.dayCell}
              accessibilityRole="button"
              accessibilityLabel={`${cell.dateKey}${hasEvents ? ', 일정 있음' : ''}${hasMemories ? ', 기록 있음' : ''}${hasExpenses ? ', 공동 소비 있음' : ''}`}
            >
              <View
                style={[
                  styles.dayInner,
                  today && !selected ? { borderColor: accent, borderWidth: 1.5 } : null,
                  selected ? { backgroundColor: accent } : null,
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    { color: selected ? colors.onPrimary : weekdayColor },
                    !cell.inMonth && !selected ? { opacity: 0.45 } : null,
                  ]}
                >
                  {cell.day}
                </Text>
              </View>
              <View style={styles.dotSlot}>
                {hasEvents ? <View style={[styles.dot, { backgroundColor: accent }]} /> : null}
                {hasMemories ? (
                  <View style={[styles.memoryMark, { borderColor: accent }]}>
                    <View style={[styles.memoryMarkInner, { backgroundColor: accent }]} />
                  </View>
                ) : null}
                {hasExpenses ? <View style={[styles.expenseMark, { backgroundColor: accent }]} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.dot, { backgroundColor: accent }]} />
          <Text style={[styles.legendText, { color: colors.textMuted }]}>일정</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.memoryMark, { borderColor: accent }]}>
            <View style={[styles.memoryMarkInner, { backgroundColor: accent }]} />
          </View>
          <Text style={[styles.legendText, { color: colors.textMuted }]}>기록</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.expenseMark, { backgroundColor: accent }]} />
          <Text style={[styles.legendText, { color: colors.textMuted }]}>소비</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 20,
    padding: 12,
    paddingBottom: 8,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  monthHeaderRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  todayBtn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  todayBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },
  monthTitle: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: 4,
  },
  weekText: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '800',
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.285%',
    alignItems: 'center',
    paddingHorizontal: 2,
    paddingVertical: 3,
  },
  dayInner: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayText: {
    fontSize: 14,
    fontWeight: '700',
  },
  dotSlot: {
    minHeight: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
  },
  dot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
  },
  memoryMark: {
    width: 7,
    height: 7,
    borderRadius: 1,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  memoryMarkInner: {
    width: 3,
    height: 3,
  },
  expenseMark: {
    width: 7,
    height: 2,
    borderRadius: 1,
  },
  legend: {
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendText: {
    fontSize: 11,
    fontWeight: '700',
  },
});
