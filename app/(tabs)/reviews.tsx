import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useAuth } from '@/hooks/useAuth';
import { scheduleService } from '@/services/scheduleService';
import { expenseService } from '@/services/expenseService';
import { ErrorRetryCard } from '@/components/ErrorRetryCard';
import { PrimaryButton } from '@/components/PrimaryButton';
import { toUserMessage } from '@/utils/error';
import { useTheme } from '@/theme/ThemeContext';
import type { ScheduleType } from '@/lib/types';
import { scheduleDueLabel } from '@/lib/scheduleLabels';

type ReviewItem = {
  id: string;
  expenseId: string;
  dueType: ScheduleType;
  title: string;
  amount?: number;
};

export default function ReviewsScreen() {
  const router = useRouter();
  const { account } = useAuth();
  const { colors } = useTheme();
  const [items, setItems] = React.useState<ReviewItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<unknown | null>(null);
  const loadBusyRef = React.useRef(false);

  const load = async () => {
    if (!account) return;
    try {
      setLoading(true);
      setError(null);
      const schedules = await scheduleService.getPendingSchedules(account.id);
      const results = await Promise.all(
        schedules.map(async (schedule) => {
          const expense = await expenseService.getById(schedule.expenseId);
          return {
            id: schedule.id,
            expenseId: schedule.expenseId,
            dueType: schedule.type,
            title: expense?.reason ?? '소비 평가',
            amount: expense?.amount,
          };
        })
      );
      setItems(results);
    } catch (err) {
      console.error('[reviews] load failed', err);
      setError(err);
    } finally {
      setLoading(false);
      loadBusyRef.current = false;
    }
  };

  React.useEffect(() => {
    if (account) load();
  }, [account]);

  useFocusEffect(
    React.useCallback(() => {
      if (!account) return;
      load();
    }, [account])
  );

  const handleReview = (item: ReviewItem) => {
    router.push({ pathname: '/review', params: { expenseId: item.expenseId, scheduleId: item.id } });
  };

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
        <ErrorRetryCard
          title="리뷰 목록을 불러오지 못했어요"
          desc={toUserMessage(error)}
          onRetry={load}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => handleReview(item)}>
            <Text style={styles.kicker}>평가 대기 (소비당 1건)</Text>
            <Text style={styles.title} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.amount}>
              {item.amount != null ? `₩${item.amount.toLocaleString()}` : '금액 정보 없음'}
            </Text>
            <View style={styles.dueRow}>
              <Text style={styles.dueIcon}>⏰</Text>
              <Text style={styles.dueText}>{scheduleDueLabel(item.dueType)} 리뷰</Text>
            </View>
            <View style={styles.ctaRow}>
              <Text style={styles.ctaText}>지금 평가하기 →</Text>
            </View>
          </Pressable>
        )}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListEmptyComponent={
          <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.emptyTitle, { color: colors.text }]}>평가할 항목이 없습니다</Text>
            <Text style={[styles.emptyDesc, { color: colors.textSec }]}>
              소비를 기록하면 3일 뒤 리뷰 알림이 생겨요. 식후 바로는 기록 화면에서 한 줄로 남길 수 있어요.
            </Text>
            <PrimaryButton label="소비 추가하기" onPress={() => router.push('/add-expense')} />
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  list: {
    padding: 16,
    paddingBottom: 32,
  },
  card: {
    backgroundColor: '#77A7FF',
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
  },
  kicker: { color: 'rgba(255,255,255,0.9)', fontWeight: '800', fontSize: 12 },
  title: { color: '#fff', fontWeight: '900', fontSize: 18, marginTop: 4 },
  amount: { color: '#fff', fontWeight: '900', fontSize: 16, marginTop: 2 },
  dueRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  dueIcon: { color: 'rgba(255,255,255,0.95)' },
  dueText: { color: 'rgba(255,255,255,0.95)', fontWeight: '800' },
  ctaRow: {
    marginTop: 12,
    backgroundColor: '#1F4FD6',
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  ctaText: { color: '#fff', fontWeight: '900' },
  empty: {
    backgroundColor: '#fff',
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    gap: 10,
  },
  emptyTitle: { fontSize: 16, fontWeight: '900', color: '#111827' },
  emptyDesc: { color: '#6B7280', textAlign: 'center', lineHeight: 20, fontWeight: '600' },
});
