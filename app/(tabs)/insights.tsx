import React, { useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { useInsights } from "@/hooks/useInsights";
import { ErrorRetryCard } from "@/components/ErrorRetryCard";
import { toUserMessage } from "@/utils/error";
import { DataQualityCard } from "@/components/DataQualityCard";
import { KeyFindingCard } from "@/components/KeyFindingCard";
import { TopListSection } from "@/components/TopListSection";
import { makePatternCopy } from "@/utils/insightsCopy";
import { useTheme } from "@/theme/ThemeContext";
import { InsightChartPlaceholder } from "@/components/InsightChartPlaceholder";

export default function InsightsScreen() {
  const { colors } = useTheme();
  const { insights, loading, error, refresh } = useInsights(30);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: colors.bg,
        },
        center: {
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
        },
        content: {
          padding: 16,
          paddingBottom: 40,
          gap: 16,
        },
        screenTitle: {
          fontSize: 18,
          fontWeight: "900",
          color: colors.text,
        },
        keyFindings: {
          gap: 12,
        },
        summary: {
          backgroundColor: colors.surface,
          borderRadius: 18,
          borderWidth: 1,
          borderColor: colors.border,
          padding: 16,
          gap: 14,
        },
        summaryRow: {
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        },
        summaryLabel: {
          color: colors.textSec,
          fontWeight: "800",
        },
        summaryValue: {
          color: colors.text,
          fontWeight: "900",
        },
        emptyText: {
          color: colors.textMuted,
          fontSize: 16,
        },
      }),
    [colors],
  );

  useFocusEffect(
    React.useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const categoryItems = useMemo(
    () =>
      (insights?.categoryInsights ?? [])
        .filter((item) => item.totalCount > 0)
        .map((item) => ({
          key: item.category,
          label: item.category,
          regretRatePercent: item.regretRate,
          regretCount: item.regretCount,
          totalCount: item.totalCount,
        })),
    [insights?.categoryInsights],
  );

  const moodItems = useMemo(
    () =>
      (insights?.moodInsights ?? [])
        .filter((item) => item.totalCount > 0)
        .map((item) => ({
          key: item.mood,
          label: item.mood,
          regretRatePercent: item.regretRate,
          regretCount: item.regretCount,
          totalCount: item.totalCount,
        })),
    [insights?.moodInsights],
  );

  const timeItems = useMemo(
    () =>
      (insights?.timeOfDayInsights ?? [])
        .filter((item) => item.totalCount > 0)
        .map((item) => ({
          key: item.timeOfDay,
          label:
            item.timeOfDay === "morning"
              ? "아침"
              : item.timeOfDay === "afternoon"
                ? "점심"
                : item.timeOfDay === "evening"
                  ? "저녁"
                  : "밤",
          regretRatePercent: item.regretRate,
          regretCount: item.regretCount,
          totalCount: item.totalCount,
        })),
    [insights?.timeOfDayInsights],
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <ErrorRetryCard
          title="인사이트를 불러오지 못했어요"
          desc={toUserMessage(error)}
          onRetry={refresh}
        />
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

  const isLowData = insights.totalExpenses < 5;
  const regretRate = insights.totalExpenses
    ? insights.totalRegrets / insights.totalExpenses
    : 0;
  const patternCopy = makePatternCopy({
    total: insights.totalExpenses,
    regretCount: insights.totalRegrets,
  });
  const repeatedWarning = [...categoryItems, ...timeItems]
    .filter((item) => item.totalCount >= 3 && item.regretRatePercent >= 60)
    .sort((a, b) => b.regretRatePercent - a.regretRatePercent)[0];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={scrollRefreshControl}
    >
      <Text style={styles.screenTitle}>인사이트</Text>

      <View style={styles.keyFindings}>
        <KeyFindingCard
          title="이번 달 요약"
          desc={`후회율 ${(regretRate * 100).toFixed(1)}% · 후회 소비 ${insights.totalRegrets}건 / 전체 ${insights.totalExpenses}건`}
        />
        <KeyFindingCard title="패턴" desc={patternCopy} />
        {repeatedWarning ? (
          <KeyFindingCard
            title="반복 패턴 경고"
            desc={`"${repeatedWarning.label}" 구간에서 후회율이 ${repeatedWarning.regretRatePercent.toFixed(1)}%로 높아요. 다음 소비 전 이 구간 체크가 필요해요.`}
          />
        ) : null}
      </View>

      {isLowData && (
        <DataQualityCard count={insights.totalExpenses} />
      )}

      <View style={styles.summary}>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>전체 소비</Text>
          <Text style={styles.summaryValue}>{insights.totalExpenses}건</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>후회 소비</Text>
          <Text style={styles.summaryValue}>{insights.totalRegrets}건</Text>
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summaryLabel}>전체 후회율</Text>
          <Text style={styles.summaryValue}>
            {(regretRate * 100).toFixed(1)}%
          </Text>
        </View>
      </View>

      <TopListSection title="카테고리별 후회율" items={categoryItems} />
      <InsightChartPlaceholder data={insights.categoryInsights} type="category" />
      <TopListSection title="기분별 후회율" items={moodItems} />
      <InsightChartPlaceholder data={insights.moodInsights} type="mood" />
      <TopListSection title="시간대별 후회율" items={timeItems} />
      <InsightChartPlaceholder data={insights.timeOfDayInsights} type="timeOfDay" />
    </ScrollView>
  );
}
