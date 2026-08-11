import React, { type ReactNode } from 'react';
import { Animated, StyleSheet, View, type ViewStyle } from 'react-native';
import { HOME } from '@/components/home/homeTheme';
import { useScrollReveal } from '@/components/home/useScrollReveal';

type Props = {
  children: ReactNode;
  style?: ViewStyle;
  delay?: number;
};

export function RevealSection({ children, style, delay = 0 }: Props) {
  const { viewRef, animatedStyle } = useScrollReveal({ delay, offsetY: 60 });

  return (
    <Animated.View ref={viewRef} collapsable={false} style={[style, animatedStyle]}>
      {children}
    </Animated.View>
  );
}

export function SectionContainer({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.container, style]}>{children}</View>;
}

/** @deprecated SectionContainer와 동일 — 정렬 통일 */
export function SectionWide({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.container, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: HOME.maxWidth,
    alignSelf: 'center',
    paddingHorizontal: 24,
  },
});
