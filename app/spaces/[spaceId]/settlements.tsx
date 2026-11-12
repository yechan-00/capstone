import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ErrorRetryCard } from '@/components/ErrorRetryCard';
import { SubScreenHeader } from '@/components/SubScreenHeader';
import { SpaceSettlementCard } from '@/components/spaces/SpaceSettlementCard';
import { SpaceSettlementSummaryCard } from '@/components/spaces/SpaceSettlementSummaryCard';
import { useSpaceDetail } from '@/hooks/useSpaceDetail';
import { useSpaceSettlementSummary } from '@/hooks/useSpaceSettlementSummary';
import { useSpaceSettlements } from '@/hooks/useSpaceSettlements';
import { spaceSettlementErrorCardCopy } from '@/lib/spaceSettlementClient';
import { SPACE_TYPE_BY_ID } from '@/lib/spaceTypes';
import { BRAND_GREEN, useTheme } from '@/theme/ThemeContext';
import { firstParam } from '@/utils/routerParams';

export default function SpaceSettlementsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ spaceId?: string | string[] }>();
  const spaceId = firstParam(params.spaceId);
  const fallbackHref = spaceId ? `/spaces/${spaceId}` : '/spaces';
  const { space, status: detailStatus, errorKind: detailKind, retry: retryDetail } =
    useSpaceDetail(spaceId);
  const list = useSpaceSettlements(spaceId);
  const summaryState = useSpaceSettlementSummary(spaceId);
  const accent = space?.type ? SPACE_TYPE_BY_ID[space.type].accent : colors.primary;
  const errorKind = list.errorKind ?? detailKind;
  const errorCopy = spaceSettlementErrorCardCopy(errorKind);

  const blocked = detailStatus === 'error' || list.status === 'error';
  const showSpinner = (detailStatus === 'loading' || list.status === 'loading') && !blocked;

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SubScreenHeader title="정산" fallbackHref={fallbackHref} />
      {showSpinner ? (
        <View style={styles.state}>
          <ActivityIndicator size="large" color={BRAND_GREEN} />
        </View>
      ) : blocked ? (
        <View style={styles.errorWrap}>
          <ErrorRetryCard
            title={errorCopy.title}
            desc={errorCopy.desc}
            onRetry={() => {
              if (errorKind === 'unauthenticated') {
                router.replace(Platform.OS === 'web' ? '/home' : '/(auth)/login');
                return;
              }
              retryDetail();
              list.retry();
              summaryState.retry();
            }}
          />
        </View>
      ) : (
        <FlatList
          data={list.settlements}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom, 12) + 32 },
            list.settlements.length === 0 ? styles.emptyContent : null,
          ]}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          onEndReachedThreshold={0.4}
          onEndReached={list.loadMore}
          ListHeaderComponent={
            <SpaceSettlementSummaryCard summary={summaryState.summary} accent={accent} />
          }
          ListEmptyComponent={
            <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Text style={[styles.emptyTitle, { color: colors.text }]}>아직 정산이 없어요</Text>
              <Text style={[styles.emptyDesc, { color: colors.textSec }]}>
                공동 소비 상세에서 정산을 시작할 수 있어요. 실제 송금은 이 앱에서 하지 않아요.
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
              <SpaceSettlementCard
                settlement={item}
                accent={accent}
                onPress={() =>
                  router.push({
                    pathname: '/spaces/[spaceId]/settlement/[settlementId]',
                    params: { spaceId, settlementId: item.id },
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
  empty: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  emptyTitle: { fontSize: 16, fontWeight: '800' },
  emptyDesc: { marginTop: 6, fontSize: 13, fontWeight: '600', lineHeight: 19 },
  more: { paddingVertical: 16, alignItems: 'center' },
});
