import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { ExpenseDetailPhotoGallery } from '@/components/expenseDetail/ExpenseDetailPhotoGallery';
import { useExpenseDetailPalette } from '@/theme/expenseDetailTheme';

type Props = {
  title: string;
  categoryLabel: string;
  showCategoryInMeta: boolean;
  amount: number;
  spentAt: Date;
  imageUrls: string[];
  onPhotoPress?: (uri: string) => void;
  /** 제목·금액 블록의 하단 y (이 섹션 기준) */
  onHeadingBottom?: (bottomY: number) => void;
};

function formatClock(date: Date): string {
  const hour = date.getHours();
  const minute = date.getMinutes();
  const period = hour >= 12 ? '오후' : '오전';
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  const mm = String(minute).padStart(2, '0');
  return `${period} ${h12}:${mm}`;
}

function formatSpentMeta(date: Date): string {
  return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일 · ${formatClock(date)}`;
}

export function ExpenseIdentitySection({
  title,
  categoryLabel,
  showCategoryInMeta,
  amount,
  spentAt,
  imageUrls,
  onPhotoPress,
  onHeadingBottom,
}: Props) {
  const p = useExpenseDetailPalette();
  const meta = formatSpentMeta(spentAt);

  return (
    <View style={styles.wrap}>
      <View
        onLayout={
          onHeadingBottom
            ? (event) => {
                const { y, height } = event.nativeEvent.layout;
                onHeadingBottom(y + height);
              }
            : undefined
        }
      >
        {showCategoryInMeta ? (
          <View style={[styles.categoryBadge, { backgroundColor: p.mintFill }]}>
            <Text style={[styles.categoryBadgeText, { color: p.mintText }]}>{categoryLabel}</Text>
          </View>
        ) : null}
        <Text style={[styles.title, { color: p.text }]}>{title}</Text>
        <Text style={[styles.amount, { color: p.text }]}>{amount.toLocaleString()}원</Text>
      </View>
      <Text style={[styles.meta, { color: p.textMuted }]}>{meta}</Text>

      {imageUrls.length > 0 ? (
        <View style={styles.photoSlot}>
          <ExpenseDetailPhotoGallery
            urls={imageUrls}
            title={title}
            onPhotoPress={onPhotoPress}
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingTop: 4,
  },
  categoryBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    marginBottom: 10,
  },
  categoryBadgeText: {
    fontSize: 12,
    fontWeight: '700',
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.5,
    lineHeight: 28,
  },
  amount: {
    marginTop: 8,
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: -0.6,
    lineHeight: 30,
  },
  meta: {
    marginTop: 6,
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  photoSlot: {
    marginTop: 16,
  },
});
