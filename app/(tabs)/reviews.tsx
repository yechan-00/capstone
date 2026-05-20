import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@/hooks/useAuth';
import { scheduleService } from '@/services/scheduleService';
import { expenseService } from '@/services/expenseService';
import { ErrorRetryCard } from '@/components/ErrorRetryCard';
import { PrimaryButton } from '@/components/PrimaryButton';
import { toUserMessage } from '@/utils/error';
import { useTheme, type ThemeColors } from '@/theme/ThemeContext';
import type { ExpenseCategory, ScheduleType } from '@/lib/types';
import { scheduleDueLabel } from '@/lib/scheduleLabels';

const NAVY_HEADER = '#2e4475';
const NAVY_HEADER_DEEP = '#24365f';

type ReviewItem = {
  id: string;
  expenseId: string;
  dueType: ScheduleType;
  title: string;
  subtitle: string;
  amount?: number;
  category: ExpenseCategory;
  imageUrl: string | null;
};

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

function hasDisplayableImage(url: string | null | undefined): boolean {
  if (!url || typeof url !== 'string') return false;
  const u = url.trim();
  return u.startsWith('http://') || u.startsWith('https://') || u.startsWith('file://');
}

function ReviewPendingCard({
  item,
  colors,
  isDark,
  onReview,
}: {
  item: ReviewItem;
  colors: ThemeColors;
  isDark: boolean;
  onReview: () => void;
}) {
  const [heartOn, setHeartOn] = React.useState(false);
  const showImage = hasDisplayableImage(item.imageUrl);
  const cat = categoryLine(item.category);
  const amountStr = item.amount != null ? `${Number(item.amount).toLocaleString()}원` : '금액 없음';
  const dueLabel = scheduleDueLabel(item.dueType);

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
          <Pressable
            style={[styles.heartFab, { backgroundColor: heartOn ? '#e11d48' : 'rgba(255,255,255,0.95)' }]}
            onPress={() => setHeartOn((v) => !v)}
            hitSlop={8}
          >
            <MaterialIcons
              name={heartOn ? 'favorite' : 'favorite-border'}
              size={22}
              color={heartOn ? '#fff' : colors.textMuted}
            />
          </Pressable>
        </View>
      ) : (
        <View style={[styles.compactMetaRow, { borderBottomColor: colors.border }]}>
          <View style={[styles.categoryPill, { backgroundColor: colors.surfaceMuted }]}>
            <Text style={[styles.categoryPillText, { color: colors.text }]} numberOfLines={1}>
              {cat}
            </Text>
          </View>
          <Text style={[styles.compactAmount, { color: colors.accentBlue }]} numberOfLines={1}>
            {amountStr}
          </Text>
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

        <View style={styles.footerTopRow}>
          <View style={styles.starsRow}>
            {[0, 1, 2, 3, 4].map((i) => (
              <MaterialIcons key={i} name="star-border" size={17} color={isDark ? '#64748b' : '#d1d5db'} />
            ))}
            <Text style={[styles.ratingHint, { color: colors.textMuted }]}>미평가</Text>
          </View>
          <View style={[styles.timePill, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
            <MaterialIcons name="schedule" size={14} color={colors.accentBlue} />
            <Text style={[styles.timePillText, { color: colors.accentBlue }]}>{dueLabel}</Text>
          </View>
        </View>

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
      </View>
    </View>
  );
}

export default function ReviewsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { account } = useAuth();
  const { colors, isDark } = useTheme();
  const [items, setItems] = React.useState<ReviewItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<unknown | null>(null);

  const load = async () => {
    if (!account) return;
    try {
      setLoading(true);
      setError(null);
      const schedules = await scheduleService.getPendingSchedules(account.id);
      const results = await Promise.all(
        schedules.map(async (schedule) => {
          const expense = await expenseService.getById(schedule.expenseId);
          const rawTitle = (expense?.reason ?? '소비 평가').trim() || '소비 평가';
          const subtitleRaw =
            [expense?.item, expense?.content, expense?.summaryLine]
              .map((s) => (typeof s === 'string' ? s.trim() : ''))
              .find((s) => s.length > 0) ?? '';
          const subtitle = subtitleRaw && subtitleRaw !== rawTitle ? subtitleRaw : '';
          return {
            id: schedule.id,
            expenseId: schedule.expenseId,
            dueType: schedule.type,
            title: rawTitle,
            subtitle,
            amount: expense?.amount,
            category: expense?.category ?? 'takeout',
            imageUrl: expense?.imageUrl ?? null,
          } satisfies ReviewItem;
        })
      );
      setItems(results);
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
    }, [account])
  );

  const handleReview = (item: ReviewItem) => {
    router.push({ pathname: '/review', params: { expenseId: item.expenseId, scheduleId: item.id } });
  };

  const delayHint = Array.isArray(account?.reviewDelayDays)
    ? account?.reviewDelayDays.join(',')
    : String(account?.reviewDelayDays ?? 3);

  if (loading && items.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: colors.bg }]}>
        <ErrorRetryCard title="리뷰 목록을 불러오지 못했어요" desc={toUserMessage(error)} onRetry={load} />
      </View>
    );
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <View style={styles.cardWrap}>
            <ReviewPendingCard item={item} colors={colors} isDark={isDark} onReview={() => handleReview(item)} />
          </View>
        )}
        contentContainerStyle={[
          styles.listContent,
          items.length === 0 && styles.listContentGrow,
          { paddingTop: 22, paddingBottom: insets.bottom + 28 },
        ]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.primary} />}
        ListEmptyComponent={
          <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>평가할 항목이 없습니다</Text>
            <Text style={[styles.emptyDesc, { color: colors.textSec }]}>
              소비를 기록하면 D+{delayHint} 리뷰 알림이 생겨요. 식후 바로는 기록 화면에서 한 줄로 남길 수 있어요.
            </Text>
            <PrimaryButton label="소비 추가하기" onPress={() => router.push('/add-expense')} />
          </View>
        }
      />
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
  compactMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
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
});
