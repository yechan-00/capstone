import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { subDays } from 'date-fns';
import { expenseService } from '@/services/expenseService';
import { reviewService } from '@/services/reviewService';
import { scheduleService } from '@/services/scheduleService';
import { shareService } from '@/services/shareService';
import type { Expense, GuestComment, Review, ReviewSchedule } from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';
import { expenseCategoryLabel } from '@/lib/expenseCategoryLabel';
import { parseExpenseReason } from '@/lib/expenseReasonParse';
import { computeSimilarExpensePattern } from '@/lib/similarExpensePattern';
import { shareExpenseLink } from '@/lib/shareLinks';
import { showAlert } from '@/utils/alert';
import { getExpenseImageUrls } from '@/utils/expenseImage';
import { firstParam } from '@/utils/routerParams';
import { useExpenseDetailPalette } from '@/theme/expenseDetailTheme';
import { PhotoViewerModal } from '@/components/PhotoViewerModal';
import { ExpenseDetailHeader } from '@/components/expenseDetail/ExpenseDetailHeader';
import { ExpenseIdentitySection } from '@/components/expenseDetail/ExpenseIdentitySection';
import { ExpenseReasonSection } from '@/components/expenseDetail/ExpenseReasonSection';
import { ExpenseReviewSection } from '@/components/expenseDetail/ExpenseReviewSection';
import { SimilarExpensePatternCard } from '@/components/expenseDetail/SimilarExpensePatternCard';
import { ExpenseCommentSection } from '@/components/expenseDetail/ExpenseCommentSection';

function expenseDetailTitle(expense: Expense): string {
  const item = expense.item?.trim();
  if (item) return item;
  const content = expense.content?.trim();
  if (content) return content;
  return expenseCategoryLabel(expense.category);
}

export default function ExpenseDetailScreen() {
  const rawParams = useLocalSearchParams<{ id: string; scheduleId?: string | string[] }>();
  const id = firstParam(rawParams.id);
  const scheduleId = firstParam(rawParams.scheduleId);
  const router = useRouter();
  const { account, user } = useAuth();
  const insets = useSafeAreaInsets();
  const palette = useExpenseDetailPalette();

  const [expense, setExpense] = useState<Expense | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [schedules, setSchedules] = useState<ReviewSchedule[]>([]);
  const [recentExpenses, setRecentExpenses] = useState<Expense[]>([]);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [comments, setComments] = useState<GuestComment[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [similarReviewsByExpenseId, setSimilarReviewsByExpenseId] = useState<Map<string, Review>>(
    () => new Map(),
  );
  const [similarReviewsReady, setSimilarReviewsReady] = useState(false);
  const [headerCompact, setHeaderCompact] = useState(false);
  const headerCompactRef = useRef(false);
  const scrollYRef = useRef(0);
  const identityTopRef = useRef<number | null>(null);
  const headingBottomRef = useRef<number | null>(null);

  const syncHeaderCompact = useCallback(() => {
    const top = identityTopRef.current;
    const bottom = headingBottomRef.current;
    const next = top != null && bottom != null && scrollYRef.current >= top + bottom;
    if (next === headerCompactRef.current) return;
    headerCompactRef.current = next;
    setHeaderCompact(next);
  }, []);

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      scrollYRef.current = event.nativeEvent.contentOffset.y;
      syncHeaderCompact();
    },
    [syncHeaderCompact],
  );

  useEffect(() => {
    if (scheduleId && id) {
      router.replace({ pathname: '/review', params: { expenseId: id, scheduleId } });
    }
  }, [scheduleId, id, router]);

  useFocusEffect(
    useCallback(() => {
      if (!id || !account?.id || scheduleId) return;
      void loadData();
    }, [id, account?.id, scheduleId]),
  );

  const loadData = async () => {
    if (!id || !account?.id) return;

    try {
      setLoading((prev) => (expense ? prev : true));
      const expenseData = await expenseService.getById(id);
      if (!expenseData) {
        showAlert('오류', '소비 내역을 찾을 수 없습니다.');
        router.back();
        return;
      }
      setExpense(expenseData);

      const [reviewsData, rangeExpenses] = await Promise.all([
        reviewService.getByExpenseId(id, account.id),
        expenseService.getByAccountIdInRange(
          account.id,
          subDays(new Date(), 30),
          new Date(),
        ),
      ]);
      setReviews(reviewsData);
      setRecentExpenses(rangeExpenses);

      try {
        const schedulesData = await scheduleService.getSchedulesByExpenseId(id, account.id);
        setSchedules(schedulesData);
      } catch (scheduleErr) {
        console.warn('[expense detail] schedules load failed', scheduleErr);
        setSchedules([]);
      }

      if (user?.uid) {
        try {
          const token = await shareService.findShareTokenForExpense(id, user.uid);
          setShareToken(token);
          if (token) {
            setCommentsLoading(true);
            const guestComments = await shareService.listGuestComments(token);
            setComments(guestComments);
          } else {
            setComments([]);
          }
        } catch (shareErr) {
          console.warn('[expense detail] share/comments load failed', shareErr);
          setShareToken(null);
          setComments([]);
        } finally {
          setCommentsLoading(false);
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '데이터를 불러오는데 실패했습니다.';
      showAlert('오류', message);
    } finally {
      setLoading(false);
    }
  };

  const reasonParts = useMemo(
    () => (expense ? parseExpenseReason(expense.reason) : { chips: [], detail: '' }),
    [expense],
  );

  const title = expense ? expenseDetailTitle(expense) : '';
  const showCategoryInMeta = Boolean(expense?.item?.trim() || expense?.content?.trim());
  const photoUrls = useMemo(() => getExpenseImageUrls(expense), [expense]);

  const memoText = useMemo(() => {
    const memo = reasonParts.detail.trim();
    if (!memo || memo === title) return null;
    return memo;
  }, [reasonParts.detail, title]);

  const summaryText = useMemo(() => {
    const summary = expense?.summaryLine?.trim() ?? '';
    if (!summary || summary === title) return null;
    if (memoText && summary === memoText) return null;
    return summary;
  }, [expense?.summaryLine, title, memoText]);

  const similarPattern = useMemo(() => {
    if (!expense) return null;
    return computeSimilarExpensePattern(expense, recentExpenses);
  }, [expense, recentExpenses]);

  useEffect(() => {
    if (!account?.id || !similarPattern) {
      setSimilarReviewsByExpenseId(new Map());
      setSimilarReviewsReady(false);
      return;
    }

    let cancelled = false;
    setSimilarReviewsReady(false);
    void reviewService
      .getLatestByExpenseIds(
        account.id,
        similarPattern.items.map((item) => item.id),
      )
      .then((map) => {
        if (cancelled) return;
        setSimilarReviewsByExpenseId(map);
        setSimilarReviewsReady(true);
      })
      .catch((error) => {
        console.warn('[expense detail] similar reviews load failed', error);
        if (cancelled) return;
        setSimilarReviewsByExpenseId(new Map());
        setSimilarReviewsReady(false);
      });

    return () => {
      cancelled = true;
    };
  }, [account?.id, similarPattern]);

  const handleShare = async () => {
    if (!account?.id || !user?.uid || !expense || sharing) return;
    try {
      setSharing(true);
      const shareTitle =
        (expense.item ?? expense.content)?.trim() || expenseCategoryLabel(expense.category);
      const subtitle = expense.summaryLine?.trim() || expense.reason?.trim() || shareTitle;
      const { webUrl, token } = await shareService.getOrCreateExpenseShare({
        expenseId: expense.id,
        accountId: account.id,
        userId: user.uid,
        title: shareTitle,
        subtitle,
        amount: expense.amount,
        category: expense.category === 'food' ? 'takeout' : expense.category,
        imageUrl: expense.imageUrl,
        spentAt: expense.spentAt,
      });
      setShareToken(token);
      await shareExpenseLink({
        title: shareTitle,
        subtitle,
        amount: expense.amount,
        category: expense.category === 'food' ? 'takeout' : expense.category,
        webUrl,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '공유 링크를 만들지 못했습니다.';
      showAlert('공유', message);
    } finally {
      setSharing(false);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  };

  const handleEdit = () => {
    if (!expense) return;
    router.push(`/edit-expense/${expense.id}`);
  };

  const handleDelete = () => {
    if (!expense) return;
    const preview = title.slice(0, 80) + (title.length > 80 ? '…' : '');
    showAlert(
      '소비 삭제',
      `이 기록을 삭제할까요?\n연결된 리뷰·알림 예약도 함께 지워져요.\n\n${preview}`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await expenseService.delete(expense.id);
                (globalThis as { __reloadPendingReviewCount?: () => void }).__reloadPendingReviewCount?.();
                if (router.canGoBack()) router.back();
                else router.replace('/(tabs)');
              } catch (err: unknown) {
                console.error('[expense detail] delete failed', err);
                showAlert('삭제 실패', '소비를 삭제하지 못했어요. 네트워크를 확인해 주세요.');
              }
            })();
          },
        },
      ],
    );
  };

  const handleReviewPress = (targetScheduleId: string) => {
    if (!expense) return;
    router.push({
      pathname: '/review',
      params: { expenseId: expense.id, scheduleId: targetScheduleId },
    });
  };

  if (scheduleId) {
    return (
      <View style={[styles.center, { backgroundColor: palette.bg }]}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: palette.bg }]}>
        <ActivityIndicator size="large" color={palette.primary} />
      </View>
    );
  }

  if (!expense) return null;

  const categoryLabel = expenseCategoryLabel(expense.category);

  return (
    <View
      style={[
        styles.container,
        {
          paddingTop: insets.top,
          backgroundColor: palette.bg,
        },
      ]}
    >
      <View
        style={[
          styles.header,
          { borderBottomColor: headerCompact ? palette.headerDivider : 'transparent' },
        ]}
      >
        <ExpenseDetailHeader
          onBack={handleBack}
          onShare={() => void handleShare()}
          sharing={sharing}
          onEdit={handleEdit}
          onDelete={handleDelete}
          compactTitle={title}
          compactAmountLabel={`${expense.amount.toLocaleString()}원`}
          compactVisible={headerCompact}
        />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: Math.max(insets.bottom, 20) + 12 },
        ]}
        showsVerticalScrollIndicator={false}
        nestedScrollEnabled
        onScroll={handleScroll}
        scrollEventThrottle={32}
      >
        <View
          onLayout={(event) => {
            identityTopRef.current = event.nativeEvent.layout.y;
            syncHeaderCompact();
          }}
        >
          <ExpenseIdentitySection
            title={title}
            categoryLabel={categoryLabel}
            showCategoryInMeta={showCategoryInMeta}
            amount={expense.amount}
            spentAt={expense.spentAt}
            imageUrls={photoUrls}
            onPhotoPress={
              photoUrls.length > 0
                ? (uri) => {
                    setViewerUri(uri);
                    setViewerOpen(true);
                  }
                : undefined
            }
            onHeadingBottom={(bottomY) => {
              headingBottomRef.current = bottomY;
              syncHeaderCompact();
            }}
          />
        </View>

        <ExpenseReasonSection
          reasonChips={reasonParts.chips}
          tags={expense.tags}
          memo={memoText}
          summaryLine={summaryText}
        />

        <ExpenseReviewSection
          reviews={reviews}
          schedules={schedules}
          onReviewPress={handleReviewPress}
        />

        <SimilarExpensePatternCard
          pattern={similarPattern}
          currentExpenseId={expense.id}
          reviewsByExpenseId={similarReviewsByExpenseId}
          reviewsReady={similarReviewsReady}
        />

        <ExpenseCommentSection
          isShared={Boolean(shareToken)}
          loading={commentsLoading}
          comments={comments}
          sharing={sharing}
          onShare={() => void handleShare()}
        />
      </ScrollView>

      <PhotoViewerModal
        visible={viewerOpen}
        uri={viewerUri}
        accessibilityLabel={`${title} 사진`}
        onClose={() => setViewerOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  /** 기존 스크롤 안 헤더와 같은 위치: 좌우 20, 위 4 (헤더 행 아래 marginBottom 8은 컴포넌트 유지) */
  header: {
    paddingHorizontal: 20,
    paddingTop: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  scroll: { flex: 1 },
  content: {
    paddingHorizontal: 20,
  },
});
