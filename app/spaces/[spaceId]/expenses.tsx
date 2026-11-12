import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { ErrorRetryCard } from '@/components/ErrorRetryCard';
import { SubScreenHeader } from '@/components/SubScreenHeader';
import { SpaceSharedExpenseCard } from '@/components/spaces/SpaceSharedExpenseCard';
import { useSpaceDetail } from '@/hooks/useSpaceDetail';
import { useSpaceMembers } from '@/hooks/useSpaceMembers';
import { useSpaceSharedExpenses } from '@/hooks/useSpaceSharedExpenses';
import { SPACE_TYPE_BY_ID, spaceTypeButtonFill, spaceTypeButtonInk } from '@/lib/spaceTypes';
import { BRAND_GREEN, useTheme } from '@/theme/ThemeContext';
import { firstParam } from '@/utils/routerParams';

export default function SpaceSharedExpensesScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ spaceId?: string | string[] }>();
  const spaceId = firstParam(params.spaceId);
  const fallbackHref = spaceId ? `/spaces/${spaceId}` : '/spaces';
  const { space, status: detailStatus, errorKind: detailKind, errorMessage: detailError, retry: retryDetail } =
    useSpaceDetail(spaceId);
  const membersState = useSpaceMembers(spaceId);
  const list = useSpaceSharedExpenses(spaceId);
  const accent = space?.type ? SPACE_TYPE_BY_ID[space.type].accent : colors.primary;

  const openForm = (dateKey?: string) => {
    if (!spaceId) return;
    router.push({
      pathname: '/spaces/[spaceId]/expense-form',
      params: dateKey ? { spaceId, dateKey } : { spaceId },
    });
  };

  const blocked = detailStatus === 'error' || list.status === 'error';
  const showSpinner = (detailStatus === 'loading' || list.status === 'loading') && !blocked;

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SubScreenHeader title="공동 소비" fallbackHref={fallbackHref} />
      {showSpinner ? (
        <View style={styles.state}>
          <ActivityIndicator size="large" color={BRAND_GREEN} />
        </View>
      ) : blocked ? (
        <View style={styles.errorWrap}>
          <ErrorRetryCard
            title={list.errorMessage ?? detailError ?? '공동 소비를 불러오지 못했어요.'}
            desc={
              (list.errorKind ?? detailKind) === 'permission-denied'
                ? '이 공간의 멤버만 공동 소비를 볼 수 있어요.'
                : '네트워크 연결을 확인한 뒤 다시 시도해 주세요.'
            }
            onRetry={() => {
              if ((list.errorKind ?? detailKind) === 'unauthenticated') {
                router.replace(Platform.OS === 'web' ? '/home' : '/(auth)/login');
                return;
              }
              retryDetail();
              list.retry();
            }}
          />
        </View>
      ) : (
        <FlatList
          data={list.expenses}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom, 12) + 32 },
            list.expenses.length === 0 ? styles.emptyContent : null,
          ]}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          onEndReachedThreshold={0.4}
          onEndReached={list.loadMore}
          ListHeaderComponent={
            <Pressable
              onPress={() => openForm()}
              style={[styles.addBtn, { backgroundColor: spaceTypeButtonFill(accent, isDark) }]}
              accessibilityRole="button"
              accessibilityLabel="공동 소비 추가"
            >
              <MaterialIcons name="add" size={18} color={spaceTypeButtonInk(accent, isDark)} />
              <Text style={[styles.addText, { color: spaceTypeButtonInk(accent, isDark) }]}>공동 소비 추가</Text>
            </Pressable>
          }
          ListEmptyComponent={
            <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>아직 공동 소비가 없어요</Text>
              <Text style={[styles.emptyDesc, { color: colors.textSec }]}>
                함께 쓴 돈은 이 공간에만 기록돼요. 개인 가계부에는 자동으로 들어가지 않아요.
              </Text>
            </View>
          }
          ListFooterComponent={
            list.loadingMore ? (
              <View style={styles.more}>
                <ActivityIndicator color={BRAND_GREEN} />
              </View>
            ) : null
          }
          renderItem={({ item }) =>
            spaceId ? (
              <SpaceSharedExpenseCard
                expense={item}
                members={membersState.members}
                accent={accent}
                onPress={() =>
                  router.push({
                    pathname: '/spaces/[spaceId]/expense/[expenseId]',
                    params: { spaceId, expenseId: item.id },
                  })
                }
              />
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 16 },
  emptyContent: { flexGrow: 1 },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorWrap: { paddingHorizontal: 20, paddingTop: 24 },
  addBtn: {
    minHeight: 44,
    borderRadius: 12,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  addText: { fontSize: 14, fontWeight: '800' },
  empty: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800' },
  emptyDesc: { marginTop: 6, fontSize: 13, fontWeight: '600', lineHeight: 19 },
  more: { paddingVertical: 16, alignItems: 'center' },
});
