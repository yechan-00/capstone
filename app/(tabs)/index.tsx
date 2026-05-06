import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '@/hooks/useAuth';
import { useExpenses } from '@/hooks/useExpenses';
import { ExpenseCard } from '@/components/ExpenseCard';
import { ReviewActionCard } from '@/components/ReviewActionCard';
import { ReviewStatusCard } from '@/components/ReviewStatusCard';
import { ErrorRetryCard } from '@/components/ErrorRetryCard';
import { expenseService } from '@/services/expenseService';
import { ensureNotificationPermission } from '@/services/notificationService';
import { scheduleService } from '@/services/scheduleService';
import { getDaysUntil } from '@/utils/time';
import { toUserMessage } from '@/utils/error';
import { useTheme } from '@/theme/ThemeContext';
import type { ScheduleType } from '@/lib/types';

export default function HomeScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user, account, loading: authLoading } = useAuth();
  const { expenses, loading, error, refresh, deleteExpense } = useExpenses();
  const [pendingLoading, setPendingLoading] = React.useState(true);
  const [pendingError, setPendingError] = React.useState<unknown | null>(null);
  const [pendingItem, setPendingItem] = React.useState<{
    id: string;
    expenseId: string;
    dueType: ScheduleType;
    title?: string;
    amount?: number;
    dueAt?: Date;
  } | null>(null);
  const [nextDueInDays, setNextDueInDays] = React.useState<number | undefined>(undefined);

  const isOffline = error?.message?.toLowerCase().includes('offline');

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/(auth)/login');
    }
  }, [user, authLoading]);

  useEffect(() => {
    ensureNotificationPermission();
  }, []);

  useEffect(() => {
    if (!account) {
      setPendingLoading(false);
      setPendingError(null);
      setPendingItem(null);
      setNextDueInDays(undefined);
      return;
    }
    loadPendingReview();
  }, [account]);

  useFocusEffect(
    React.useCallback(() => {
      if (!account) return;
      loadPendingReview();
      refresh();
    }, [account, refresh])
  );

  const loadPendingReview = async () => {
    if (!account) return;
    try {
      setPendingLoading(true);
      setPendingError(null);
      const pendingSchedules = await scheduleService.getPendingSchedules(account.id);
      if (pendingSchedules.length > 0) {
        const schedule = pendingSchedules[0];
        const expense = await expenseService.getById(schedule.expenseId);
        setPendingItem({
          id: schedule.id,
          expenseId: schedule.expenseId,
          dueType: schedule.type,
          title: expense?.reason,
          amount: expense?.amount,
          dueAt: schedule.dueAt,
        });
        setNextDueInDays(undefined);
        return;
      }

      const upcoming = await scheduleService.getNextUpcomingSchedule(account.id);
      setPendingItem(null);
      setNextDueInDays(upcoming?.dueAt ? getDaysUntil(upcoming.dueAt) : undefined);
    } catch (err: unknown) {
      console.error('[pendingSchedules] load failed', err);
      setPendingError(err);
      setPendingItem(null);
      setNextDueInDays(undefined);
    } finally {
      setPendingLoading(false);
    }
  };

  const handleReviewPress = async (schedule: { id: string; expenseId: string }) => {
    router.push({ pathname: '/review', params: { expenseId: schedule.expenseId, scheduleId: schedule.id } });
  };

  const handleExpensePress = (expenseId: string) => {
    router.push(`/expense/${expenseId}`);
  };

  const handleDeleteExpense = (expenseId: string, reasonPreview: string) => {
    Alert.alert(
      '소비 삭제',
      `이 기록을 삭제할까요?\n연결된 리뷰·알림 예약도 함께 지워져요.\n\n${reasonPreview.slice(0, 80)}${reasonPreview.length > 80 ? '…' : ''}`,
      [
        { text: '취소', style: 'cancel' },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              try {
                await deleteExpense(expenseId);
                await loadPendingReview();
              } catch (err: unknown) {
                console.error('[home] delete expense failed', err);
                Alert.alert('삭제 실패', '소비를 삭제하지 못했어요. 네트워크를 확인해 주세요.');
              }
            })();
          },
        },
      ]
    );
  };

  if (authLoading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4A90E2" />
      </View>
    );
  }

  if (!user || !account) {
    return null;
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {isOffline && (
        <View style={[styles.offlineBanner, { backgroundColor: colors.offlineBg, borderBottomColor: colors.offlineBorder }]}>
          <Text style={[styles.offlineText, { color: colors.offlineText }]}>네트워크 연결이 필요합니다</Text>
        </View>
      )}
      <View style={styles.reviewSection}>
        {pendingLoading ? (
          pendingItem ? (
            <ReviewActionCard item={pendingItem} onPressReview={handleReviewPress} />
          ) : (
            <ReviewStatusCard nextDueInDays={undefined} notificationsEnabled />
          )
        ) : pendingError ? (
          <ErrorRetryCard
            title="평가 목록을 불러오지 못했어요"
            desc={toUserMessage(pendingError)}
            onRetry={loadPendingReview}
          />
        ) : pendingItem ? (
          <ReviewActionCard item={pendingItem} onPressReview={handleReviewPress} />
        ) : (
          <ReviewStatusCard nextDueInDays={nextDueInDays} notificationsEnabled />
        )}
      </View>

      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>소비 내역</Text>
      </View>

      {loading && expenses.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <ErrorRetryCard
            title="소비 목록을 불러오지 못했어요"
            desc={toUserMessage(error)}
            onRetry={refresh}
          />
        </View>
      ) : expenses.length === 0 ? (
        <View style={styles.center}>
          <MaterialIcons name="receipt-long" size={64} color={colors.emptyIcon} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            첫 소비를 기록하면{'\n'}3일 뒤(설정한 시각) 리뷰 알림이 잡혀요.{'\n'}식후 감상은 기록할 때 한 줄로 남겨 두면 좋아요.
          </Text>
          <TouchableOpacity
            style={[styles.addFirstButton, { backgroundColor: colors.primary }]}
            onPress={() => router.push('/add-expense')}
          >
            <Text style={[styles.addFirstText, { color: colors.onPrimary }]}>첫 소비 기록하기</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={expenses}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <ExpenseCard
              expense={item}
              onPress={() => handleExpensePress(item.id)}
              onDelete={() => handleDeleteExpense(item.id, item.reason)}
            />
          )}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} />}
        />
      )}

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  reviewSection: {
    marginTop: 16,
    marginHorizontal: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
  },
  list: {
    padding: 16,
    paddingBottom: 120,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 16,
    marginBottom: 16,
  },
  offlineBanner: {
    backgroundColor: '#FFF3CD',
    borderBottomWidth: 1,
    borderBottomColor: '#FFE69C',
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  offlineText: {
    color: '#856404',
    fontSize: 14,
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  addFirstButton: {
    backgroundColor: '#4A90E2',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  addFirstText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
