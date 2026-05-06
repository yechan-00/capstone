import Picker from 'react-mobile-picker';
import { useMemo, useCallback } from 'react';
import { View } from 'react-native';
import type { AlarmTimeWheelProps } from './AlarmTimeWheel';

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, '0'));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));

/**
 * 웹(Safari 등)에서 @react-native-community/datetimepicker가 비어 보일 때,
 * iOS 알람 앱과 유사한 스크롤 휠 UI를 제공합니다.
 */
export default function AlarmTimeWheel({ value, onChange, colors }: AlarmTimeWheelProps) {
  const pickerValue = useMemo(
    () => ({
      hour: String(value.getHours()).padStart(2, '0'),
      minute: String(value.getMinutes()).padStart(2, '0'),
    }),
    [value]
  );

  const handlePickerChange = useCallback(
    (next: { hour: string; minute: string }) => {
      const h = parseInt(next.hour, 10);
      const m = parseInt(next.minute, 10);
      if (Number.isNaN(h) || Number.isNaN(m)) return;
      const d = new Date(value.getTime());
      d.setHours(h, m, 0, 0);
      onChange(d);
    },
    [value, onChange]
  );

  return (
    <View style={{ width: '100%', maxWidth: 340, alignSelf: 'center' }}>
      <Picker
        value={pickerValue}
        onChange={handlePickerChange}
        wheelMode="natural"
        height={216}
        itemHeight={36}
        style={{ width: '100%' }}
      >
        <Picker.Column name="hour">
          {HOURS.map((h) => (
            <Picker.Item key={h} value={h}>
              {({ selected }) => (
                <span
                  style={{
                    fontSize: selected ? 23 : 20,
                    fontWeight: selected ? 700 : 500,
                    color: selected ? colors.text : colors.textSec,
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: 0.5,
                  }}
                >
                  {h}
                </span>
              )}
            </Picker.Item>
          ))}
        </Picker.Column>
        <Picker.Column name="minute">
          {MINUTES.map((m) => (
            <Picker.Item key={m} value={m}>
              {({ selected }) => (
                <span
                  style={{
                    fontSize: selected ? 23 : 20,
                    fontWeight: selected ? 700 : 500,
                    color: selected ? colors.text : colors.textSec,
                    fontVariantNumeric: 'tabular-nums',
                    letterSpacing: 0.5,
                  }}
                >
                  {m}
                </span>
              )}
            </Picker.Item>
          ))}
        </Picker.Column>
      </Picker>
    </View>
  );
}
