import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
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

type Props = {
  value: Date;
  onChange: (next: Date) => void;
  textColor: string;
  themeVariant: 'light' | 'dark';
};

/**
 * iOS/Android: 날짜·시간 스피너 분리 + `ko_KR` 로케일로 년·월·일 순 인지에 맞춤.
 */
export function SpentAtDateTimePickers({ value, onChange, textColor, themeVariant }: Props) {
  const locale = Platform.OS === 'ios' ? 'ko_KR' : undefined;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: textColor }]}>날짜 (년 → 월 → 일)</Text>
      <DateTimePicker
        value={value}
        mode="date"
        display="spinner"
        locale={locale}
        themeVariant={themeVariant}
        textColor={textColor}
        onChange={(_, d) => {
          if (d) onChange(mergeDateKeepTime(value, d));
        }}
      />
      <Text style={[styles.label, styles.labelTime, { color: textColor }]}>시간 (24시간)</Text>
      <DateTimePicker
        value={value}
        mode="time"
        display="spinner"
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
  wrap: { width: '100%' },
  label: { fontSize: 12, fontWeight: '800', marginBottom: 4, opacity: 0.85 },
  labelTime: { marginTop: 8 },
});
