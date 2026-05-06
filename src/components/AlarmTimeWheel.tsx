import type { ThemeColors } from '@/theme/ThemeContext';

export type AlarmTimeWheelProps = {
  value: Date;
  onChange: (d: Date) => void;
  colors: Pick<ThemeColors, 'text' | 'textSec'>;
};

/** iOS/Android 네이티브에서는 설정 화면에서 사용하지 않음(웹 전용 구현은 .web.tsx). */
export default function AlarmTimeWheel(_props: AlarmTimeWheelProps) {
  return null;
}
