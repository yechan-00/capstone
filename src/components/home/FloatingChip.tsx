import React, { useEffect } from 'react';
import { Animated, Platform, StyleSheet, View, type ViewStyle } from 'react-native';
import { HOME } from '@/components/home/homeTheme';
import { HomeText } from '@/components/home/HomeText';
import { WEB_NO_TRANSLATE } from '@/components/home/homeWeb';

type Props = {
  label: string;
  value: string;
  accent: string;
  delay?: number;
  floatRange?: number;
  style?: ViewStyle;
};

export function FloatingChip({
  label,
  value,
  accent,
  delay = 0,
  floatRange = 8,
  style,
}: Props) {
  const floatY = React.useRef(new Animated.Value(0)).current;
  const opacity = React.useRef(new Animated.Value(0)).current;

  const glassStyle =
    Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        } as object)
      : {};

  useEffect(() => {
    const enter = Animated.timing(opacity, {
      toValue: 1,
      duration: 700,
      delay,
      useNativeDriver: true,
    });
    const duration = 4500 + delay;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(floatY, { toValue: -floatRange, duration, useNativeDriver: true }),
        Animated.timing(floatY, { toValue: 0, duration, useNativeDriver: true }),
      ]),
    );
    enter.start(() => loop.start());
    return () => {
      floatY.stopAnimation();
      opacity.stopAnimation();
    };
  }, [delay, floatRange, floatY, opacity]);

  return (
    <Animated.View
      {...WEB_NO_TRANSLATE}
      style={[
        styles.chip,
        glassStyle,
        style,
        { opacity, transform: [{ translateY: floatY }] },
      ]}
    >
      <View style={[styles.accentBar, { backgroundColor: accent }]} />
      <View>
        <HomeText style={styles.label}>{label}</HomeText>
        <HomeText style={styles.value}>{value}</HomeText>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.85)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.12,
    shadowRadius: 60,
    elevation: 6,
    maxWidth: 200,
  },
  accentBar: { width: 3, height: 32, borderRadius: 2 },
  label: { fontSize: 11, fontWeight: '600', color: HOME.textMuted },
  value: { fontSize: 13, fontWeight: '800', marginTop: 2, letterSpacing: -0.2, color: HOME.brand },
});
