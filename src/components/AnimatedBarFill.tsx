import React, { useEffect } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeContext';

type Props = {
  /** 0~100 목표 퍼센트 */
  pct: number;
  style?: StyleProp<ViewStyle>;
  /** 등장 지연(ms) — 리스트 stagger용 */
  delay?: number;
  duration?: number;
  /** 값이 바뀔 때마다 0%부터 다시 차오름 (탭 재생용) */
  replay?: number;
};

/**
 * 0% → pct% 로 너비가 차오르는 막대 채움.
 * 기존 정적 `<View style={[barFill, { width: `${pct}%` }]} />` 을 그대로 대체.
 */
export function AnimatedBarFill({ pct, style, delay = 0, duration = 650, replay = 0 }: Props) {
  const { animationsEnabled } = useTheme();
  const target = Math.min(100, Math.max(0, Number.isFinite(pct) ? pct : 0));
  const w = useSharedValue(0);

  useEffect(() => {
    if (!animationsEnabled) {
      w.value = target;
      return;
    }
    w.value = 0;
    w.value = withDelay(
      delay,
      withTiming(target, { duration, easing: Easing.out(Easing.cubic) }),
    );
  }, [target, delay, duration, animationsEnabled, replay, w]);

  const animatedStyle = useAnimatedStyle(() => ({ width: `${w.value}%` }));

  return <Animated.View style={[style, animatedStyle]} />;
}
