import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfirmModal } from '@/components/ConfirmModal';
import { SubScreenHeader } from '@/components/SubScreenHeader';
import { ErrorRetryCard } from '@/components/ErrorRetryCard';
import { SpaceMemberRow } from '@/components/spaces/SpaceMembersCard';
import { useAuth } from '@/hooks/useAuth';
import { useSpaceDetail } from '@/hooks/useSpaceDetail';
import { useSpaceMembers } from '@/hooks/useSpaceMembers';
import { isSpaceOwner } from '@/lib/spaceInviteClient';
import {
  REMOVE_CONFIRM_LABEL,
  REMOVE_CONFIRM_MESSAGE,
  REMOVE_CONFIRM_TITLE,
  canShowRemoveMember,
  isAlreadyRemovedError,
  toSpaceMembershipError,
} from '@/lib/spaceMembershipClient';
import type { SpaceMember } from '@/lib/spaceMembersClient';
import { SPACE_TYPE_BY_ID } from '@/lib/spaceTypes';
import { removeSpaceMember } from '@/services/spaceMembershipService';
import { BRAND_GREEN, useTheme } from '@/theme/ThemeContext';
import { showAlert } from '@/utils/alert';
import { firstParam } from '@/utils/routerParams';

export default function SpaceMembersScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ spaceId?: string | string[] }>();
  const spaceId = firstParam(params.spaceId);
  const { user, isRegistered } = useAuth();
  const uid = isRegistered && user?.uid ? user.uid : null;
  const {
    space,
    myRole,
    status: detailStatus,
    errorKind: detailKind,
    errorMessage: detailError,
    retry: retryDetail,
  } = useSpaceDetail(spaceId);
  const { members, status, refreshing, errorKind, errorMessage, retry, refresh } = useSpaceMembers(spaceId);
  const accent = space?.type ? SPACE_TYPE_BY_ID[space.type].accent : colors.primary;
  const fallbackHref = spaceId ? `/spaces/${spaceId}` : '/spaces';
  const viewerIsOwner = isSpaceOwner(myRole, space?.ownerUid, uid);
  const [target, setTarget] = useState<SpaceMember | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const removeBusyRef = useRef(false);

  const blocked = detailStatus === 'error' || status === 'error';
  const blockingKind = detailStatus === 'error' ? detailKind : errorKind;
  const blockingMessage = detailStatus === 'error' ? detailError : errorMessage;
  const showSpinner =
    (detailStatus === 'loading' || status === 'loading') && !refreshing && !blocked;
  const canRetryUnauth = blockingKind === 'unauthenticated';

  const onRetry = () => {
    if (canRetryUnauth) {
      router.replace(Platform.OS === 'web' ? '/home' : '/(auth)/login');
      return;
    }
    retryDetail();
    retry();
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SubScreenHeader title="멤버" fallbackHref={fallbackHref} />

      {showSpinner ? (
        <View style={styles.stateWrap}>
          <ActivityIndicator size="large" color={BRAND_GREEN} />
        </View>
      ) : blocked ? (
        <View style={styles.errorWrap}>
          <ErrorRetryCard
            title={blockingMessage ?? '멤버 목록을 불러오지 못했어요.'}
            desc={
              blockingKind === 'permission-denied'
                ? '이 공간의 멤버만 볼 수 있어요.'
                : blockingKind === 'not-found'
                  ? '주소가 바뀌었거나 공간이 삭제됐을 수 있어요.'
                  : blockingKind === 'inactive'
                    ? '이 공간은 현재 사용할 수 없어요.'
                    : blockingKind === 'unauthenticated'
                      ? '로그인 후 다시 시도해 주세요.'
                      : '네트워크 연결을 확인한 뒤 다시 시도해 주세요.'
            }
            onRetry={onRetry}
          />
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom, 12) + 32 },
          ]}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                void refresh();
              }}
              tintColor={BRAND_GREEN}
            />
          }
        >
          {space ? (
            <Text style={[styles.caption, { color: colors.textSec }]}>
              {space.name}
            </Text>
          ) : null}
          <Text style={[styles.count, { color: colors.text }]}>
            {members.length}명
          </Text>
          <View style={styles.list}>
            {members.map((member) => {
              const showRemove = canShowRemoveMember({
                viewerIsOwner,
                viewerUid: uid,
                member,
              });
              return (
                <SpaceMemberRow
                  key={member.uid}
                  member={member}
                  accent={accent}
                  isCurrentUser={Boolean(uid && member.uid === uid)}
                  onRemove={
                    showRemove
                      ? () => {
                          if (removeBusyRef.current) return;
                          setTarget(member);
                        }
                      : undefined
                  }
                  removing={removeBusy && target?.uid === member.uid}
                />
              );
            })}
          </View>
        </ScrollView>
      )}

      <ConfirmModal
        visible={target != null}
        title={REMOVE_CONFIRM_TITLE}
        message={REMOVE_CONFIRM_MESSAGE}
        confirmLabel={REMOVE_CONFIRM_LABEL}
        cancelLabel="취소"
        destructive
        loading={removeBusy}
        onCancel={() => {
          if (removeBusyRef.current) return;
          setTarget(null);
        }}
        onConfirm={() => {
          if (removeBusyRef.current || !spaceId || !target) return;
          const memberUid = target.uid;
          removeBusyRef.current = true;
          setRemoveBusy(true);
          void (async () => {
            try {
              await removeSpaceMember(spaceId, memberUid);
              setTarget(null);
              await refresh();
            } catch (error) {
              const mapped = toSpaceMembershipError(error, 'remove');
              if (isAlreadyRemovedError(mapped)) {
                setTarget(null);
                await refresh();
                return;
              }
              showAlert('멤버를 내보내지 못했어요', mapped.userMessage);
            } finally {
              removeBusyRef.current = false;
              setRemoveBusy(false);
            }
          })();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  caption: {
    fontSize: 13,
    fontWeight: '700',
  },
  count: {
    marginTop: 4,
    marginBottom: 16,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  list: {
    gap: 10,
  },
  stateWrap: {
    flex: 1,
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorWrap: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
});
