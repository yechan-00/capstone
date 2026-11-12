import React, { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { InsightsWindow } from '@/lib/types';
import { useInsightsPalette } from '@/theme/insightsTheme';
import { currentInsightsYear } from '@/lib/insightsPeriodNav';

type Props = {
  visible: boolean;
  onClose: () => void;
  insightsWindow: InsightsWindow;
  onSelectMonth: (year: number, monthIndex: number) => void;
  onSelectYear: (year: number) => void;
};

const MONTH_LABELS = ['1월', '2월', '3월', '4월', '5월', '6월', '7월', '8월', '9월', '10월', '11월', '12월'];

export function InsightsPeriodPickerSheet({
  visible,
  onClose,
  insightsWindow,
  onSelectMonth,
  onSelectYear,
}: Props) {
  const t = useInsightsPalette();
  const insets = useSafeAreaInsets();
  const isYearMode = insightsWindow.mode === 'year';
  const [draftYear, setDraftYear] = useState(insightsWindow.year);

  useEffect(() => {
    if (visible) setDraftYear(insightsWindow.year);
  }, [visible, insightsWindow.year]);

  const yearMin = currentInsightsYear() - 5;
  const yearMax = currentInsightsYear();

  const canPrevYear = draftYear > yearMin;
  const canNextYear = draftYear < yearMax;

  const yearOptions = Array.from({ length: yearMax - yearMin + 1 }, (_, i) => yearMax - i);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: t.overlay }]} onPress={onClose} accessibilityLabel="닫기" />
      <View style={[styles.sheet, { backgroundColor: t.surface, paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={[styles.handle, { backgroundColor: t.border }]} />

        {isYearMode ? (
          <>
            <Text style={[styles.sheetTitle, { color: t.text }]}>연도 선택</Text>
            <View style={styles.yearList}>
              {yearOptions.map((year) => {
                const active = insightsWindow.year === year;
                return (
                  <Pressable
                    key={year}
                    style={[
                      styles.yearCell,
                      { backgroundColor: t.bg },
                      active && { backgroundColor: t.mintSoft },
                    ]}
                    onPress={() => {
                      onSelectYear(year);
                      onClose();
                    }}
                  >
                    <Text
                      style={[
                        styles.yearCellText,
                        { color: t.textSecondary },
                        active && { color: t.primaryDeep, fontWeight: '700' },
                      ]}
                    >
                      {year}년
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        ) : (
          <>
            <View style={styles.yearNav}>
              <Pressable
                onPress={() => canPrevYear && setDraftYear((y) => y - 1)}
                disabled={!canPrevYear}
                style={[styles.navBtn, !canPrevYear && styles.navBtnDisabled]}
                accessibilityLabel="이전 연도"
              >
                <MaterialIcons
                  name="chevron-left"
                  size={24}
                  color={canPrevYear ? t.text : t.textMuted}
                />
              </Pressable>
              <Text style={[styles.yearNavLabel, { color: t.text }]}>{draftYear}년</Text>
              <Pressable
                onPress={() => canNextYear && setDraftYear((y) => y + 1)}
                disabled={!canNextYear}
                style={[styles.navBtn, !canNextYear && styles.navBtnDisabled]}
                accessibilityLabel="다음 연도"
              >
                <MaterialIcons
                  name="chevron-right"
                  size={24}
                  color={canNextYear ? t.text : t.textMuted}
                />
              </Pressable>
            </View>

            <View style={styles.monthGrid}>
              {MONTH_LABELS.map((label, monthIndex) => {
                const active =
                  insightsWindow.mode === 'month' &&
                  insightsWindow.year === draftYear &&
                  insightsWindow.monthIndex === monthIndex;
                const futureBlocked =
                  draftYear > yearMax ||
                  (draftYear === yearMax && monthIndex > new Date().getMonth());
                return (
                  <Pressable
                    key={label}
                    style={[
                      styles.monthCell,
                      { backgroundColor: t.bg },
                      active && { backgroundColor: t.mintSoft },
                      futureBlocked && styles.monthCellDisabled,
                    ]}
                    disabled={futureBlocked}
                    onPress={() => {
                      onSelectMonth(draftYear, monthIndex);
                      onClose();
                    }}
                  >
                    <Text
                      style={[
                        styles.monthCellText,
                        { color: t.textSecondary },
                        active && { color: t.primaryDeep, fontWeight: '700' },
                        futureBlocked && { color: t.textMuted },
                      ]}
                    >
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
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
    gap: 16,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 4,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  yearNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  yearNavLabel: {
    fontSize: 17,
    fontWeight: '700',
    minWidth: 88,
    textAlign: 'center',
  },
  navBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
  },
  navBtnDisabled: { opacity: 0.35 },
  monthGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'space-between',
  },
  monthCell: {
    width: '30%',
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthCellDisabled: {
    opacity: 0.35,
  },
  monthCellText: {
    fontSize: 15,
    fontWeight: '600',
  },
  yearList: {
    gap: 8,
  },
  yearCell: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  yearCellText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
