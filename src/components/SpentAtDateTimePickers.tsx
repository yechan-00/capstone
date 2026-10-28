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
  /** 'date' → 달력, 'time' → 시간 (단계별 1개만 표시) */
  phase: SpentAtPickerPhase;
  value: Date;
  onChange: (next: Date) => void;
  textColor: string;
  themeVariant: 'light' | 'dark';
  /** iOS inline 달력 선택/오늘/화살표 색. spinner에는 영향 없음. */
  accentColor?: string;
};

/** phase='date' → 달력만 / phase='time' → 시간만. iOS는 inline 달력, Android는 calendar. */
export function SpentAtDateTimePickers({
  phase,
  value,
  onChange,
  textColor,
  themeVariant,
  accentColor,
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
      accentColor={accentColor}
      onChange={(_, d) => {
        if (!d) return;
        onChange(mergeDateKeepTime(value, d));
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
      accentColor={accentColor}
      onChange={(_, d) => {
        if (d) onChange(mergeTimeKeepDate(value, d));
      }}
    />
  );

  return <View style={styles.wrap}>{phase === 'date' ? datePicker : timePicker}</View>;
}

const styles = StyleSheet.create({
  wrap: { width: '100%', alignItems: 'center' },
});
