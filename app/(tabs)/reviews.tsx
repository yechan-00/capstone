import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  SectionList,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { useRefreshPendingReviewCountOnFocus, usePendingReviewCount } from '@/hooks/usePendingReviewCount';
import { scheduleService } from '@/services/scheduleService';
import { expenseService } from '@/services/expenseService';
import { ensureReviewSchedulesForAccount } from '@/services/reviewScheduleBackfill';
import { ErrorRetryCard } from '@/components/ErrorRetryCard';
import { PrimaryButton } from '@/components/PrimaryButton';
import { ReviewModeSwitcher, type ReviewListMode } from '@/components/ReviewModeSwitcher';
import { ReviewMonthHeader } from '@/components/ReviewMonthHeader';
import { reviewService } from '@/services/reviewService';
import { toUserMessage } from '@/utils/error';
import { useTheme, type ThemeColors } from '@/theme/ThemeContext';
import type { Expense, ExpenseCategory, Review, ReviewSchedule } from '@/lib/types';
import { expenseCardSubtitle, expenseCardTitle } from '@/lib/expenseDisplay';
import { scheduleRemainingLabel } from '@/lib/scheduleLabels';
import { formatMonthGroupLabel, isFutureCalendarMonth, monthGroupKey } from '@/lib/reviewWindow';
import { satisfactionLabel } from '@/lib/satisfactionScale';
import { isDisplayableImageUrl } from '@/utils/expenseImage';
import { loadReviewFavorites, toggleReviewFavorite } from '@/lib/reviewFavorites';

const NAVY_HEADER = '#2e4475';
const NAVY_HEADER_DEEP = '#24365f';
const TAB_BAR_HEIGHT = 76;
const FAB_BOTTOM_INSET = -14;
const FAB_RIGHT = 14;

type ReviewItem = {
  id: string;
  expenseId: string;
  title: string;
  subtitle: string;
  amount?: number;
  category: ExpenseCategory;
  imageUrl: string | null;
  remainingLabel: string;
  spentAt: Date;
};

type CompletedReviewItem = {
  reviewId: string;
  scheduleId: string;
  expenseId: string;
  title: string;
  subtitle: string;
  amount?: number;
  category: ExpenseCategory;
  imageUrl: string | null;
  satisfaction: number;
  reviewedAt: Date;
  spentAt: Date;
};

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

function categoryLine(category: ExpenseCategory): string {
  switch (category) {
    case 'delivery':
      return '외식(배달)';
    case 'cafe':
      return '외식(카페)';
    case 'takeout':
    case 'food':
    default:
      return '외식(포장)';
  }
}

function formatReviewDate(date: Date): string {
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
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
  };
}

function hasDisplayableImage(url: string | null | undefined): boolean {
  return isDisplayableImageUrl(url);
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

function HeartToggle({
  active,
  onPress,
  colors,
  style,
  size = 22,
  inactiveBg,
}: {
  active: boolean;
  onPress: () => void;
  colors: ThemeColors;
  style?: object;
  size?: number;
  inactiveBg?: string;
}) {
  return (
    <Pressable
      style={[
        styles.heartBtn,
        { backgroundColor: active ? '#e11d48' : (inactiveBg ?? colors.surfaceMuted) },
        style,
      ]}
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={active ? '좋아요 해제' : '좋아요'}
    >
      <MaterialIcons
        name={active ? 'favorite' : 'favorite-border'}
        size={size}
        color={active ? '#fff' : colors.textMuted}
      />
    </Pressable>
  );
}

function ReviewCardShell({
  item,
  colors,
  isDark,
  heartOn,
  onHeartToggle,
  footer,
  actions,
}: {
  item: ReviewItem;
  colors: ThemeColors;
  isDark: boolean;
  heartOn: boolean;
  onHeartToggle: () => void;
  footer: React.ReactNode;
  actions?: React.ReactNode;
}) {
  const showImage = hasDisplayableImage(item.imageUrl);
  const cat = categoryLine(item.category);
  const amountStr = item.amount != null ? `${Number(item.amount).toLocaleString()}원` : '금액 없음';

  return (
    <View
      style={[
        styles.itemCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
        !isDark && styles.itemCardElev,
      ]}
    >
      {showImage ? (
        <View style={styles.imageBlock}>
          <Image source={{ uri: item.imageUrl! }} style={styles.cardPhoto} resizeMode="cover" />
          <View style={styles.imageOverlayRow}>
            <View style={[styles.badgeOnImage, { backgroundColor: 'rgba(255,255,255,0.95)' }]}>
              <Text style={[styles.badgeOnImageText, { color: colors.text }]} numberOfLines={1}>
                {cat}
              </Text>
            </View>
            <View style={[styles.badgeOnImage, { backgroundColor: NAVY_HEADER }]}>
              <Text style={styles.badgePriceText} numberOfLines={1}>
                {amountStr}
              </Text>
            </View>
          </View>
          <HeartToggle
            active={heartOn}
            onPress={onHeartToggle}
            colors={colors}
            inactiveBg="rgba(255,255,255,0.95)"
            style={styles.heartFab}
          />
        </View>
      ) : (
        <View style={[styles.compactMetaRow, { borderBottomColor: colors.border }]}>
          <View style={styles.compactMetaLeft}>
            <View style={[styles.categoryPill, { backgroundColor: colors.surfaceMuted }]}>
              <Text style={[styles.categoryPillText, { color: colors.text }]} numberOfLines={1}>
                {cat}
              </Text>
            </View>
            <Text style={[styles.compactAmount, { color: colors.accentBlue }]} numberOfLines={1}>
              {amountStr}
            </Text>
          </View>
          <HeartToggle active={heartOn} onPress={onHeartToggle} colors={colors} style={styles.heartBtnCompact} />
        </View>
      )}

      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
          {item.title}
        </Text>
        {item.subtitle ? (
          <Text style={[styles.cardSubtitle, { color: colors.textMuted }]} numberOfLines={2}>
            {item.subtitle}
          </Text>
        ) : null}
        {footer}
        {actions}
      </View>
    </View>
  );
}

function ReviewPendingCard({
  item,
  colors,
  isDark,
  heartOn,
  onHeartToggle,
  onReview,
}: {
  item: ReviewItem;
  colors: ThemeColors;
  isDark: boolean;
  heartOn: boolean;
  onHeartToggle: () => void;
  onReview: () => void;
}) {
  const amountStr = item.amount != null ? `${Number(item.amount).toLocaleString()}원` : '금액 없음';

  const shareLine = async () => {
    try {
      await Share.share({
        message: [item.title, item.subtitle, amountStr].filter(Boolean).join('\n'),
      });
    } catch {
      /* 취소 등 */
    }
  };

  return (
    <ReviewCardShell
      item={item}
      colors={colors}
      isDark={isDark}
      heartOn={heartOn}
      onHeartToggle={onHeartToggle}
      footer={
        <View style={styles.footerTopRow}>
          <View style={styles.starsRow}>
            {[0, 1, 2, 3, 4].map((i) => (
              <MaterialIcons key={i} name="star-border" size={17} color={isDark ? '#64748b' : '#d1d5db'} />
            ))}
            <Text style={[styles.ratingHint, { color: colors.textMuted }]}>미평가</Text>
          </View>
          <View style={[styles.timePill, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
            <MaterialIcons name="schedule" size={14} color={colors.accentBlue} />
            <Text style={[styles.timePillText, { color: colors.accentBlue }]}>{item.remainingLabel}</Text>
          </View>
        </View>
      }
      actions={
        <View style={styles.actionRow}>
          <Pressable
            onPress={onReview}
            style={({ pressed }) => [
              styles.primaryCta,
              { backgroundColor: colors.accentCta, opacity: pressed ? 0.92 : 1 },
            ]}
          >
            <Text style={[styles.primaryCtaText, { color: colors.onPrimary }]}>지금 평가하기</Text>
          </Pressable>
          <Pressable
            onPress={shareLine}
            style={({ pressed }) => [
              styles.shareBtn,
              { backgroundColor: colors.surfaceMuted, borderColor: colors.border, opacity: pressed ? 0.88 : 1 },
            ]}
          >
            <MaterialIcons name="share" size={20} color={colors.textSec} />
          </Pressable>
        </View>
      }
    />
  );
}

function ReviewPastCard({
  item,
  colors,
  isDark,
  heartOn,
  onHeartToggle,
  onReview,
  showExpiredBadge = true,
}: {
  item: ReviewItem;
  colors: ThemeColors;
  isDark: boolean;
  heartOn: boolean;
  onHeartToggle: () => void;
  onReview: () => void;
  showExpiredBadge?: boolean;
}) {
  const spentLabel = formatReviewDate(item.spentAt);

  return (
    <ReviewCardShell
      item={item}
      colors={colors}
      isDark={isDark}
      heartOn={heartOn}
      onHeartToggle={onHeartToggle}
      footer={
        <View style={styles.footerTopRow}>
          <Text style={[styles.pastSpentDate, { color: colors.textSec }]}>소비일 {spentLabel}</Text>
          {showExpiredBadge ? (
            <View style={[styles.expiredPill, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
              <MaterialIcons name="event-busy" size={14} color={colors.textMuted} />
              <Text style={[styles.expiredPillText, { color: colors.textMuted }]}>리뷰 탭 기한 만료</Text>
            </View>
          ) : (
            <View style={[styles.timePill, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
              <MaterialIcons name="favorite" size={14} color="#e11d48" />
              <Text style={[styles.timePillText, { color: colors.textSec }]}>좋아요</Text>
            </View>
          )}
        </View>
      }
      actions={
        <Pressable
          onPress={onReview}
          style={({ pressed }) => [
            styles.primaryCta,
            { backgroundColor: colors.accentCta, opacity: pressed ? 0.92 : 1, marginTop: 14 },
          ]}
        >
          <Text style={[styles.primaryCtaText, { color: colors.onPrimary }]}>지금 평가하기</Text>
        </Pressable>
      }
    />
  );
}

function ReviewCompletedCard({
  item,
  colors,
  isDark,
  heartOn,
  onHeartToggle,
  onPress,
}: {
  item: CompletedReviewItem;
  colors: ThemeColors;
  isDark: boolean;
  heartOn: boolean;
  onHeartToggle: () => void;
  onPress: () => void;
}) {
  const ratingLabel = satisfactionLabel(item.satisfaction) || `${item.satisfaction}/5`;
  const reviewedLabel = formatReviewDate(item.reviewedAt);

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.96 : 1 }]}>
      <ReviewCardShell
        item={{
          id: item.scheduleId,
          expenseId: item.expenseId,
          title: item.title,
          subtitle: item.subtitle,
          amount: item.amount,
          category: item.category,
          imageUrl: item.imageUrl,
          remainingLabel: '',
          spentAt: item.spentAt,
        }}
        colors={colors}
        isDark={isDark}
        heartOn={heartOn}
        onHeartToggle={onHeartToggle}
        footer={
          <View style={styles.footerTopRow}>
            <View style={styles.starsRow}>
              {[1, 2, 3, 4, 5].map((star) => (
                <MaterialIcons
                  key={star}
                  name={star <= item.satisfaction ? 'star' : 'star-border'}
                  size={17}
                  color={star <= item.satisfaction ? '#f59e0b' : isDark ? '#64748b' : '#d1d5db'}
                />
              ))}
              <Text style={[styles.ratingHint, { color: colors.textSec }]}>{ratingLabel}</Text>
            </View>
            <Text style={[styles.pastSpentDate, { color: colors.textMuted }]}>평가 {reviewedLabel}</Text>
          </View>
        }
      />
    </Pressable>
  );
}

export default function ReviewsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { account } = useAuth();
  const { refresh: refreshPendingReviewCount } = usePendingReviewCount();
  useRefreshPendingReviewCountOnFocus();
  const { colors, isDark } = useTheme();
  const [mode, setMode] = React.useState<ReviewListMode>('pending');
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

  const listBottomPad = insets.bottom + TAB_BAR_HEIGHT + 16;
  const fabBottom = insets.bottom + FAB_BOTTOM_INSET;

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

  const renderPendingCard = (item: ReviewItem) => (
    <ReviewPendingCard
      item={item}
      colors={colors}
      isDark={isDark}
      heartOn={favoriteIds.has(item.id)}
      onHeartToggle={() => void handleHeartToggle(item.id)}
      onReview={() => handleReview(item)}
    />
  );

  const renderPastCard = (item: ReviewItem, showExpiredBadge = true) => (
    <ReviewPastCard
      item={item}
      colors={colors}
      isDark={isDark}
      heartOn={favoriteIds.has(item.id)}
      onHeartToggle={() => void handleHeartToggle(item.id)}
      onReview={() => handleReview(item)}
      showExpiredBadge={showExpiredBadge}
    />
  );

  const modeSwitcher = (
    <ReviewModeSwitcher
      mode={mode}
      onChange={setMode}
      colors={colors}
      isDark={isDark}
      bottom={fabBottom}
      right={FAB_RIGHT}
      pendingCount={pendingItems.length}
      likedCount={likedEntries.length}
      historyCount={historyItems.length}
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
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <ErrorRetryCard title="리뷰 목록을 불러오지 못했어요" desc={toUserMessage(error)} onRetry={refreshAll} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      {mode === 'pending' ? (
        <FlatList
          data={pendingItems}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <View style={styles.cardWrap}>{renderPendingCard(item)}</View>}
          contentContainerStyle={[
            styles.listContent,
            { paddingTop: 22, paddingBottom: listBottomPad },
            pendingItems.length === 0 && styles.listContentGrow,
          ]}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshAll} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>평가할 항목이 없습니다</Text>
              <Text style={[styles.emptyDesc, { color: colors.textSec }]}>
                소비 다음 날 0시부터 47시간 59분 안에 여기서 평가할 수 있어요. 기한이 지나면 지나간 리뷰로
                옮겨지지만, 홈에서 계속 평가할 수 있어요.
              </Text>
              <PrimaryButton label="소비 추가하기" onPress={() => router.push('/add-expense')} />
            </View>
          }
        />
      ) : null}

      {mode === 'past' ? (
        <SectionList
          sections={pastSections}
          keyExtractor={(item) => item.id}
          renderSectionHeader={({ section }) => (
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{section.title}</Text>
          )}
          renderItem={({ item }) => (
            <View style={styles.cardWrap}>{renderPastCard(item, true)}</View>
          )}
          contentContainerStyle={[
            styles.listContent,
            { paddingTop: 22, paddingBottom: listBottomPad },
            pastItems.length === 0 && styles.listContentGrow,
          ]}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshAll} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>지나간 리뷰가 없습니다</Text>
              <Text style={[styles.emptyDesc, { color: colors.textSec }]}>
                47시간 59분 안에 평가하지 않은 소비가 월별로 모여요.
              </Text>
            </View>
          }
        />
      ) : null}

      {mode === 'liked' ? (
        <SectionList
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
                />
              ) : pendingIdSet.has(entry.item.id) ? (
                renderPendingCard(entry.item)
              ) : (
                renderPastCard(entry.item, false)
              )}
            </View>
          )}
          contentContainerStyle={[
            styles.listContent,
            { paddingTop: 22, paddingBottom: listBottomPad },
            likedEntries.length === 0 && styles.listContentGrow,
          ]}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refreshAll} tintColor={colors.primary} />}
          ListEmptyComponent={
            <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <MaterialIcons name="favorite-border" size={36} color={colors.textMuted} />
              <Text style={[styles.emptyTitle, { color: colors.text }]}>좋아요한 리뷰가 없습니다</Text>
              <Text style={[styles.emptyDesc, { color: colors.textSec }]}>
                카드의 하트를 누르면 여기에 모아볼 수 있어요.
              </Text>
            </View>
          }
        />
      ) : null}

      {mode === 'history' ? (
        <FlatList
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
              <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>리뷰를 불러오지 못했어요</Text>
                <Text style={[styles.emptyDesc, { color: colors.textSec }]}>{toUserMessage(historyError)}</Text>
                <PrimaryButton label="다시 시도" onPress={() => void loadHistory()} />
              </View>
            ) : (
              <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>이 달에 작성한 리뷰가 없습니다</Text>
                <Text style={[styles.emptyDesc, { color: colors.textSec }]}>
                  좌우 화살표로 다른 달의 리뷰를 확인할 수 있어요.
                </Text>
              </View>
            )
          }
        />
      ) : null}

      {modeSwitcher}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  listContent: {},
  listContentGrow: { flexGrow: 1 },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '900',
    marginTop: 8,
    marginBottom: 4,
    paddingHorizontal: 16,
  },
  cardWrap: {
    paddingHorizontal: 16,
    marginBottom: 22,
  },
  itemCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  itemCardElev: {
    shadowColor: NAVY_HEADER_DEEP,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 3,
  },
  imageBlock: {
    height: 188,
    width: '100%',
    position: 'relative',
    backgroundColor: '#e8ecf4',
  },
  cardPhoto: {
    width: '100%',
    height: '100%',
  },
  imageOverlayRow: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  badgeOnImage: {
    maxWidth: '48%',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeOnImageText: { fontSize: 11, fontWeight: '800' },
  badgePriceText: { color: '#fff', fontSize: 12, fontWeight: '900' },
  heartFab: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
  },
  heartBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartBtnCompact: {
    width: 34,
    height: 34,
    borderRadius: 17,
  },
  compactMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  compactMetaLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  categoryPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    flexShrink: 1,
  },
  categoryPillText: { fontSize: 11, fontWeight: '800' },
  compactAmount: { fontSize: 14, fontWeight: '900', flexShrink: 0 },
  cardBody: {
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '900',
    letterSpacing: -0.3,
    lineHeight: 24,
  },
  cardSubtitle: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 4,
    lineHeight: 19,
  },
  footerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    marginTop: 14,
    flexWrap: 'wrap',
  },
  starsRow: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  ratingHint: { marginLeft: 6, fontSize: 12, fontWeight: '700' },
  timePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  timePillText: { fontSize: 11, fontWeight: '800' },
  pastSpentDate: { fontSize: 12, fontWeight: '700' },
  expiredPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  expiredPillText: { fontSize: 11, fontWeight: '800' },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 14,
  },
  primaryCta: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  primaryCtaText: { fontSize: 15, fontWeight: '900' },
  shareBtn: {
    width: 48,
    height: 48,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: {
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 16,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: { fontSize: 16, fontWeight: '900' },
  emptyDesc: { textAlign: 'center', lineHeight: 20, fontWeight: '600' },
  historyLoading: {
    paddingVertical: 32,
    alignItems: 'center',
  },
});
