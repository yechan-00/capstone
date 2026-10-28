import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { useRefreshPendingReviewCountOnFocus, usePendingReviewCount } from '@/hooks/usePendingReviewCount';
import { scheduleService } from '@/services/scheduleService';
import { expenseService } from '@/services/expenseService';
import { ensureReviewSchedulesForAccount } from '@/services/reviewScheduleBackfill';
import { ErrorRetryCard } from '@/components/ErrorRetryCard';
import { PhotoViewerModal } from '@/components/PhotoViewerModal';
import { ReviewModeTabs, type ReviewListMode } from '@/components/ReviewModeTabs';
import { ReviewMonthHeader } from '@/components/ReviewMonthHeader';
import {
  ReviewCompletedCard,
  ReviewEmptyState,
  ReviewPastCard,
  ReviewPendingCard,
  type CompletedReviewItem,
  type ReviewItem,
} from '@/components/reviews/ReviewListCards';
import { reviewService } from '@/services/reviewService';
import { toUserMessage } from '@/utils/error';
import { useTheme } from '@/theme/ThemeContext';
import type { Expense, Review, ReviewSchedule } from '@/lib/types';
import { expenseCardSubtitle, expenseCardTitle } from '@/lib/expenseDisplay';
import { scheduleRemainingLabel } from '@/lib/scheduleLabels';
import { formatMonthGroupLabel, isFutureCalendarMonth, monthGroupKey } from '@/lib/reviewWindow';
import { loadReviewFavorites, toggleReviewFavorite } from '@/lib/reviewFavorites';

const TAB_BAR_HEIGHT = 76;

type MonthSection = {
  key: string;
  title: string;
  data: ReviewItem[];
};

type LikedEntry =
  | { kind: 'schedule'; item: ReviewItem }
  | { kind: 'completed'; item: CompletedReviewItem };

type LikedSection = {
  key: string;
  title: string;
  data: LikedEntry[];
};

function likedEntryDate(entry: LikedEntry): Date {
  return entry.kind === 'completed' ? entry.item.reviewedAt : entry.item.spentAt;
}

function likedEntryKey(entry: LikedEntry): string {
  return entry.kind === 'completed' ? entry.item.scheduleId : entry.item.id;
}

function groupLikedEntries(entries: LikedEntry[]): LikedSection[] {
  const byMonth = new Map<string, LikedEntry[]>();
  for (const entry of entries) {
    const key = monthGroupKey(likedEntryDate(entry));
    const list = byMonth.get(key) ?? [];
    list.push(entry);
    byMonth.set(key, list);
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, data]) => ({
      key,
      title: formatMonthGroupLabel(key),
      data: data.sort((a, b) => likedEntryDate(b).getTime() - likedEntryDate(a).getTime()),
    }));
}

function buildCompletedReviewItem(review: Review, expense: Expense | undefined): CompletedReviewItem {
  return {
    reviewId: review.id,
    scheduleId: review.scheduleId,
    expenseId: review.expenseId,
    title: expenseCardTitle(expense),
    subtitle: expenseCardSubtitle(expense),
    amount: expense?.amount,
    category: expense?.category ?? 'takeout',
    imageUrl: expense?.imageUrl ?? null,
    satisfaction: review.satisfaction,
    reviewedAt: review.reviewedAt,
    spentAt: expense?.spentAt ?? review.reviewedAt,
    notes: review.notes,
    regretReasons: review.regretReasons ?? [],
  };
}

function buildReviewItem(
  schedule: ReviewSchedule,
  expense: Expense | undefined,
  remainingLabel: string,
): ReviewItem {
  return {
    id: schedule.id,
    expenseId: schedule.expenseId,
    title: expenseCardTitle(expense),
    subtitle: expenseCardSubtitle(expense),
    amount: expense?.amount,
    category: expense?.category ?? 'takeout',
    imageUrl: expense?.imageUrl ?? null,
    remainingLabel,
    spentAt: expense?.spentAt ?? schedule.dueAt,
  };
}

function groupByMonth(items: ReviewItem[]): MonthSection[] {
  const byMonth = new Map<string, ReviewItem[]>();
  for (const item of items) {
    const key = monthGroupKey(item.spentAt);
    const list = byMonth.get(key) ?? [];
    list.push(item);
    byMonth.set(key, list);
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, data]) => ({
      key,
      title: formatMonthGroupLabel(key),
      data: data.sort((a, b) => b.spentAt.getTime() - a.spentAt.getTime()),
    }));
}

export default function ReviewsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { account } = useAuth();
  const { refresh: refreshPendingReviewCount } = usePendingReviewCount();
  useRefreshPendingReviewCountOnFocus();
  const { colors, isDark } = useTheme();
  const [mode, setMode] = React.useState<ReviewListMode>('pending');
  const [headerScrolled, setHeaderScrolled] = React.useState(false);
  const headerScrolledRef = React.useRef(false);
  const handleListScroll = React.useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = event.nativeEvent.contentOffset.y > 2;
    if (next === headerScrolledRef.current) return;
    headerScrolledRef.current = next;
    setHeaderScrolled(next);
  }, []);
  React.useEffect(() => {
    headerScrolledRef.current = false;
    setHeaderScrolled(false);
  }, [mode]);
  const [pendingItems, setPendingItems] = React.useState<ReviewItem[]>([]);
  const [pastItems, setPastItems] = React.useState<ReviewItem[]>([]);
  const [favoriteIds, setFavoriteIds] = React.useState<Set<string>>(() => new Set());
  const [historyMonth, setHistoryMonth] = React.useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [historyItems, setHistoryItems] = React.useState<CompletedReviewItem[]>([]);
  const [likedCompletedItems, setLikedCompletedItems] = React.useState<CompletedReviewItem[]>([]);
  const [historyLoading, setHistoryLoading] = React.useState(false);
  const [historyError, setHistoryError] = React.useState<unknown | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<unknown | null>(null);
  const [photoUri, setPhotoUri] = React.useState<string | null>(null);

  const listBottomPad = insets.bottom + TAB_BAR_HEIGHT + 16;

  const loadFavorites = React.useCallback(async () => {
    if (!account) return;
    const ids = await loadReviewFavorites(account.id);
    setFavoriteIds(ids);
  }, [account?.id]);

  const loadHistory = React.useCallback(async () => {
    if (!account) return;
    try {
      setHistoryLoading(true);
      setHistoryError(null);
      const reviews = await reviewService.getByAccountIdInMonth(
        account.id,
        historyMonth.getFullYear(),
        historyMonth.getMonth(),
      );
      const expenseIds = [...new Set(reviews.map((review) => review.expenseId))];
      const expenseById = new Map(
        (
          await Promise.all(
            expenseIds.map(async (expenseId) => {
              const expense = await expenseService.getById(expenseId);
              return expense ? ([expenseId, expense] as const) : null;
            }),
          )
        ).filter((entry): entry is [string, Expense] => entry != null),
      );
      setHistoryItems(
        reviews.map((review) => buildCompletedReviewItem(review, expenseById.get(review.expenseId))),
      );
    } catch (err) {
      console.error('[reviews] history load failed', err);
      setHistoryError(err);
      setHistoryItems([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [account?.id, historyMonth]);

  const loadLikedCompleted = React.useCallback(async () => {
    if (!account || favoriteIds.size === 0) {
      setLikedCompletedItems([]);
      return;
    }

    const completedFavoriteIds = [...favoriteIds].filter(
      (id) => !pendingItems.some((item) => item.id === id) && !pastItems.some((item) => item.id === id),
    );
    if (completedFavoriteIds.length === 0) {
      setLikedCompletedItems([]);
      return;
    }

    try {
      const byScheduleId = new Map<string, CompletedReviewItem>();
      for (const item of historyItems) {
        if (completedFavoriteIds.includes(item.scheduleId)) {
          byScheduleId.set(item.scheduleId, item);
        }
      }

      const missingIds = completedFavoriteIds.filter((id) => !byScheduleId.has(id));
      if (missingIds.length > 0) {
        const reviews = await reviewService.getByScheduleIds(account.id, missingIds);
        const expenseIds = [...new Set(reviews.map((review) => review.expenseId))];
        const expenseById = new Map(
          (
            await Promise.all(
              expenseIds.map(async (expenseId) => {
                const expense = await expenseService.getById(expenseId);
                return expense ? ([expenseId, expense] as const) : null;
              }),
            )
          ).filter((entry): entry is [string, Expense] => entry != null),
        );
        for (const review of reviews) {
          byScheduleId.set(
            review.scheduleId,
            buildCompletedReviewItem(review, expenseById.get(review.expenseId)),
          );
        }
      }

      setLikedCompletedItems(
        [...byScheduleId.values()].sort((a, b) => b.reviewedAt.getTime() - a.reviewedAt.getTime()),
      );
    } catch (err) {
      console.warn('[reviews] liked completed load failed', err);
      setLikedCompletedItems(
        historyItems.filter((item) => completedFavoriteIds.includes(item.scheduleId)),
      );
    }
  }, [account?.id, favoriteIds, pendingItems, pastItems, historyItems]);

  const load = async () => {
    if (!account) return;
    try {
      setLoading(true);
      setError(null);
      await Promise.all([ensureReviewSchedulesForAccount(account.id), loadFavorites()]);
      const schedules = await scheduleService.getPendingSchedules(account.id);
      let expiredSchedules: Awaited<ReturnType<typeof scheduleService.getExpiredReviewSchedules>> = [];
      try {
        expiredSchedules = await scheduleService.getExpiredReviewSchedules(account.id);
      } catch (pastErr) {
        console.warn('[reviews] past schedules load failed', pastErr);
      }
      const expenseIds = [...new Set([...schedules, ...expiredSchedules].map((s) => s.expenseId))];
      const expenseById = new Map(
        (
          await Promise.all(
            expenseIds.map(async (expenseId) => {
              const expense = await expenseService.getById(expenseId);
              return expense ? ([expenseId, expense] as const) : null;
            }),
          )
        ).filter((entry): entry is [string, Expense] => entry != null),
      );

      setPendingItems(
        schedules.map((schedule) =>
          buildReviewItem(schedule, expenseById.get(schedule.expenseId), scheduleRemainingLabel(schedule)),
        ),
      );
      setPastItems(
        expiredSchedules.map((schedule) =>
          buildReviewItem(schedule, expenseById.get(schedule.expenseId), '마감'),
        ),
      );
      void refreshPendingReviewCount();
    } catch (err) {
      console.error('[reviews] load failed', err);
      setError(err);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    if (account) void load();
  }, [account]);

  useFocusEffect(
    React.useCallback(() => {
      if (!account) return;
      void load();
      if (mode === 'history') void loadHistory();
    }, [account, mode, loadHistory]),
  );

  React.useEffect(() => {
    if (mode === 'history' && account) void loadHistory();
  }, [mode, account, loadHistory]);

  React.useEffect(() => {
    if (!account) return;
    void loadLikedCompleted();
  }, [account, loadLikedCompleted]);

  const canGoNextHistoryMonth = !isFutureCalendarMonth(
    new Date(historyMonth.getFullYear(), historyMonth.getMonth() + 1, 1),
  );

  const handleHeartToggle = async (scheduleId: string) => {
    if (!account) return;
    const next = await toggleReviewFavorite(account.id, scheduleId, favoriteIds);
    setFavoriteIds(next);
  };

  const handleReview = (item: ReviewItem) => {
    router.push({ pathname: '/review', params: { expenseId: item.expenseId, scheduleId: item.id } });
  };

  const handleExpenseOpen = (expenseId: string) => {
    router.push({ pathname: '/expense/[id]', params: { id: expenseId } });
  };

  const refreshAll = async () => {
    await load();
    if (mode === 'history') await loadHistory();
    await loadLikedCompleted();
  };

  const likedEntries = React.useMemo(() => {
    const entries: LikedEntry[] = [];
    for (const item of pendingItems) {
      if (favoriteIds.has(item.id)) entries.push({ kind: 'schedule', item });
    }
    for (const item of pastItems) {
      if (favoriteIds.has(item.id)) entries.push({ kind: 'schedule', item });
    }
    for (const item of likedCompletedItems) {
      if (favoriteIds.has(item.scheduleId)) entries.push({ kind: 'completed', item });
    }
    return entries.sort((a, b) => likedEntryDate(b).getTime() - likedEntryDate(a).getTime());
  }, [pendingItems, pastItems, likedCompletedItems, favoriteIds]);

  const pastSections = React.useMemo(() => groupByMonth(pastItems), [pastItems]);
  const likedSections = React.useMemo(() => groupLikedEntries(likedEntries), [likedEntries]);
  const pendingIdSet = React.useMemo(() => new Set(pendingItems.map((item) => item.id)), [pendingItems]);

  const listHeader = (
    <View
      style={[
        styles.pageHeader,
        {
          paddingTop: 8,
          backgroundColor: colors.bg,
          borderBottomColor: headerScrolled ? colors.headerDivider : 'transparent',
        },
      ]}
    >
      <Text style={[styles.pageTitle, { color: colors.text }]}>리뷰</Text>
      <Text style={[styles.pageSub, { color: colors.textSec }]}>시간이 지난 소비를 다시 돌아보세요.</Text>
      {mode === 'liked' ? (
        <Text style={[styles.likedHint, { color: colors.textMuted }]}>
          다시 보고 싶은 소비의 순간들을 모아두었어요.
        </Text>
      ) : null}
      <View style={styles.tabsWrap}>
        <ReviewModeTabs
          mode={mode}
          onChange={setMode}
          colors={colors}
          isDark={isDark}
          pendingCount={pendingItems.length}
          likedCount={likedEntries.length}
          historyCount={historyItems.length}
        />
      </View>
    </View>
  );

  const renderPendingCard = (item: ReviewItem) => (
    <ReviewPendingCard
      item={item}
      colors={colors}
      isDark={isDark}
      heartOn={favoriteIds.has(item.id)}
      onHeartToggle={() => void handleHeartToggle(item.id)}
      onReview={() => handleReview(item)}
      onOpenPhoto={setPhotoUri}
    />
  );

  const renderPastCard = (item: ReviewItem) => (
    <ReviewPastCard
      item={item}
      colors={colors}
      isDark={isDark}
      heartOn={favoriteIds.has(item.id)}
      onHeartToggle={() => void handleHeartToggle(item.id)}
      onReview={() => handleReview(item)}
      onOpenPhoto={setPhotoUri}
    />
  );

  const historyHeader = (
    <ReviewMonthHeader
      month={historyMonth}
      colors={colors}
      canGoNext={canGoNextHistoryMonth}
      onPrev={() => setHistoryMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
      onNext={() => {
        if (!canGoNextHistoryMonth) return;
        setHistoryMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
      }}
    />
  );

  if (loading && pendingItems.length === 0 && pastItems.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        {listHeader}
        <View style={styles.centerBody}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
        {listHeader}
        <View style={styles.centerBody}>
          <ErrorRetryCard title="리뷰 목록을 불러오지 못했어요" desc={toUserMessage(error)} onRetry={refreshAll} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bg, paddingTop: insets.top }]}>
      {listHeader}
      {mode === 'pending' ? (
        <FlatList
          style={styles.list}
          onScroll={handleListScroll}
          scrollEventThrottle={32}
          data={pendingItems}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <View style={styles.cardWrap}>{renderPendingCard(item)}</View>}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: listBottomPad },
            pendingItems.length === 0 && styles.listContentGrow,
          ]}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshAll} tintColor={colors.primary} />}
          ListEmptyComponent={
            <ReviewEmptyState
              icon="rate-review"
              title="지금은 돌아볼 소비가 없어요."
              desc="평가할 시간이 되면 이곳에서 확인할 수 있어요."
              hint="평가 시간이 지나도 지나간 리뷰에서 계속 평가할 수 있어요."
              ctaLabel="소비 기록하기"
              onCta={() => router.push('/add-expense')}
              colors={colors}
            />
          }
        />
      ) : null}

      {mode === 'past' ? (
        <SectionList
          style={styles.list}
          onScroll={handleListScroll}
          scrollEventThrottle={32}
          sections={pastSections}
          keyExtractor={(item) => item.id}
          renderSectionHeader={({ section }) => (
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.title}</Text>
          )}
          renderItem={({ item }) => <View style={styles.cardWrap}>{renderPastCard(item)}</View>}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: listBottomPad },
            pastItems.length === 0 && styles.listContentGrow,
          ]}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshAll} tintColor={colors.primary} />}
          ListEmptyComponent={
            <ReviewEmptyState
              icon="history"
              title="지난 평가가 없어요"
              desc="예정된 시점이 지난 소비가 있으면 여기에서 평가할 수 있어요."
              colors={colors}
            />
          }
        />
      ) : null}

      {mode === 'liked' ? (
        <SectionList
          style={styles.list}
          onScroll={handleListScroll}
          scrollEventThrottle={32}
          sections={likedSections}
          keyExtractor={(entry) => likedEntryKey(entry)}
          renderSectionHeader={({ section }) => (
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.title}</Text>
          )}
          renderItem={({ item: entry }) => (
            <View style={styles.cardWrap}>
              {entry.kind === 'completed' ? (
                <ReviewCompletedCard
                  item={entry.item}
                  colors={colors}
                  isDark={isDark}
                  heartOn={favoriteIds.has(entry.item.scheduleId)}
                  onHeartToggle={() => void handleHeartToggle(entry.item.scheduleId)}
                  onPress={() => handleExpenseOpen(entry.item.expenseId)}
                  onOpenPhoto={setPhotoUri}
                />
              ) : pendingIdSet.has(entry.item.id) ? (
                renderPendingCard(entry.item)
              ) : (
                renderPastCard(entry.item)
              )}
            </View>
          )}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: listBottomPad },
            likedEntries.length === 0 && styles.listContentGrow,
          ]}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshAll} tintColor={colors.primary} />}
          ListEmptyComponent={
            <ReviewEmptyState
              icon="favorite-border"
              title="좋아요한 리뷰가 없어요"
              desc="카드의 하트를 누르면 여기에 모아볼 수 있어요."
              colors={colors}
            />
          }
        />
      ) : null}

      {mode === 'history' ? (
        <FlatList
          style={styles.list}
          onScroll={handleListScroll}
          scrollEventThrottle={32}
          data={historyItems}
          keyExtractor={(item) => item.reviewId}
          ListHeaderComponent={historyHeader}
          renderItem={({ item }) => (
            <View style={styles.cardWrap}>
              <ReviewCompletedCard
                item={item}
                colors={colors}
                isDark={isDark}
                heartOn={favoriteIds.has(item.scheduleId)}
                onHeartToggle={() => void handleHeartToggle(item.scheduleId)}
                onPress={() => handleExpenseOpen(item.expenseId)}
                onOpenPhoto={setPhotoUri}
              />
            </View>
          )}
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: listBottomPad },
            historyItems.length === 0 && !historyLoading && styles.listContentGrow,
          ]}
          refreshControl={
            <RefreshControl
              refreshing={historyLoading || loading}
              onRefresh={refreshAll}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            historyLoading ? (
              <View style={styles.historyLoading}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : historyError ? (
              <ReviewEmptyState
                icon="error-outline"
                title="리뷰를 불러오지 못했어요"
                desc={toUserMessage(historyError)}
                ctaLabel="다시 시도"
                onCta={() => void loadHistory()}
                colors={colors}
              />
            ) : (
              <ReviewEmptyState
                icon="collections-bookmark"
                title="이 달에 작성한 리뷰가 없어요"
                desc="화살표로 다른 달의 기록을 확인할 수 있어요."
                colors={colors}
              />
            )
          }
        />
      ) : null}

      <PhotoViewerModal
        visible={photoUri != null}
        uri={photoUri}
        accessibilityLabel="소비 사진"
        onClose={() => setPhotoUri(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1 },
  centerBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  pageHeader: {
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pageTitle: {
    paddingHorizontal: 20,
    fontSize: 26,
    fontWeight: '800',
    letterSpacing: -0.6,
  },
  pageSub: {
    marginTop: 4,
    paddingHorizontal: 20,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 20,
  },
  likedHint: {
    marginTop: 6,
    paddingHorizontal: 20,
    fontSize: 12,
    fontWeight: '600',
  },
  tabsWrap: {
    marginTop: 14,
  },
  list: { flex: 1 },
  listContent: {},
  listContentGrow: { flexGrow: 1 },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '800',
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 20,
  },
  cardWrap: {
    paddingHorizontal: 16,
    marginBottom: 14,
  },
  historyLoading: {
    paddingVertical: 32,
    alignItems: 'center',
  },
});
