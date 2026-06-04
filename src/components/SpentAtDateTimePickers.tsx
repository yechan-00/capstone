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
  /** 'date' 또는 'time'만 단계별 표시. 생략 시 날짜+시간을 함께 표시 */
  phase?: SpentAtPickerPhase;
  value: Date;
  onChange: (next: Date) => void;
  onDateSelected?: () => void;
  textColor: string;
  themeVariant: 'light' | 'dark';
};

/**
 * phase='date' → 달력 / phase='time' → 시간 / 미지정 → 날짜+시간 함께.
 * iOS는 inline 달력, Android는 calendar.
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

  const datePicker = (
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
  );

  const timePicker = (
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
  );

  if (phase === 'date') {
    return <View style={styles.wrap}>{datePicker}</View>;
  }
  if (phase === 'time') {
    return <View style={styles.wrap}>{timePicker}</View>;
  }
  return (
    <View style={styles.wrap}>
      {datePicker}
      {timePicker}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', alignItems: 'center' },
});
