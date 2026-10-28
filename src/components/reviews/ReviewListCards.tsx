import React from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { ThemeColors } from '@/theme/ThemeContext';
import type { ExpenseCategory, RegretReason } from '@/lib/types';
import { expenseCategoryLabel } from '@/lib/expenseCategoryLabel';
import { satisfactionLabel } from '@/lib/satisfactionScale';
import { regretReasonLabel } from '@/lib/regretReasons';
import { isDisplayableImageUrl } from '@/utils/expenseImage';
import { ReviewContainPhoto } from '@/components/ReviewContainPhoto';

export type ReviewItem = {
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

export type CompletedReviewItem = {
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
  notes?: string;
  regretReasons: RegretReason[];
};

export function formatReviewDate(date: Date): string {
  return `${date.getFullYear()}.${String(date.getMonth() + 1).padStart(2, '0')}.${String(date.getDate()).padStart(2, '0')}`;
}

export function formatSpentShort(date: Date): string {
  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

function amountLabel(amount?: number): string {
  return amount != null ? `${Number(amount).toLocaleString()}원` : '금액 없음';
}

function hasDisplayableImage(url: string | null | undefined): boolean {
  return isDisplayableImageUrl(url);
}

function HeartToggle({
  active,
  onPress,
  colors,
}: {
  active: boolean;
  onPress: () => void;
  colors: ThemeColors;
}) {
  return (
    <Pressable
      style={[
        styles.iconBtn,
        {
          backgroundColor: colors.surfaceMuted,
          borderColor: colors.border,
        },
      ]}
      onPress={onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={active ? '좋아요 해제' : '좋아요'}
    >
      <MaterialIcons
        name={active ? 'favorite' : 'favorite-border'}
        size={20}
        color={active ? '#c45c6a' : colors.textMuted}
      />
    </Pressable>
  );
}

function StatusPill({
  label,
  mint,
  colors,
}: {
  label: string;
  mint?: boolean;
  colors: ThemeColors;
}) {
  const mintFill = colors.choiceActiveBg;
  const mintText = colors.choiceTextActive;
  return (
    <View
      style={[
        styles.pill,
        {
          backgroundColor: mint ? mintFill : colors.surfaceMuted,
        },
      ]}
    >
      <Text style={[styles.pillText, { color: mint ? mintText : colors.textSec }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function CardPhoto({
  uri,
  title,
  colors,
  isDark,
  onOpen,
}: {
  uri: string;
  title: string;
  colors: ThemeColors;
  isDark: boolean;
  onOpen: () => void;
}) {
  return (
    <View style={styles.photoWrap}>
      <ReviewContainPhoto
        uri={uri}
        accessibilityLabel={`${title} 사진 크게 보기`}
        onPress={onOpen}
        photoBg={colors.surfaceMuted}
        muted={colors.textMuted}
        ctaColor={colors.primary}
        maxHeight={200}
        blurBackdrop
        blurOverlay={isDark ? 'rgba(11, 16, 14, 0.42)' : 'rgba(250, 252, 250, 0.38)'}
      />
    </View>
  );
}

function TitleAmountRow({
  title,
  amount,
  colors,
}: {
  title: string;
  amount: string;
  colors: ThemeColors;
}) {
  return (
    <View style={styles.titleRow}>
      <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
        {title}
      </Text>
      <Text style={[styles.amount, { color: colors.text }]} numberOfLines={1}>
        {amount}
      </Text>
    </View>
  );
}

function ReviewCardFrame({
  colors,
  isDark,
  children,
}: {
  colors: ThemeColors;
  isDark: boolean;
  children: React.ReactNode;
}) {
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        !isDark && styles.cardElev,
      ]}
    >
      {children}
    </View>
  );
}

export function ReviewPendingCard({
  item,
  colors,
  isDark,
  heartOn,
  onHeartToggle,
  onReview,
  onOpenPhoto,
}: {
  item: ReviewItem;
  colors: ThemeColors;
  isDark: boolean;
  heartOn: boolean;
  onHeartToggle: () => void;
  onReview: () => void;
  onOpenPhoto: (uri: string) => void;
}) {
  const amountStr = amountLabel(item.amount);
  const showImage = hasDisplayableImage(item.imageUrl);

  const shareLine = async () => {
    try {
      // OS Share.share — 소비 상세의 shareExpenseLink(웹 링크)와 다른 로컬 텍스트 공유입니다.
      await Share.share({
        message: [item.title, item.subtitle, amountStr].filter(Boolean).join('\n'),
      });
    } catch {
      /* 취소 등 */
    }
  };

  return (
    <ReviewCardFrame colors={colors} isDark={isDark}>
      <View style={styles.metaRow}>
        <StatusPill label={expenseCategoryLabel(item.category)} colors={colors} />
        <StatusPill label="평가 가능" mint colors={colors} />
      </View>

      <TitleAmountRow title={item.title} amount={amountStr} colors={colors} />
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>
        {formatSpentShort(item.spentAt)}
        {item.subtitle ? ` · ${item.subtitle}` : ''}
      </Text>

      {showImage ? (
        <CardPhoto
          uri={item.imageUrl!}
          title={item.title}
          colors={colors}
          isDark={isDark}
          onOpen={() => onOpenPhoto(item.imageUrl!)}
        />
      ) : null}

      <View style={styles.remainRow}>
        <MaterialIcons name="schedule" size={14} color={colors.textMuted} />
        <Text style={[styles.remainText, { color: colors.textSec }]}>{item.remainingLabel}</Text>
      </View>

      <View style={styles.actionRow}>
        <Pressable
          onPress={onReview}
          style={({ pressed }) => [
            styles.primaryCta,
            { backgroundColor: colors.accentCta, opacity: pressed ? 0.92 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="소비 평가하기"
        >
          <Text style={[styles.primaryCtaText, { color: colors.onPrimary }]}>소비 평가하기</Text>
        </Pressable>
        <Pressable
          onPress={() => void shareLine()}
          style={({ pressed }) => [
            styles.iconBtn,
            { backgroundColor: colors.surfaceMuted, borderColor: colors.border, opacity: pressed ? 0.88 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="공유"
        >
          <MaterialIcons name="share" size={20} color={colors.textSec} />
        </Pressable>
        <HeartToggle active={heartOn} onPress={onHeartToggle} colors={colors} />
      </View>
    </ReviewCardFrame>
  );
}

export function ReviewPastCard({
  item,
  colors,
  isDark,
  heartOn,
  onHeartToggle,
  onReview,
  onOpenPhoto,
}: {
  item: ReviewItem;
  colors: ThemeColors;
  isDark: boolean;
  heartOn: boolean;
  onHeartToggle: () => void;
  onReview: () => void;
  onOpenPhoto: (uri: string) => void;
}) {
  const amountStr = amountLabel(item.amount);
  const showImage = hasDisplayableImage(item.imageUrl);

  return (
    <ReviewCardFrame colors={colors} isDark={isDark}>
      <View style={styles.metaRow}>
        <StatusPill label={expenseCategoryLabel(item.category)} colors={colors} />
        <StatusPill label="평가 가능" mint colors={colors} />
      </View>

      <TitleAmountRow title={item.title} amount={amountStr} colors={colors} />
      <Text style={[styles.subtitle, { color: colors.textMuted }]}>소비일 {formatReviewDate(item.spentAt)}</Text>

      {showImage ? (
        <CardPhoto
          uri={item.imageUrl!}
          title={item.title}
          colors={colors}
          isDark={isDark}
          onOpen={() => onOpenPhoto(item.imageUrl!)}
        />
      ) : null}

      <Text style={[styles.pastHint, { color: colors.textSec }]}>
        평가 시점이 지났지만 지금도 기록을 남길 수 있어요.
      </Text>

      <View style={styles.actionRow}>
        <Pressable
          onPress={onReview}
          style={({ pressed }) => [
            styles.primaryCta,
            { backgroundColor: colors.accentCta, opacity: pressed ? 0.92 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel="평가 남기기"
        >
          <Text style={[styles.primaryCtaText, { color: colors.onPrimary }]}>평가 남기기</Text>
        </Pressable>
        <HeartToggle active={heartOn} onPress={onHeartToggle} colors={colors} />
      </View>
    </ReviewCardFrame>
  );
}

export function ReviewCompletedCard({
  item,
  colors,
  isDark,
  heartOn,
  onHeartToggle,
  onPress,
  onOpenPhoto,
}: {
  item: CompletedReviewItem;
  colors: ThemeColors;
  isDark: boolean;
  heartOn: boolean;
  onHeartToggle: () => void;
  onPress: () => void;
  onOpenPhoto: (uri: string) => void;
}) {
  const amountStr = amountLabel(item.amount);
  const showImage = hasDisplayableImage(item.imageUrl);
  const ratingLabel = satisfactionLabel(item.satisfaction) || `${item.satisfaction}/5`;
  const starFill = colors.primary;
  const notesPreview = (item.notes ?? '').trim();
  const reasonPreview = item.regretReasons
    .map((key) => regretReasonLabel(key))
    .filter((label): label is string => Boolean(label))
    .slice(0, 3)
    .join(' · ');

  return (
    <ReviewCardFrame colors={colors} isDark={isDark}>
      <View style={styles.completedTop}>
        <Pressable
          onPress={onPress}
          style={({ pressed }) => [styles.completedTopLeft, { opacity: pressed ? 0.88 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel={`${item.title} 소비 상세 보기`}
        >
          <View style={styles.metaRow}>
            <StatusPill label={expenseCategoryLabel(item.category)} colors={colors} />
            <StatusPill label="작성 완료" colors={colors} />
          </View>
          <TitleAmountRow title={item.title} amount={amountStr} colors={colors} />
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            소비 {formatReviewDate(item.spentAt)} · 평가 {formatReviewDate(item.reviewedAt)}
          </Text>
        </Pressable>
        <HeartToggle active={heartOn} onPress={onHeartToggle} colors={colors} />
      </View>

      {showImage ? (
        <CardPhoto
          uri={item.imageUrl!}
          title={item.title}
          colors={colors}
          isDark={isDark}
          onOpen={() => onOpenPhoto(item.imageUrl!)}
        />
      ) : null}

      <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="소비 상세 보기">
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((star) => (
            <MaterialIcons
              key={star}
              name={star <= item.satisfaction ? 'star' : 'star-border'}
              size={16}
              color={star <= item.satisfaction ? starFill : colors.borderInput}
            />
          ))}
          <Text style={[styles.ratingHint, { color: colors.textSec }]}>{ratingLabel}</Text>
        </View>

        {notesPreview ? (
          <Text style={[styles.preview, { color: colors.textSec }]} numberOfLines={2}>
            “{notesPreview}”
          </Text>
        ) : reasonPreview ? (
          <Text style={[styles.preview, { color: colors.textSec }]} numberOfLines={1}>
            {reasonPreview}
          </Text>
        ) : null}
      </Pressable>
    </ReviewCardFrame>
  );
}

export function ReviewEmptyState({
  icon,
  title,
  desc,
  hint,
  ctaLabel,
  onCta,
  colors,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  title: string;
  desc: string;
  hint?: string;
  ctaLabel?: string;
  onCta?: () => void;
  colors: ThemeColors;
}) {
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.surfaceMuted }]}>
        <MaterialIcons name={icon} size={22} color={colors.emptyIcon} />
      </View>
      <Text style={[styles.emptyTitle, { color: colors.text }]}>{title}</Text>
      <Text style={[styles.emptyDesc, { color: colors.textSec }]}>{desc}</Text>
      {onCta && ctaLabel ? (
        <Pressable
          onPress={onCta}
          style={({ pressed }) => [
            styles.emptyCta,
            { backgroundColor: colors.accentCta, opacity: pressed ? 0.92 : 1 },
          ]}
        >
          <Text style={[styles.emptyCtaText, { color: colors.onPrimary }]}>{ctaLabel}</Text>
        </Pressable>
      ) : null}
      {hint ? <Text style={[styles.emptyHint, { color: colors.textMuted }]}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
  },
  cardElev: {
    shadowColor: '#1A2E24',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  metaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 10,
  },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  pillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  title: {
    flex: 1,
    minWidth: 0,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  amount: {
    flexShrink: 0,
    maxWidth: '46%',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
    lineHeight: 22,
    textAlign: 'right',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  photoWrap: {
    marginTop: 12,
  },
  remainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 12,
  },
  remainText: {
    fontSize: 12,
    fontWeight: '700',
  },
  pastHint: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 14,
  },
  primaryCta: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryCtaText: {
    fontSize: 15,
    fontWeight: '800',
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completedTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  completedTopLeft: {
    flex: 1,
    minWidth: 0,
  },
  starsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 12,
  },
  ratingHint: {
    marginLeft: 6,
    fontSize: 12,
    fontWeight: '700',
  },
  preview: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 19,
  },
  empty: {
    alignItems: 'center',
    paddingHorizontal: 28,
    paddingTop: 48,
    paddingBottom: 32,
    gap: 8,
  },
  emptyIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
  },
  emptyDesc: {
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
    textAlign: 'center',
  },
  emptyCta: {
    marginTop: 10,
    minHeight: 44,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyCtaText: {
    fontSize: 15,
    fontWeight: '800',
  },
  emptyHint: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 18,
    textAlign: 'center',
  },
});
