import React, { useEffect } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import type { InsightHelpContent } from '@/lib/insightCardHelp';
import { useTheme } from '@/theme/ThemeContext';

export function InsightHelpModal({
  visible,
  content,
  onClose,
  origin,
}: {
  visible: boolean;
  content: InsightHelpContent | null;
  onClose: () => void;
  /** 도움말을 연 물음표 버튼의 화면 좌표 (튀어나오는 시작점) */
  origin?: { x: number; y: number } | null;
}) {
  const insets = useSafeAreaInsets();
  const { colors, animationsEnabled } = useTheme();
  const { width, height } = useWindowDimensions();

  const progress = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    if (!animationsEnabled) {
      progress.value = 1;
      return;
    }
    progress.value = 0;
    progress.value = withSpring(1, { damping: 14, stiffness: 170, mass: 0.7 });
  }, [visible, animationsEnabled, progress]);

  // 카드가 화면 중앙 부근에 뜬다고 보고, 물음표 좌표에서 중앙까지 좁혀 들어오게 한다.
  const centerX = width / 2;
  const centerY = height / 2;
  const startX = origin ? origin.x - centerX : 0;
  const startY = origin ? origin.y - centerY : -40;

  const cardStyle = useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: p,
      transform: [
        { translateX: (1 - p) * startX },
        { translateY: (1 - p) * startY },
        { scale: 0.2 + 0.8 * p },
      ],
    };
  });

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        backdrop: {
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.4)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 20,
        },
        card: {
          width: '100%',
          maxWidth: 380,
          maxHeight: '78%',
          backgroundColor: colors.surface,
          borderRadius: 18,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          overflow: 'hidden',
          paddingBottom: Math.min(insets.bottom, 8),
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        title: { flex: 1, fontSize: 17, fontWeight: '900', color: colors.text, paddingRight: 12 },
        close: { fontSize: 14, fontWeight: '800', color: colors.accentBlue },
        body: { paddingHorizontal: 16, paddingTop: 16, gap: 16, paddingBottom: 16 },
        section: { gap: 6 },
        sectionTitle: { fontSize: 14, fontWeight: '900', color: colors.text },
        sectionBody: { fontSize: 14, fontWeight: '600', color: colors.textSec, lineHeight: 22 },
      }),
    [colors, insets.bottom],
  );

  if (!visible || !content) return null;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="닫기" />
        <Animated.View style={[styles.card, cardStyle]}>
          <View style={styles.header}>
            <Text style={styles.title}>{content.cardTitle}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.close}>닫기</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {content.sections.map((section) => (
              <View key={section.title} style={styles.section}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionBody}>{section.body}</Text>
              </View>
            ))}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}
