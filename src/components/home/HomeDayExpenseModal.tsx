import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { PhotoViewerModal } from '@/components/PhotoViewerModal';
import { ReviewContainPhoto } from '@/components/ReviewContainPhoto';
import type { Expense, Review, ReviewSchedule } from '@/lib/types';
import { expenseCategoryLabel } from '@/lib/expenseCategoryLabel';
import { formatReviewWaitHint, resolveExpenseReviewState } from '@/lib/expenseReviewState';
import { reviewSentimentColors, reviewSentimentLabel } from '@/lib/reviewSentiment';
import { BRAND_GREEN, useTheme } from '@/theme/ThemeContext';
import { getExpenseImageUrls } from '@/utils/expenseImage';

type Props = {
  dayKey: string;
  expenses: Expense[];
  reviewsByExpenseId: Map<string, Review>;
  reviewSchedulesByExpenseId: Map<string, ReviewSchedule[]>;
  onClose: () => void;
  onOpenExpense: (expenseId: string) => void;
  onEditExpense: (expenseId: string) => void;
  onDeleteExpense: (expenseId: string, titlePreview: string, dayKey: string | null) => void;
  onReviewExpense: (expenseId: string, scheduleId: string) => void;
  onAddExpense?: () => void;
};

const WEEKDAYS = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

function formatSheetDayHeading(dayKey: string): string {
  const [ys, ms, ds] = dayKey.split('-');
  const y = Number(ys);
  const m = Number(ms);
  const d = Number(ds);
  if (!y || !m || !d) return dayKey;
  const dt = new Date(y, m - 1, d);
  return `${m}월 ${d}일 ${WEEKDAYS[dt.getDay()]}`;
}

function expenseSheetTitle(expense: Expense): string {
  const item = expense.item?.trim();
  if (item) return item;
  const content = expense.content?.trim();
  if (content) return content;
  return `${expenseCategoryLabel(expense.category)} 소비`;
}

function isCategoryFallbackTitle(expense: Expense): boolean {
  return !expense.item?.trim() && !expense.content?.trim();
}

function expenseSheetMemo(expense: Expense, title: string): string | null {
  const reason = expense.reason?.trim() ?? '';
  const summary = expense.summaryLine?.trim() ?? '';
  const parts: string[] = [];
  if (reason && reason !== '기록 없음' && reason !== '메모 없음' && reason !== title) parts.push(reason);
  if (summary && summary !== title && summary !== reason) parts.push(summary);
  return parts.length > 0 ? parts.join(' · ') : null;
}

function formatSpentAtClock(date: Date): string {
  const hour = date.getHours();
  const minute = date.getMinutes();
  const period = hour >= 12 ? '오후' : '오전';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const mm = String(minute).padStart(2, '0');
  return `${period} ${h12}:${mm}`;
}

export function HomeDayExpenseModal({
  dayKey,
  expenses,
  reviewsByExpenseId,
  reviewSchedulesByExpenseId,
  onClose,
  onOpenExpense,
  onEditExpense,
  onDeleteExpense,
  onReviewExpense,
  onAddExpense,
}: Props) {
  const { colors, isDark, animationsEnabled } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [headerHeight, setHeaderHeight] = useState(88);
  const [listContentHeight, setListContentHeight] = useState(0);
  const [viewerUri, setViewerUri] = useState<string | null>(null);
  const [viewerLabel, setViewerLabel] = useState('소비 사진');
  const exitingRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const sheetOpen = useSharedValue(animationsEnabled ? 0 : 1);
  const backdropOpacity = useSharedValue(animationsEnabled ? 0 : 1);

  useEffect(() => {
    if (!animationsEnabled) {
      sheetOpen.value = 1;
      backdropOpacity.value = 1;
      return;
    }
    backdropOpacity.value = withTiming(1, { duration: 220 });
    sheetOpen.value = withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) });
  }, [animationsEnabled, backdropOpacity, sheetOpen]);

  const finishClose = useCallback(() => {
    onCloseRef.current();
  }, []);

  const requestClose = useCallback(() => {
    if (viewerUri) {
      setViewerUri(null);
      return;
    }
    if (exitingRef.current) return;
    exitingRef.current = true;
    if (!animationsEnabled) {
      finishClose();
      return;
    }
    backdropOpacity.value = withTiming(0, { duration: 200 });
    sheetOpen.value = withTiming(0, { duration: 240, easing: Easing.in(Easing.cubic) }, (finished) => {
      if (finished) runOnJS(finishClose)();
    });
  }, [animationsEnabled, backdropOpacity, finishClose, sheetOpen, viewerUri]);

  const sheet = {
    page: colors.surface,
    cardBg: colors.surface,
    cardBorder: isDark ? colors.border : '#E4EBE7',
    photoBg: isDark ? colors.surfaceMuted : '#F7F8F7',
    mintFill: isDark ? colors.choiceActiveBg : '#EEF8F2',
    mintText: isDark ? BRAND_GREEN : '#3E7A61',
    editBg: isDark ? colors.surfaceMuted : '#F5F6F5',
    divider: isDark ? colors.border : 'rgba(32, 37, 34, 0.08)',
    dim: isDark ? 'rgba(8, 10, 9, 0.48)' : 'rgba(32, 37, 34, 0.28)',
    handle: isDark ? colors.border : '#D8E0DB',
  };

  const totalAmount = useMemo(
    () => expenses.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
    [expenses],
  );

  useEffect(() => {
    setListContentHeight(0);
  }, [dayKey, expenses.length]);

  const sheetMaxHeight = windowHeight * 0.86;
  const bottomPad = Math.max(insets.bottom, 12);
  const scrollMaxHeight = Math.max(120, sheetMaxHeight - headerHeight - bottomPad);
  const listHeight =
    listContentHeight > 0 ? Math.min(listContentHeight, scrollMaxHeight) : undefined;

  const backdropAnim = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value,
  }));

  const sheetAnim = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - sheetOpen.value) * windowHeight }],
  }));

  return (
    <>
      <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={requestClose}>
        <View style={styles.modalRoot}>
          <Animated.View style={[styles.backdropFill, { backgroundColor: sheet.dim }, backdropAnim]}>
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={requestClose}
              accessibilityRole="button"
              accessibilityLabel="닫기"
            />
          </Animated.View>

          <Animated.View
            style={[
              styles.modalCard,
              {
                backgroundColor: sheet.page,
                borderColor: sheet.cardBorder,
                maxHeight: sheetMaxHeight,
                paddingBottom: bottomPad,
              },
              sheetAnim,
            ]}
          >
            <View
              style={styles.headerWrap}
              onLayout={(e) => {
                const next = e.nativeEvent.layout.height;
                if (next > 0 && Math.abs(next - headerHeight) > 1) setHeaderHeight(next);
              }}
            >
              <View style={[styles.handle, { backgroundColor: sheet.handle }]} />
              <View style={styles.headerRow}>
                <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
                  {formatSheetDayHeading(dayKey)}
                </Text>
                <Pressable
                  onPress={requestClose}
                  style={[styles.closeHit, { backgroundColor: isDark ? colors.surfaceMuted : '#F5F6F5' }]}
                  accessibilityRole="button"
                  accessibilityLabel="닫기"
                >
                  <MaterialIcons name="close" size={18} color={colors.textSec} />
                </Pressable>
              </View>
              <Text style={[styles.headerMeta, { color: colors.textMuted }]}>
                {expenses.length > 0 ? (
                  <>
                    <Text>{expenses.length}건의 소비 · </Text>
                    <Text style={{ color: colors.text, fontWeight: '600' }}>총 {totalAmount.toLocaleString()}원</Text>
                  </>
                ) : (
                  '소비 없음'
                )}
              </Text>
              <View style={[styles.headerRule, { backgroundColor: sheet.divider }]} />
            </View>

            {expenses.length === 0 ? (
              <View style={styles.empty}>
                <Text style={[styles.emptyText, { color: colors.textSec }]}>
                  이 날짜에 기록된 소비가 없어요.
                </Text>
                {onAddExpense ? (
                  <Pressable
                    onPress={onAddExpense}
                    style={({ pressed }) => [
                      styles.emptyCta,
                      { backgroundColor: sheet.mintFill, opacity: pressed ? 0.88 : 1 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="소비 추가"
                  >
                    <Text style={[styles.emptyCtaText, { color: sheet.mintText }]}>소비 추가</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <ScrollView
                style={listHeight != null ? { height: listHeight } : { maxHeight: scrollMaxHeight }}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                bounces={false}
                keyboardShouldPersistTaps="handled"
                onContentSizeChange={(_w, h) => {
                  if (h > 0 && Math.abs(h - listContentHeight) > 1) setListContentHeight(h);
                }}
              >
                {expenses.map((item) => {
                  const title = expenseSheetTitle(item);
                  const memo = expenseSheetMemo(item, title);
                  const itemReview = reviewsByExpenseId.get(item.id);
                  const reviewState = resolveExpenseReviewState(
                    itemReview ? [itemReview] : [],
                    reviewSchedulesByExpenseId.get(item.id) ?? [],
                  );
                  const canReview =
                    (reviewState.kind === 'open' || reviewState.kind === 'evaluable') &&
                    reviewState.schedule != null;
                  const waitHint =
                    reviewState.kind === 'waiting' && reviewState.schedule
                      ? formatReviewWaitHint(reviewState.schedule)
                      : null;
                  const badge = itemReview ? reviewSentimentColors(itemReview, isDark) : null;
                  const timeLabel = formatSpentAtClock(item.spentAt);
                  const metaLine = isCategoryFallbackTitle(item)
                    ? timeLabel
                    : `${expenseCategoryLabel(item.category)} · ${timeLabel}`;
                  const photoUrls = getExpenseImageUrls(item);
                  const coverUrl = photoUrls[0] ?? null;
                  const photoCount = photoUrls.length;
                  return (
                    <View
                      key={item.id}
                      style={[
                        styles.card,
                        { backgroundColor: sheet.cardBg, borderColor: sheet.cardBorder },
                      ]}
                    >
                      <View style={styles.titleRow}>
                        <Text style={[styles.cardTitle, { color: colors.text }]} numberOfLines={2}>
                          {title}
                        </Text>
                        <Text style={[styles.cardAmount, { color: colors.text }]}>
                          {Number(item.amount).toLocaleString()}원
                        </Text>
                      </View>
                      <Text style={[styles.cardMeta, { color: colors.textMuted }]} numberOfLines={1}>
                        {metaLine}
                      </Text>

                      {coverUrl ? (
                        <View style={styles.photoSlot}>
                          <ReviewContainPhoto
                            uri={coverUrl}
                            accessibilityLabel={`${title} 사진 크게 보기`}
                            onPress={() => {
                              setViewerLabel(`${title} 사진`);
                              setViewerUri(coverUrl);
                            }}
                            photoBg={sheet.photoBg}
                            muted={colors.textMuted}
                            ctaColor={BRAND_GREEN}
                            maxHeight={176}
                            blurBackdrop
                            blurOverlay={isDark ? 'rgba(11, 16, 14, 0.42)' : 'rgba(250, 252, 250, 0.38)'}
                            centerInParent
                            cornerBadge={
                              photoCount >= 2 ? (
                                <View style={styles.photoCountBadge}>
                                  <MaterialIcons name="photo-library" size={12} color="#F4F6F5" />
                                  <Text style={styles.photoCountBadgeText}>{photoCount}장</Text>
                                </View>
                              ) : null
                            }
                          />
                        </View>
                      ) : null}

                      {memo ? (
                        <Text style={[styles.cardMemo, { color: colors.textSec }]} numberOfLines={2}>
                          {memo}
                        </Text>
                      ) : null}

                      {badge ? (
                        <View style={[styles.reviewBadge, { backgroundColor: badge.bg }]}>
                          <Text style={[styles.reviewBadgeText, { color: badge.text }]}>
                            {reviewSentimentLabel(itemReview!)}
                          </Text>
                        </View>
                      ) : null}

                      <View style={styles.actions}>
                        <View style={styles.actionRow}>
                          <Pressable
                            onPress={() => onOpenExpense(item.id)}
                            accessibilityRole="button"
                            accessibilityLabel="상세 보기"
                            style={({ pressed }) => [
                              styles.actionBtn,
                              canReview
                                ? {
                                    backgroundColor: sheet.editBg,
                                    borderWidth: 1,
                                    borderColor: sheet.cardBorder,
                                    opacity: pressed ? 0.88 : 1,
                                  }
                                : { backgroundColor: sheet.mintFill, opacity: pressed ? 0.88 : 1 },
                            ]}
                          >
                            <Text
                              style={[
                                styles.actionBtnText,
                                { color: canReview ? colors.text : sheet.mintText },
                              ]}
                            >
                              상세 보기
                            </Text>
                          </Pressable>
                          <Pressable
                            onPress={() => onEditExpense(item.id)}
                            accessibilityRole="button"
                            accessibilityLabel="수정"
                            style={({ pressed }) => [
                              styles.actionBtn,
                              {
                                backgroundColor: sheet.editBg,
                                borderWidth: 1,
                                borderColor: sheet.cardBorder,
                                opacity: pressed ? 0.88 : 1,
                              },
                            ]}
                          >
                            <Text style={[styles.actionBtnText, { color: colors.text }]}>수정</Text>
                          </Pressable>
                          <Pressable
                            onPress={() => onDeleteExpense(item.id, title, dayKey)}
                            accessibilityRole="button"
                            accessibilityLabel="삭제"
                            style={({ pressed }) => [
                              styles.actionBtn,
                              {
                                backgroundColor: sheet.cardBg,
                                borderWidth: 1,
                                borderColor: sheet.cardBorder,
                                opacity: pressed ? 0.88 : 1,
                              },
                            ]}
                          >
                            <Text style={[styles.actionBtnText, { color: colors.logoutText }]}>삭제</Text>
                          </Pressable>
                        </View>
                        {canReview && reviewState.schedule ? (
                          <Pressable
                            onPress={() => onReviewExpense(item.id, reviewState.schedule!.id)}
                            style={({ pressed }) => [
                              styles.actionBtn,
                              styles.reviewAction,
                              { backgroundColor: sheet.mintFill, opacity: pressed ? 0.88 : 1 },
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel="평가하기"
                          >
                            <Text style={[styles.actionBtnText, { color: sheet.mintText }]}>평가하기</Text>
                          </Pressable>
                        ) : waitHint ? (
                          <Text style={[styles.waitHint, { color: colors.textMuted }]}>{waitHint}</Text>
                        ) : null}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
            )}
          </Animated.View>
        </View>
      </Modal>

      <PhotoViewerModal
        visible={viewerUri != null}
        uri={viewerUri}
        accessibilityLabel={viewerLabel}
        onClose={() => setViewerUri(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropFill: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
  modalCard: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
    overflow: 'hidden',
  },
  headerWrap: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 44,
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  closeHit: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerMeta: {
    marginTop: 2,
    fontSize: 13,
    lineHeight: 18,
  },
  headerRule: {
    height: StyleSheet.hairlineWidth,
    marginTop: 12,
  },
  empty: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 28,
    gap: 14,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  emptyCta: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCtaText: {
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 2,
    gap: 12,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 16,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  cardTitle: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  cardAmount: {
    flexShrink: 0,
    maxWidth: '46%',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
    lineHeight: 22,
    textAlign: 'right',
  },
  cardMeta: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
  },
  photoSlot: {
    marginTop: 14,
    width: '100%',
    alignItems: 'center',
  },
  photoCountBadge: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    backgroundColor: 'rgba(11, 16, 14, 0.55)',
  },
  photoCountBadgeText: {
    color: '#F4F6F5',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  cardMemo: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 19,
  },
  reviewBadge: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  reviewBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  actions: {
    marginTop: 14,
    gap: 8,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
  },
  reviewAction: {
    flexGrow: 0,
    width: '100%',
  },
  waitHint: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
    paddingTop: 2,
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
});
