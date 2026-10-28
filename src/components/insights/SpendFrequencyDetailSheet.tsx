import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { WeekdaySpendFrequencyCard } from '@/components/insights/WeekdaySpendFrequencyCard';
import { INSIGHTS_THEME } from '@/theme/insightsTheme';

type Props = {
  visible: boolean;
  onClose: () => void;
  weekdayExpenseCounts: number[];
  weekdayCategoryCounts: Array<Record<string, number>>;
};

export function SpendFrequencyDetailSheet({
  visible,
  onClose,
  weekdayExpenseCounts,
  weekdayCategoryCounts,
}: Props) {
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="닫기" />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={styles.handle} />
        <Text style={styles.title}>소비 빈도</Text>
        <Text style={styles.subtitle}>요일별 기록 건수 · 카테고리 stack</Text>
        <WeekdaySpendFrequencyCard
          weekdayExpenseCounts={weekdayExpenseCounts}
          weekdayCategoryCounts={weekdayCategoryCounts}
          embedded
        />
        <Pressable style={styles.closeBtn} onPress={onClose} accessibilityRole="button">
          <Text style={styles.closeBtnText}>닫기</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(32, 37, 34, 0.35)',
  },
  sheet: {
    backgroundColor: INSIGHTS_THEME.bg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 10,
    maxHeight: '85%',
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: INSIGHTS_THEME.border,
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
    color: INSIGHTS_THEME.text,
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    color: INSIGHTS_THEME.textMuted,
    marginBottom: 12,
  },
  closeBtn: {
    marginTop: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: INSIGHTS_THEME.mintSoft,
  },
  closeBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: INSIGHTS_THEME.primaryDeep,
  },
});
