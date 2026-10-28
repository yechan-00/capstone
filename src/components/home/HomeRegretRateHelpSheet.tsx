import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BRAND_GREEN, BRAND_GREEN_DARK, BRAND_GREEN_LIGHT, useTheme } from '@/theme/ThemeContext';

type Props = {
  visible: boolean;
  onClose: () => void;
};

export function HomeRegretRateHelpSheet({ visible, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const formulaBg = isDark ? colors.surfaceMuted : BRAND_GREEN_LIGHT;
  const formulaAccent = isDark ? BRAND_GREEN : BRAND_GREEN_DARK;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Pressable
          style={[StyleSheet.absoluteFill, styles.backdrop]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="닫기"
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.surface,
              paddingBottom: Math.max(insets.bottom, 16),
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <Text style={[styles.title, { color: colors.text }]}>이번 달 후회율이란?</Text>
          <Text style={[styles.body, { color: colors.textSec }]}>
            이번 달 소비 중 리뷰를 완료한 기록을 기준으로 계산해요. 리뷰를 나중에 작성해도 소비한
            달의 후회율에 반영돼요.
          </Text>

          <View style={[styles.formulaCard, { backgroundColor: formulaBg }]}>
            <Text style={[styles.formulaLabel, { color: formulaAccent }]}>계산식</Text>
            <Text style={[styles.formula, { color: colors.text }]}>
              후회율 = 후회한 소비 ÷ 리뷰 완료 소비 × 100
            </Text>
          </View>

          <Text style={[styles.body, { color: colors.textSec }]}>
            아직 리뷰하지 않은 소비는 계산에 포함되지 않아요.
          </Text>
          <Text style={[styles.body, { color: colors.textSec }]}>
            리뷰 완료 4건 중 후회한 소비가 1건이면 후회율은{' '}
            <Text style={[styles.emphasis, { color: colors.text }]}>25%</Text>예요.
          </Text>

          <Pressable
            onPress={onClose}
            style={[styles.closeBtn, { backgroundColor: formulaBg }]}
            accessibilityRole="button"
            accessibilityLabel="닫기"
          >
            <Text style={[styles.closeBtnText, { color: formulaAccent }]}>닫기</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    backgroundColor: 'rgba(32, 37, 34, 0.35)',
  },
  sheet: {
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 22,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: -0.3,
    marginBottom: 10,
  },
  body: {
    fontSize: 14,
    lineHeight: 22,
    fontWeight: '600',
    marginBottom: 12,
  },
  formulaCard: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  formulaLabel: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.2,
    marginBottom: 4,
  },
  formula: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
  emphasis: {
    fontWeight: '800',
  },
  closeBtn: {
    marginTop: 4,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 14,
  },
  closeBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
