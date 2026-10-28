import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { Account, InsightsWindow } from '@/lib/types';
import { formatShortBudgetPeriodRange } from '@/lib/budgetPeriod';
import {
  canShiftInsightsWindow,
  formatPeriodNavLabel,
  shiftInsightsWindow,
} from '@/lib/insightsPeriodNav';
import { INSIGHTS_THEME } from '@/theme/insightsTheme';
import { InsightsPeriodPickerSheet } from '@/components/insights/InsightsPeriodPickerSheet';

type Props = {
  insightsWindow: InsightsWindow;
  account: Account | null | undefined;
  isPaydayInsights: boolean;
  periodStart?: Date;
  periodEnd?: Date;
  onChangeWindow: (window: InsightsWindow) => void;
};

export function InsightsPeriodHeader({
  insightsWindow,
  account,
  isPaydayInsights,
  periodStart,
  periodEnd,
  onChangeWindow,
}: Props) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const isMonthMode = insightsWindow.mode === 'month';

  const canGoPrev = canShiftInsightsWindow(insightsWindow, -1, account);
  const canGoNext = canShiftInsightsWindow(insightsWindow, 1, account);

  const setMode = (mode: 'month' | 'year') => {
    if (mode === 'year') {
      onChangeWindow({ mode: 'year', year: insightsWindow.year });
      return;
    }
    const monthIndex =
      insightsWindow.mode === 'month' ? insightsWindow.monthIndex : new Date().getMonth();
    onChangeWindow({ mode: 'month', year: insightsWindow.year, monthIndex });
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.segment}>
        <Pressable
          style={[styles.segmentBtn, isMonthMode && styles.segmentBtnActive]}
          onPress={() => setMode('month')}
          accessibilityRole="button"
          accessibilityState={{ selected: isMonthMode }}
        >
          <Text style={[styles.segmentText, isMonthMode && styles.segmentTextActive]}>월간</Text>
        </Pressable>
        <Pressable
          style={[styles.segmentBtn, !isMonthMode && styles.segmentBtnActive]}
          onPress={() => setMode('year')}
          accessibilityRole="button"
          accessibilityState={{ selected: !isMonthMode }}
        >
          <Text style={[styles.segmentText, !isMonthMode && styles.segmentTextActive]}>연간</Text>
        </Pressable>
      </View>

      <View style={styles.navRow}>
        <Pressable
          onPress={() => canGoPrev && onChangeWindow(shiftInsightsWindow(insightsWindow, -1))}
          disabled={!canGoPrev}
          style={[styles.navBtn, !canGoPrev && styles.navBtnDisabled]}
          accessibilityLabel={isMonthMode ? '이전 달' : '이전 연도'}
        >
          <MaterialIcons
            name="chevron-left"
            size={26}
            color={canGoPrev ? INSIGHTS_THEME.textSecondary : INSIGHTS_THEME.textMuted}
          />
        </Pressable>

        <Pressable
          onPress={() => setPickerOpen(true)}
          style={styles.navCenter}
          accessibilityRole="button"
          accessibilityLabel="기간 선택"
        >
          <Text style={styles.navLabel}>{formatPeriodNavLabel(insightsWindow)}</Text>
        </Pressable>

        <Pressable
          onPress={() => canGoNext && onChangeWindow(shiftInsightsWindow(insightsWindow, 1))}
          disabled={!canGoNext}
          style={[styles.navBtn, !canGoNext && styles.navBtnDisabled]}
          accessibilityLabel={isMonthMode ? '다음 달' : '다음 연도'}
        >
          <MaterialIcons
            name="chevron-right"
            size={26}
            color={canGoNext ? INSIGHTS_THEME.textSecondary : INSIGHTS_THEME.textMuted}
          />
        </Pressable>
      </View>

      {isPaydayInsights && isMonthMode && periodStart && periodEnd ? (
        <Text style={styles.paydayHint}>
          식비 주기 {formatShortBudgetPeriodRange(periodStart, periodEnd)}
        </Text>
      ) : null}

      <InsightsPeriodPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        insightsWindow={insightsWindow}
        onSelectMonth={(year, monthIndex) => {
          onChangeWindow({ mode: 'month', year, monthIndex });
        }}
        onSelectYear={(year) => {
          onChangeWindow({ mode: 'year', year });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: INSIGHTS_THEME.bg,
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: INSIGHTS_THEME.border,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnActive: {
    backgroundColor: INSIGHTS_THEME.mintSoft,
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '600',
    color: INSIGHTS_THEME.textMuted,
  },
  segmentTextActive: {
    color: INSIGHTS_THEME.primaryDeep,
    fontWeight: '700',
  },
  navRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  navBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBtnDisabled: {
    opacity: 0.35,
  },
  navCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
  },
  navLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: INSIGHTS_THEME.text,
    letterSpacing: -0.3,
  },
  paydayHint: {
    fontSize: 12,
    fontWeight: '500',
    color: INSIGHTS_THEME.textMuted,
    textAlign: 'center',
    marginTop: -2,
  },
});
