import React, { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/theme/ThemeContext';

export type SuccessTone = 'positive' | 'regret';

type Props = {
  visible: boolean;
  tone?: SuccessTone;
  title: string;
  subtitle?: string;
  /** 'auto' = 일정 시간 후 자동 종료, 'tap' = 탭하여 종료 */
  mode?: 'auto' | 'tap';
  autoMs?: number;
  onDone: () => void;
};

const TONE = {
  positive: { ring: '#16a34a', bg: '#dcfce7', icon: 'check' as const },
  regret: { ring: '#d97706', bg: '#fef3c7', icon: 'spa' as const },
};

export function SuccessOverlay({
  visible,
  tone = 'positive',
  title,
  subtitle,
  mode = 'auto',
  autoMs = 1100,
  onDone,
}: Props) {
  const { animationsEnabled } = useTheme();
  const palette = TONE[tone];

  const circleScale = useSharedValue(0);
  const iconScale = useSharedValue(0);
  const ringScale = useSharedValue(0.5);
  const ringOpacity = useSharedValue(0);
  const cardOpacity = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;

    if (!animationsEnabled) {
      circleScale.value = 1;
      iconScale.value = 1;
      ringScale.value = 1;
      ringOpacity.value = 0;
      cardOpacity.value = 1;
    } else {
      circleScale.value = 0;
      iconScale.value = 0;
      ringScale.value = 0.5;
      ringOpacity.value = 0.55;
      cardOpacity.value = 0;

      cardOpacity.value = withTiming(1, { duration: 180 });
      circleScale.value = withSpring(1, { damping: 11, stiffness: 140 });
      iconScale.value = withDelay(
        120,
        withSpring(1, { damping: 9, stiffness: 160 }),
      );
      ringScale.value = withDelay(80, withTiming(1.9, { duration: 620, easing: Easing.out(Easing.cubic) }));
      ringOpacity.value = withDelay(80, withTiming(0, { duration: 620, easing: Easing.out(Easing.cubic) }));
    }

    Haptics.notificationAsync(
      tone === 'positive'
        ? Haptics.NotificationFeedbackType.Success
        : Haptics.NotificationFeedbackType.Warning,
    ).catch(() => {});

    if (mode === 'auto') {
      const t = setTimeout(onDone, autoMs);
      return () => clearTimeout(t);
    }
  }, [visible, tone, mode, autoMs, animationsEnabled]);

  const handleDismiss = () => {
    if (!animationsEnabled) {
      onDone();
      return;
    }
    cardOpacity.value = withTiming(0, { duration: 150 }, (finished) => {
      if (finished) runOnJS(onDone)();
    });
  };

  const circleStyle = useAnimatedStyle(() => ({ transform: [{ scale: circleScale.value }] }));
  const iconStyle = useAnimatedStyle(() => ({ transform: [{ scale: iconScale.value }] }));
  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ scale: ringScale.value }],
    opacity: ringOpacity.value,
  }));
  const cardStyle = useAnimatedStyle(() => ({ opacity: cardOpacity.value }));

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent statusBarTranslucent onRequestClose={handleDismiss}>
      <Pressable
        style={styles.backdrop}
        onPress={mode === 'tap' ? handleDismiss : undefined}
        disabled={mode !== 'tap'}
      >
        <Animated.View style={[styles.card, cardStyle]}>
          <View style={styles.badgeWrap}>
            <Animated.View
              style={[styles.ring, { borderColor: palette.ring }, ringStyle]}
              pointerEvents="none"
            />
            <Animated.View style={[styles.circle, { backgroundColor: palette.bg }, circleStyle]}>
              <Animated.View style={iconStyle}>
                <MaterialIcons name={palette.icon} size={44} color={palette.ring} />
              </Animated.View>
            </Animated.View>
          </View>

          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          {mode === 'tap' ? <Text style={styles.tapHint}>탭하여 계속</Text> : null}
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: {
    width: '100%',
    maxWidth: 340,
    backgroundColor: '#ffffff',
    borderRadius: 24,
    paddingVertical: 32,
    paddingHorizontal: 24,
    alignItems: 'center',
    gap: 6,
  },
  badgeWrap: {
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  ring: {
    position: 'absolute',
    width: 88,
    height: 88,
    borderRadius: 44,
    borderWidth: 3,
  },
  circle: {
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 19, fontWeight: '900', color: '#111827', textAlign: 'center' },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#4b5563',
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 2,
  },
  tapHint: { marginTop: 14, fontSize: 12, fontWeight: '700', color: '#9ca3af' },
});
