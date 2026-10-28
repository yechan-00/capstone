import React, { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import Animated, {
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

export function SuccessOverlay({
  visible,
  tone = 'positive',
  title,
  subtitle,
  mode = 'auto',
  autoMs = 1100,
  onDone,
}: Props) {
  const { colors, isDark, animationsEnabled } = useTheme();
  const mintFill = colors.choiceActiveBg;
  const mintIcon = colors.primary;
  const regretFill = isDark ? colors.surfaceMuted : '#F4F6F4';
  const regretIcon = colors.textSec;

  const circleScale = useSharedValue(0);
  const iconScale = useSharedValue(0);
  const cardOpacity = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;

    if (!animationsEnabled) {
      circleScale.value = 1;
      iconScale.value = 1;
      cardOpacity.value = 1;
    } else {
      circleScale.value = 0;
      iconScale.value = 0;
      cardOpacity.value = 0;
      cardOpacity.value = withTiming(1, { duration: 180 });
      circleScale.value = withSpring(1, { damping: 14, stiffness: 160 });
      iconScale.value = withDelay(80, withSpring(1, { damping: 12, stiffness: 180 }));
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
  const cardStyle = useAnimatedStyle(() => ({ opacity: cardOpacity.value }));

  if (!visible) return null;

  return (
    <Modal visible={visible} transparent statusBarTranslucent onRequestClose={handleDismiss}>
      <Pressable
        style={[styles.backdrop, { backgroundColor: isDark ? 'rgba(11,15,14,0.72)' : 'rgba(26,46,36,0.38)' }]}
        onPress={mode === 'tap' ? handleDismiss : undefined}
        disabled={mode !== 'tap'}
      >
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
            cardStyle,
          ]}
        >
          <Animated.View
            style={[
              styles.circle,
              { backgroundColor: tone === 'positive' ? mintFill : regretFill },
              circleStyle,
            ]}
          >
            <Animated.View style={iconStyle}>
              <MaterialIcons
                name={tone === 'positive' ? 'check' : 'spa'}
                size={32}
                color={tone === 'positive' ? mintIcon : regretIcon}
              />
            </Animated.View>
          </Animated.View>

          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {subtitle ? <Text style={[styles.subtitle, { color: colors.textSec }]}>{subtitle}</Text> : null}
          {mode === 'tap' ? (
            <Text style={[styles.tapHint, { color: colors.textMuted }]}>탭하여 계속</Text>
          ) : null}
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 28,
    paddingHorizontal: 22,
    alignItems: 'center',
    gap: 6,
  },
  circle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  title: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  subtitle: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 21,
    marginTop: 2,
  },
  tapHint: { marginTop: 12, fontSize: 12, fontWeight: '600' },
});
