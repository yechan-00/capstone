import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MoodInsightDetailPanel } from '@/components/MoodInsightDetailPanel';
import { MoodInsightHeroCard } from '@/components/MoodInsightHeroCard';
import { MoodInsightKeywordCard } from '@/components/MoodInsightKeywordCard';
import { MoodInsightPatternOverview } from '@/components/MoodInsightPatternOverview';
import { SubScreenHeader } from '@/components/SubScreenHeader';
import { useAuth } from '@/hooks/useAuth';
import type { ExpenseMoodKey } from '@/lib/expenseMood';
import {
  buildMoodInsightDetailForMood,
  buildMoodInsightHeadline,
  buildMoodInsightSummaries,
  buildRegretKeywordChips,
  type MoodInsightDetail,
  type MoodInsightSummaryRow,
} from '@/lib/moodInsightDetail';
import type { InsightsWindow } from '@/lib/types';
import { expenseService } from '@/services/expenseService';
import { boundsForInsightsWindow } from '@/services/insightsService';
import { reviewService } from '@/services/reviewService';
import { toUserMessage } from '@/utils/error';
import { useTheme } from '@/theme/ThemeContext';
import { firstParam } from '@/utils/routerParams';

function parseInsightsWindow(params: {
  mode?: string | string[];
  year?: string | string[];
  monthIndex?: string | string[];
}): InsightsWindow | null {
  const mode = firstParam(params.mode);
  const yearRaw = firstParam(params.year);
  const year = yearRaw ? Number(yearRaw) : NaN;
  if (!Number.isFinite(year)) return null;

  if (mode === 'year') {
    return { mode: 'year', year };
  }

  const monthRaw = firstParam(params.monthIndex);
  const monthIndex = monthRaw != null && monthRaw !== '' ? Number(monthRaw) : NaN;
  if (!Number.isFinite(monthIndex) || monthIndex < 0 || monthIndex > 11) return null;
  return { mode: 'month', year, monthIndex };
}

export default function MoodInsightsScreen() {
  const params = useLocalSearchParams<{
    mode?: string | string[];
    year?: string | string[];
    monthIndex?: string | string[];
    periodLabel?: string | string[];
  }>();
  const insets = useSafeAreaInsets();
  const { account } = useAuth();
  const { colors } = useTheme();

  const modeParam = firstParam(params.mode);
  const yearParam = firstParam(params.year);
  const monthIndexParam = firstParam(params.monthIndex);
  const periodLabel = firstParam(params.periodLabel) ?? '선택한 기간';

  const insightsWindow = useMemo(
    () =>
      parseInsightsWindow({
        mode: modeParam,
        year: yearParam,
        monthIndex: monthIndexParam,
      }),
    [modeParam, yearParam, monthIndexParam],
  );

  const windowKey = insightsWindow
    ? insightsWindow.mode === 'month'
      ? `${insightsWindow.mode}:${insightsWindow.year}:${insightsWindow.monthIndex}`
      : `${insightsWindow.mode}:${insightsWindow.year}`
    : '';

  const accountId = account?.id;
  const accountRef = useRef(account);
  accountRef.current = account;
  const insightsWindowRef = useRef(insightsWindow);
  insightsWindowRef.current = insightsWindow;

  const loadInFlightRef = useRef(false);
  const mountedRef = useRef(true);
  const hasDataRef = useRef(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown | null>(null);
  const [summaries, setSummaries] = useState<MoodInsightSummaryRow[]>([]);
  const [expandedKey, setExpandedKey] = useState<ExpenseMoodKey | null>(null);

  const [cachedExpenses, setCachedExpenses] = useState<Awaited<ReturnType<typeof expenseService.getByAccountIdInRange>>>([]);
  const [cachedReviews, setCachedReviews] = useState<Awaited<ReturnType<typeof reviewService.getByAccountId>>>([]);

  const detailsByMood = useMemo(() => {
    const map = new Map<ExpenseMoodKey, MoodInsightDetail>();
    for (const row of summaries) {
      map.set(row.moodKey, buildMoodInsightDetailForMood(row.moodKey, cachedExpenses, cachedReviews));
    }
    return map;
  }, [summaries, cachedExpenses, cachedReviews]);

  const moodRecordCount = useMemo(
    () => summaries.reduce((sum, row) => sum + row.totalCount, 0),
    [summaries],
  );
  const moodRegretCount = useMemo(
    () => summaries.reduce((sum, row) => sum + row.regretCount, 0),
    [summaries],
  );
  const totalSpendKrw = useMemo(
    () => summaries.reduce((sum, row) => sum + row.totalSpendKrw, 0),
    [summaries],
  );
  const overallRegretRate = moodRecordCount > 0 ? (moodRegretCount / moodRecordCount) * 100 : 0;

  const headline = useMemo(
    () =>
      buildMoodInsightHeadline(
        summaries.map((row) => ({
          mood: row.moodKey,
          totalCount: row.totalCount,
          regretCount: row.regretCount,
          regretRate: row.regretRate,
        })),
      ),
    [summaries],
  );

  const keywords = useMemo(
    () => buildRegretKeywordChips(cachedExpenses, cachedReviews),
    [cachedExpenses, cachedReviews],
  );

  const selectedDetail = expandedKey ? detailsByMood.get(expandedKey) ?? null : null;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    hasDataRef.current = false;
    setSummaries([]);
    setExpandedKey(null);
  }, [windowKey]);

  const load = useCallback(async () => {
    const acct = accountRef.current;
    const window = insightsWindowRef.current;
    if (!acct?.id || !window) {
      if (mountedRef.current) {
        setLoading(false);
      }
      return;
    }
    if (loadInFlightRef.current) return;
    loadInFlightRef.current = true;

    const background = hasDataRef.current;

    try {
      if (!background && mountedRef.current) {
        setLoading(true);
      }
      if (mountedRef.current) {
        setError(null);
      }
      const { start, end } = boundsForInsightsWindow(window, acct);
      const [expenses, reviews] = await Promise.all([
        expenseService.getByAccountIdInRange(acct.id, start, end),
        reviewService.getByAccountId(acct.id),
      ]);
      const periodReviews = reviews.filter((r) => r.reviewedAt >= start && r.reviewedAt <= end);

      if (mountedRef.current) {
        setCachedExpenses(expenses);
        setCachedReviews(periodReviews);
        setSummaries(buildMoodInsightSummaries(expenses, periodReviews));
        hasDataRef.current = true;
      }
    } catch (err) {
      console.error('[mood-insights] load failed', err);
      if (mountedRef.current) {
        setError(err);
        setSummaries([]);
      }
    } finally {
      loadInFlightRef.current = false;
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [accountId, windowKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const selectMood = (moodKey: ExpenseMoodKey) => {
    setExpandedKey((prev) => (prev === moodKey ? null : moodKey));
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SubScreenHeader title="기분별 후회 분석" fallbackHref="/(tabs)/insights" />

      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 12 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : error ? (
          <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.emptyTitle, { color: colors.text }]} numberOfLines={1}>
              불러오지 못했어요
            </Text>
            <Text style={[styles.emptyDesc, { color: colors.textSec }]} numberOfLines={2}>
              {toUserMessage(error)}
            </Text>
          </View>
        ) : (
          <View style={styles.stack}>
            <MoodInsightHeroCard
              periodLabel={periodLabel}
              regretRate={overallRegretRate}
              regretCount={moodRegretCount}
              recordCount={moodRecordCount}
              totalSpendKrw={totalSpendKrw}
              headline={headline}
            />

            <MoodInsightPatternOverview
              rows={summaries}
              selectedKey={expandedKey}
              onSelect={selectMood}
            />

            {selectedDetail ? <MoodInsightDetailPanel detail={selectedDetail} /> : null}

            <MoodInsightKeywordCard keywords={keywords} />
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  stack: { gap: 8 },
  center: { paddingVertical: 32, alignItems: 'center' },
  empty: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    gap: 4,
  },
  emptyTitle: { fontSize: 14, fontWeight: '900' },
  emptyDesc: { fontSize: 12, fontWeight: '600' },
});
