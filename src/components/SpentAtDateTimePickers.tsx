import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';

function mergeDateKeepTime(base: Date, from: Date): Date {
  const n = new Date(base);
  n.setFullYear(from.getFullYear(), from.getMonth(), from.getDate());
  return n;
}

function mergeTimeKeepDate(base: Date, from: Date): Date {
  const n = new Date(base);
  n.setHours(from.getHours(), from.getMinutes(), 0, 0);
  return n;
}

export type SpentAtPickerPhase = 'date' | 'time';

type Props = {
  phase: SpentAtPickerPhase;
  value: Date;
  onChange: (next: Date) => void;
  onDateSelected?: () => void;
  textColor: string;
  themeVariant: 'light' | 'dark';
};

/**
 * 1단계: 달력(날짜) → 2단계: 시간. iOS는 inline 달력, Android는 calendar.
 */
export function SpentAtDateTimePickers({
  phase,
  value,
  onChange,
  onDateSelected,
  textColor,
  themeVariant,
}: Props) {
  const locale = Platform.OS === 'ios' ? 'ko_KR' : undefined;

  if (phase === 'date') {
    return (
      <View style={styles.wrap}>
        <DateTimePicker
          value={value}
          mode="date"
          display={Platform.OS === 'ios' ? 'inline' : 'calendar'}
          locale={locale}
          themeVariant={themeVariant}
          textColor={textColor}
          onChange={(_, d) => {
            if (!d) return;
            const dateChanged =
              d.getFullYear() !== value.getFullYear() ||
              d.getMonth() !== value.getMonth() ||
              d.getDate() !== value.getDate();
            onChange(mergeDateKeepTime(value, d));
            if (dateChanged) onDateSelected?.();
          }}
        />
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <DateTimePicker
        value={value}
        mode="time"
        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
        is24Hour
        locale={locale}
        themeVariant={themeVariant}
        textColor={textColor}
        onChange={(_, d) => {
          if (d) onChange(mergeTimeKeepDate(value, d));
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', alignItems: 'center' },
});
