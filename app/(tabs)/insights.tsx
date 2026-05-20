import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CategoryDonutChart } from '@/components/CategoryDonutChart';
import { EXPENSE_MOODS } from '@/lib/constants';
import { toMonthlyIncomeKrw } from '@/lib/accountSettings';
import { useInsights } from '@/hooks/useInsights';
import { useAuth } from '@/hooks/useAuth';
import { ErrorRetryCard } from '@/components/ErrorRetryCard';
import { toUserMessage } from '@/utils/error';
import { useTheme } from '@/theme/ThemeContext';
import type { CategoryInsight, MoodInsight } from '@/lib/types';

/** 막대 그래프: 월→일 순 (getDay 1=월 … 0=일) */
const WD_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
const WD_LABELS = ['월', '화', '수', '목', '금', '토', '일'];

function formatPeriodLabel(start: Date, mode: 'month' | 'year'): string {
  if (mode === 'year') {
    return `${start.getFullYear()}년`;
  }
  return `${start.getFullYear()}년 ${start.getMonth() + 1}월`;
}

function moodRowLabel(mood: MoodInsight['mood']): string {
  return EXPENSE_MOODS.find((x) => x.value === mood)?.label ?? String(mood);
}

function mergedCategoryShares(categoryInsights: CategoryInsight[]) {
  type Row = { key: string; label: string; color: string; count: number; pct: number };
  const acc = new Map<string, { label: string; color: string; count: number }>();
  for (const c of categoryInsights) {
    const canonical = c.category === 'food' ? 'takeout' : c.category;
    const label =
      canonical === 'delivery' ? '외식(배달)' : canonical === 'cafe' ? '외식(카페)' : '외식(포장)';
    const color =
      canonical === 'delivery' ? '#22c55e' : canonical === 'cafe' ? '#ca8a04' : '#ea580c';
    const cur = acc.get(canonical) ?? { label, color, count: 0 };
    cur.count += c.totalCount;
    acc.set(canonical, cur);
  }
  const total = [...acc.values()].reduce((s, v) => s + v.count, 0);
  const rows: Row[] = [...acc.entries()].map(([key, v]) => ({
    key,
    label: v.label,
    color: v.color,
    count: v.count,
    pct: total > 0 ? (v.count / total) * 100 : 0,
  }));
  return { rows: rows.filter((r) => r.count > 0).sort((a, b) => b.count - a.count), total };
}

function formatKrw(n: number) {
  return `₩${Math.round(Math.abs(n)).toLocaleString()}`;
}

function spendRatioBarColor(pct: number, colors: { success: string; logoutText: string }) {
  if (pct >= 100) return colors.logoutText;
  if (pct >= 75) return '#CA8A04';
  return colors.success;
}

function buildMoodRows(moodInsights: MoodInsight[]) {
  const withData = moodInsights.filter((m) => m.totalCount > 0);
  const total = withData.reduce((s, m) => s + m.totalCount, 0) || 1;
  return [...withData]
    .sort((a, b) => b.totalCount - a.totalCount)
    .slice(0, 6)
    .map((m) => ({
      ...m,
      label: moodRowLabel(m.mood),
      sharePct: (m.totalCount / total) * 100,
    }));
}

export default function InsightsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { account } = useAuth();
  const { colors, isDark } = useTheme();
  const [periodMode, setPeriodMode] = useState<'month' | 'year'>('month');
  const { insights, loading, error, refresh } = useInsights(periodMode);
  const hasMonthlyIncome = account ? toMonthlyIncomeKrw(account) > 0 : false;

  const cardElev =
    !isDark && Platform.OS !== 'web'
      ? {
          shadowColor: '#1a2d4a',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.07,
          shadowRadius: 12,
          elevation: 3,
        }
      : {};

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: { flex: 1, backgroundColor: colors.bg },
        center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
        content: {
          paddingHorizontal: 16,
          paddingTop: 14,
          paddingBottom: insets.bottom + 32,
          gap: 18,
        },
        hint: {
          fontSize: 13,
          fontWeight: '600',
          color: colors.textMuted,
          lineHeight: 19,
        },
        periodRow: { flexDirection: 'row', gap: 8 },
        periodChip: {
          paddingHorizontal: 14,
          paddingVertical: 8,
          borderRadius: 999,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },
        periodChipActive: {
          backgroundColor: colors.accentCta,
          borderColor: colors.accentCta,
        },
        periodChipText: { fontSize: 13, fontWeight: '800', color: colors.textSec },
        periodChipTextActive: { color: colors.onPrimary },
        card: {
          backgroundColor: colors.surface,
          borderRadius: 16,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          padding: 16,
          gap: 12,
        },
        cardTitle: { fontSize: 17, fontWeight: '900', color: colors.text, letterSpacing: -0.3 },
        cardSub: { fontSize: 13, fontWeight: '600', color: colors.textMuted, marginTop: -6 },
        donutBlock: { alignItems: 'center', gap: 10, marginTop: 4 },
        legendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
        legendLeft: { flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 },
        dot: { width: 8, height: 8, borderRadius: 4 },
        legendLabel: { fontSize: 13, fontWeight: '700', color: colors.text },
        legendPct: { fontSize: 13, fontWeight: '800', color: colors.textSec },
        barRow: {
          flexDirection: 'row',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 4,
          marginTop: 4,
        },
        barCol: { flex: 1, alignItems: 'center', gap: 6 },
        barTrack: {
          width: '100%',
          height: 80,
          justifyContent: 'flex-end',
          borderRadius: 6,
          backgroundColor: colors.surfaceMuted,
          overflow: 'hidden',
        },
        barFill: { width: '100%', borderRadius: 6, minHeight: 3 },
        barLabel: { fontSize: 11, fontWeight: '800', color: colors.textSec },
        moodRow: { gap: 6 },
        moodTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
        moodBarTrack: {
          height: 8,
          borderRadius: 4,
          overflow: 'hidden',
          backgroundColor: colors.surfaceMuted,
        },
        moodBarFill: { height: '100%', borderRadius: 4 },
        insightCard: {
          borderRadius: 14,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.accentCta,
          backgroundColor: colors.surface,
          padding: 14,
          flexDirection: 'row',
          gap: 12,
          alignItems: 'flex-start',
        },
        insightBody: { flex: 1, gap: 4 },
        insightText: { fontSize: 14, fontWeight: '600', color: colors.textSec, lineHeight: 21 },
        emptyText: { color: colors.textMuted, fontSize: 15, textAlign: 'center', paddingVertical: 8 },
        insightStack: { gap: 10 },
        incomeHero: { gap: 12 },
        incomePctRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
        incomePct: { fontSize: 32, fontWeight: '900', color: colors.text, letterSpacing: -1 },
        incomePctLabel: { fontSize: 13, fontWeight: '700', color: colors.textMuted, marginBottom: 6 },
        incomeBarTrack: {
          height: 10,
          borderRadius: 999,
          backgroundColor: colors.surfaceMuted,
          overflow: 'hidden',
        },
        incomeBarFill: { height: '100%', borderRadius: 999 },
        incomeStatRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
        incomeStat: { flex: 1, gap: 4 },
        incomeStatKey: { fontSize: 12, fontWeight: '700', color: colors.textMuted },
        incomeStatVal: { fontSize: 15, fontWeight: '800', color: colors.text },
        incomeRemain: { fontSize: 14, fontWeight: '800' },
        incomeCta: {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          padding: 14,
          borderRadius: 14,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: colors.border,
          backgroundColor: colors.surface,
        },
        incomeCtaText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.textSec, lineHeight: 20 },
      }),
    [colors, insets.bottom],
  );

  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const scrollRefreshControl = useMemo(
    () => (
      <RefreshControl
        refreshing={loading}
        onRefresh={refresh}
        tintColor={colors.primary}
        colors={[colors.primary]}
      />
    ),
    [loading, refresh, colors.primary],
  );

  if (loading && !insights) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <ErrorRetryCard title="인사이트를 불러오지 못했어요" desc={toUserMessage(error)} onRetry={refresh} />
      </View>
    );
  }

  if (!insights) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>데이터가 없습니다</Text>
      </View>
    );
  }

  const periodLabel = formatPeriodLabel(insights.period.start, insights.periodMode);
  const { rows: shareRows, total: shareTotal } = mergedCategoryShares(insights.categoryInsights);
  const donutSlices = shareRows.map((r) => ({ key: r.key, color: r.color, pct: r.pct }));
  const wd = insights.weekdayExpenseCounts ?? [0, 0, 0, 0, 0, 0, 0];
  const wdMax = Math.max(1, ...WD_ORDER.map((d) => wd[d] ?? 0));
  const regretPct =
    insights.totalExpenses > 0
      ? ((insights.totalRegrets / insights.totalExpenses) * 100).toFixed(0)
      : '0';
  const lowThreshold = periodMode === 'month' ? 5 : 15;
  const isLowData = insights.totalExpenses > 0 && insights.totalExpenses < lowThreshold;
  const moodRows = buildMoodRows(insights.moodInsights);
  const income = insights.incomeInsight;
  const spendBarPct = income ? Math.min(100, Math.max(0, income.spendRatioPercent)) : 0;

  const incomeSection = income ? (
    <View style={[styles.card, cardElev, styles.incomeHero]}>
      <View>
        <Text style={styles.cardTitle}>월 수입 대비 소비</Text>
        <Text style={styles.cardSub}>
          {periodMode === 'year'
            ? `올해 총 소비 · 예산(월 수입×12) ${formatKrw(income.budgetKrw)}`
            : `이번 달 · 월 수입 ${formatKrw(income.monthlyIncomeKrw)}`}
        </Text>
      </View>
      <View style={styles.incomePctRow}>
        <Text style={styles.incomePct}>{income.spendRatioPercent.toFixed(0)}%</Text>
        <Text style={styles.incomePctLabel}>소비율</Text>
      </View>
      <View style={styles.incomeBarTrack}>
        <View
          style={[
            styles.incomeBarFill,
            {
              width: `${spendBarPct}%`,
              backgroundColor: spendRatioBarColor(income.spendRatioPercent, colors),
            },
          ]}
        />
      </View>
      <View style={styles.incomeStatRow}>
        <View style={styles.incomeStat}>
          <Text style={styles.incomeStatKey}>소비 합계</Text>
          <Text style={styles.incomeStatVal}>{formatKrw(income.totalSpendKrw)}</Text>
        </View>
        <View style={[styles.incomeStat, { alignItems: 'flex-end' }]}>
          <Text style={styles.incomeStatKey}>{periodMode === 'year' ? '연 예산' : '월 예산'}</Text>
          <Text style={styles.incomeStatVal}>{formatKrw(income.budgetKrw)}</Text>
        </View>
      </View>
      <Text
        style={[
          styles.incomeRemain,
          { color: income.isOverBudget ? colors.logoutText : colors.success },
        ]}
      >
        {income.isOverBudget
          ? `예산 초과 ${formatKrw(-income.remainingKrw)}`
          : `예산 대비 잔여 ${formatKrw(income.remainingKrw)}`}
      </Text>
    </View>
  ) : !hasMonthlyIncome ? (
    <Pressable
      style={[styles.incomeCta, cardElev]}
      onPress={() => router.push('/(tabs)/settings')}
      accessibilityRole="button"
    >
      <MaterialIcons name="savings" size={22} color={colors.accentBlue} />
      <Text style={styles.incomeCtaText}>
        설정에서 월 수입을 입력하면 소비율·예산 대비 잔액을 볼 수 있어요.
      </Text>
      <MaterialIcons name="chevron-right" size={22} color={colors.textMuted} />
    </Pressable>
  ) : null;

  const insightSection = (
    <View style={styles.insightStack}>
      {insights.patterns.length > 0 ? (
        insights.patterns.map((line, idx) => (
          <View key={`${idx}-${line.slice(0, 12)}`} style={[styles.insightCard, cardElev]}>
            <MaterialIcons
              name={idx === 0 ? 'info-outline' : 'show-chart'}
              size={22}
              color={colors.accentBlue}
            />
            <View style={styles.insightBody}>
              <Text style={styles.insightText}>{line}</Text>
            </View>
          </View>
        ))
      ) : insights.totalExpenses === 0 ? (
        <Text style={styles.emptyText}>기록이 생기면 여기에 짧은 요약이 표시돼요.</Text>
      ) : (
        <View style={[styles.insightCard, cardElev]}>
          <MaterialIcons name="info-outline" size={22} color={colors.accentBlue} />
          <View style={styles.insightBody}>
            <Text style={styles.insightText}>지금은 두드러진 패턴이 없어요. 기록을 이어 가면 좋아요.</Text>
          </View>
        </View>
      )}
    </View>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={scrollRefreshControl}
    >
      <View style={styles.periodRow}>
        <Pressable
          onPress={() => setPeriodMode('month')}
          style={[styles.periodChip, periodMode === 'month' && styles.periodChipActive]}
        >
          <Text style={[styles.periodChipText, periodMode === 'month' && styles.periodChipTextActive]}>
            이번 달
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setPeriodMode('year')}
          style={[styles.periodChip, periodMode === 'year' && styles.periodChipActive]}
        >
          <Text style={[styles.periodChipText, periodMode === 'year' && styles.periodChipTextActive]}>
            올해
          </Text>
        </Pressable>
      </View>

      <Text style={styles.hint}>
        {periodLabel} · 기록 {insights.totalExpenses}건
        {insights.totalSpendKrw > 0 ? ` · 소비 ${formatKrw(insights.totalSpendKrw)}` : ''}
        {insights.totalExpenses > 0 ? ` · 후회 ${insights.totalRegrets}건 (${regretPct}%)` : ''}
      </Text>
      {isLowData ? (
        <Text style={styles.hint}>
          {periodMode === 'year'
            ? '올해 기록이 더 쌓이면 기분·요일 패턴이 더 또렷해져요.'
            : '기록이 쌓이면 요일·카테고리 패턴이 더 또렷해져요.'}
        </Text>
      ) : null}

      {incomeSection}

      {insightSection}

      <View style={[styles.card, cardElev]}>
        <Text style={styles.cardTitle}>카테고리별 소비 비중</Text>
        <Text style={styles.cardSub}>기간 내 기록 건수 기준 비율이에요.</Text>
        {shareTotal > 0 ? (
          <>
            <View style={styles.donutBlock}>
              <CategoryDonutChart slices={donutSlices} centerLabel={`${shareTotal}건`} size={188} />
            </View>
            {shareRows.map((r) => (
              <View key={r.key} style={styles.legendRow}>
                <View style={styles.legendLeft}>
                  <View style={[styles.dot, { backgroundColor: r.color }]} />
                  <Text style={styles.legendLabel}>{r.label}</Text>
                </View>
                <Text style={styles.legendPct}>{r.pct.toFixed(1)}%</Text>
              </View>
            ))}
          </>
        ) : (
          <Text style={[styles.cardSub, { marginTop: 4 }]}>이 기간에 기록된 소비가 없어요.</Text>
        )}
      </View>

      {moodRows.length > 0 ? (
        <View style={[styles.card, cardElev]}>
          <Text style={styles.cardTitle}>기분별 기록</Text>
          <Text style={styles.cardSub}>같은 기간 안에서 어떤 기분으로 적었는지, 후회 비율을 함께 보여요.</Text>
          {moodRows.map((m) => (
            <View key={m.mood} style={styles.moodRow}>
              <View style={styles.moodTop}>
                <Text style={styles.legendLabel} numberOfLines={1}>
                  {m.label}
                </Text>
                <Text style={styles.legendPct}>
                  {m.totalCount}건 · 후회 {m.regretRate.toFixed(0)}%
                </Text>
              </View>
              <View style={styles.moodBarTrack}>
                <View style={[styles.moodBarFill, { width: `${m.sharePct}%`, backgroundColor: colors.accentCta }]} />
              </View>
            </View>
          ))}
        </View>
      ) : null}

      <View style={[styles.card, cardElev]}>
        <Text style={styles.cardTitle}>요일별 소비 빈도</Text>
        <Text style={styles.cardSub}>어느 요일에 기록이 많은지예요.</Text>
        <View style={styles.barRow}>
          {WD_ORDER.map((dayIdx, i) => {
            const count = wd[dayIdx] ?? 0;
            const barMax = 80;
            const fillH = count === 0 ? 0 : Math.max(4, (count / wdMax) * barMax);
            return (
              <View key={dayIdx} style={styles.barCol}>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        height: fillH,
                        backgroundColor: count > 0 ? colors.accentCta : colors.border,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.barLabel}>{WD_LABELS[i]}</Text>
              </View>
            );
          })}
        </View>
      </View>
    </ScrollView>
  );
}
