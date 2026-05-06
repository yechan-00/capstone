import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { ReviewSchedule } from '@/lib/types';
import { scheduleService } from '@/services/scheduleService';
import { useAuth } from '@/hooks/useAuth';
import { getDaysUntil } from '@/utils/time';
import { scheduleDueLabel } from '@/lib/scheduleLabels';

interface ReviewPromptBannerProps {
  onPress: (schedule: ReviewSchedule) => void;
}

export const ReviewPromptBanner: React.FC<ReviewPromptBannerProps> = ({ onPress }) => {
  const { account } = useAuth();
  const [pendingSchedules, setPendingSchedules] = useState<ReviewSchedule[]>([]);
  const [nextSchedule, setNextSchedule] = useState<ReviewSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!account) {
      setPendingSchedules([]);
      setLoading(false);
      return;
    }

    loadPendingSchedules();
  }, [account]);

  const loadPendingSchedules = async () => {
    if (!account) return;

    try {
      setLoading(true);
      setError(false);
      const schedules = await scheduleService.getPendingSchedules(account.id);
      setPendingSchedules(schedules);
      if (schedules.length === 0) {
        const upcoming = await scheduleService.getNextUpcomingSchedule(account.id);
        setNextSchedule(upcoming);
      } else {
        setNextSchedule(null);
      }
    } catch (error) {
      setError(true);
      setPendingSchedules([]);
      setNextSchedule(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="small" color="#fff" />
      </View>
    );
  }

  const todaySchedule = pendingSchedules[0];
  const hasPending = pendingSchedules.length > 0;
  const delayText = todaySchedule ? scheduleDueLabel(todaySchedule.type) : '';
  const daysUntil = nextSchedule ? getDaysUntil(nextSchedule.dueAt) : null;

  return (
    <TouchableOpacity
      style={[styles.container, error && styles.errorContainer]}
      onPress={() => {
        if (hasPending && todaySchedule) {
          onPress(todaySchedule);
        } else {
          loadPendingSchedules();
        }
      }}
      activeOpacity={0.8}
    >
      <View style={styles.content}>
        {error ? (
          <>
            <Text style={styles.title}>평가 목록을 불러오지 못했어요</Text>
            <Text style={styles.subtitle}>다시 시도할 수 있어요</Text>
            <Text style={styles.count}>탭해서 다시 시도</Text>
          </>
        ) : hasPending ? (
          <>
            <Text style={styles.title}>오늘 평가할 소비가 있어요</Text>
            <Text style={styles.subtitle}>
              {delayText ? `${delayText} · ` : ''}후회도를 평가해 보세요
            </Text>
            <Text style={styles.count}>{pendingSchedules.length}개 대기 중</Text>
          </>
        ) : (
          <>
            <Text style={styles.title}>평가 대기 없음</Text>
            <Text style={styles.subtitle}>
              {daysUntil !== null ? `다음 평가까지 D-${daysUntil}` : '다음 평가가 준비되면 알려드릴게요'}
            </Text>
            <Text style={styles.count}>소비를 기록하면 스케줄이 생성돼요</Text>
          </>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#4A90E2',
    padding: 16,
    marginHorizontal: 16,
    marginTop: 16,
    borderRadius: 8,
  },
  errorContainer: {
    backgroundColor: '#FF6B6B',
  },
  content: {
    alignItems: 'center',
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  subtitle: {
    color: '#fff',
    fontSize: 14,
    opacity: 0.9,
    marginBottom: 4,
  },
  count: {
    color: '#fff',
    fontSize: 12,
    opacity: 0.8,
    marginTop: 4,
  },
});
