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
import { useInsightsPalette } from '@/theme/insightsTheme';

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
  const t = useInsightsPalette();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: t.overlay }]} onPress={onClose} accessibilityLabel="닫기" />
      <View style={[styles.sheet, { backgroundColor: t.bg, paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={[styles.handle, { backgroundColor: t.border }]} />
        <Text style={[styles.title, { color: t.text }]}>소비 빈도</Text>
        <Text style={[styles.subtitle, { color: t.textMuted }]}>요일별 기록 건수 · 카테고리 stack</Text>
        <WeekdaySpendFrequencyCard
          weekdayExpenseCounts={weekdayExpenseCounts}
          weekdayCategoryCounts={weekdayCategoryCounts}
          embedded
        />
        <Pressable style={[styles.closeBtn, { backgroundColor: t.mintSoft }]} onPress={onClose} accessibilityRole="button">
          <Text style={[styles.closeBtnText, { color: t.primaryDeep }]}>닫기</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  sheet: {
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
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    fontWeight: '800',
  },
  subtitle: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 12,
  },
  closeBtn: {
    marginTop: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 14,
  },
  closeBtnText: {
    fontSize: 15,
    fontWeight: '700',
  },
});
