import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { ConfirmModal } from '@/components/ConfirmModal';
import { SubScreenHeader } from '@/components/SubScreenHeader';
import { ErrorRetryCard } from '@/components/ErrorRetryCard';
import { SpaceCalendarEntry } from '@/components/spaces/SpaceCalendarEntry';
import { SpaceFeatureGrid } from '@/components/spaces/SpaceFeatureGrid';
import { SpaceInfoCard } from '@/components/spaces/SpaceInfoCard';
import { SpaceMembersPreviewCard } from '@/components/spaces/SpaceMembersCard';
import { SpaceSummaryCards } from '@/components/spaces/SpaceSummaryCards';
import { useAuth } from '@/hooks/useAuth';
import { useSpaceDetail } from '@/hooks/useSpaceDetail';
import { useSpaceMembers } from '@/hooks/useSpaceMembers';
import { isSpaceOwner } from '@/lib/spaceInviteClient';
import {
  LEAVE_CONFIRM_LABEL,
  LEAVE_CONFIRM_MESSAGE,
  LEAVE_CONFIRM_TITLE,
  canShowLeaveSpace,
  isAlreadyLeftError,
  toSpaceMembershipError,
} from '@/lib/spaceMembershipClient';
import { SPACE_TYPE_BY_ID } from '@/lib/spaceTypes';
import { leaveSpace } from '@/services/spaceMembershipService';
import { useTheme, BRAND_GREEN } from '@/theme/ThemeContext';
import { showAlert } from '@/utils/alert';
import { firstParam } from '@/utils/routerParams';

function comingSoon(message: string) {
  showAlert('준비 중이에요', message);
}

export default function SpaceDetailScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ spaceId?: string | string[] }>();
  const spaceId = firstParam(params.spaceId);
  const { user, isRegistered } = useAuth();
  const uid = isRegistered && user?.uid ? user.uid : null;
  const { space, myRole, status, errorKind, errorMessage, retry } = useSpaceDetail(spaceId);
  const membersState = useSpaceMembers(spaceId);
  const accent = space?.type ? SPACE_TYPE_BY_ID[space.type].accent : colors.primary;
  const canInvite = isSpaceOwner(myRole, space?.ownerUid, uid) && Boolean(spaceId);
  const canLeave = status === 'ready' && canShowLeaveSpace(myRole, space?.ownerUid, uid);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveBusy, setLeaveBusy] = useState(false);
  const leaveBusyRef = useRef(false);

  const openMembers = () => {
    if (!spaceId) return;
    router.push({
      pathname: '/spaces/[spaceId]/members',
      params: { spaceId },
    });
  };

  const openMemories = () => {
    if (!spaceId) return;
    router.push({
      pathname: '/spaces/[spaceId]/memories',
      params: { spaceId },
    });
  };

  const openSpending = () => {
    if (!spaceId) return;
    router.push({
      pathname: '/spaces/[spaceId]/expenses',
      params: { spaceId },
    });
  };

  const openSettle = () => {
    if (!spaceId) return;
    router.push({
      pathname: '/spaces/[spaceId]/settlements',
      params: { spaceId },
    });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SubScreenHeader
        title="함께한 공간"
        fallbackHref="/spaces"
        right={
          <Pressable
            onPress={() => comingSoon('공간 설정 기능을 준비하고 있어요.')}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="공간 설정"
          >
            <MaterialIcons name="settings" size={22} color={colors.text} />
          </Pressable>
        }
      />

      {status === 'loading' || (status === 'error' && errorKind === 'unauthenticated') ? (
        <View style={styles.stateWrap}>
          <ActivityIndicator size="large" color={BRAND_GREEN} />
        </View>
      ) : status === 'error' ? (
        <View style={styles.errorWrap}>
          <ErrorRetryCard
            title={errorMessage ?? '공간 정보를 불러오지 못했어요.'}
            desc={
              errorKind === 'permission-denied'
                ? '이 공간의 멤버만 볼 수 있어요.'
                : errorKind === 'not-found'
                  ? '주소가 바뀌었거나 공간이 삭제됐을 수 있어요.'
                  : errorKind === 'inactive'
                    ? '이 공간은 현재 사용할 수 없어요.'
                    : '네트워크 연결을 확인한 뒤 다시 시도해 주세요.'
            }
            onRetry={retry}
          />
        </View>
      ) : space ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom, 12) + 32 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <SpaceInfoCard
            space={space}
            role={myRole}
            onInvite={
              canInvite
                ? () =>
                    router.push({
                      pathname: '/spaces/[spaceId]/invite',
                      params: { spaceId },
                    })
                : undefined
            }
          />

          <View style={styles.membersWrap}>
            <SpaceMembersPreviewCard
              members={membersState.members}
              status={membersState.status}
              refreshing={membersState.refreshing}
              errorMessage={membersState.errorMessage}
              accent={accent}
              onRetry={membersState.retry}
              onSeeAll={openMembers}
            />
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>우리의 기록</Text>
          <SpaceSummaryCards />

          <Text style={[styles.sectionTitle, { color: colors.text }]}>공유 캘린더</Text>
          <SpaceCalendarEntry
            accent={accent}
            onPress={() =>
              router.push({
                pathname: '/spaces/[spaceId]/calendar',
                params: { spaceId: space.id },
              })
            }
          />

          <Text style={[styles.sectionTitle, { color: colors.text }]}>함께하는 기능</Text>
          <SpaceFeatureGrid
            accent={accent}
            onSelect={comingSoon}
            onMembers={openMembers}
            onMemories={openMemories}
            onSpending={openSpending}
            onSettle={openSettle}
          />

          {canLeave ? (
            <Pressable
              onPress={() => {
                if (leaveBusyRef.current) return;
                setLeaveOpen(true);
              }}
              disabled={leaveBusy}
              style={({ pressed }) => [
                styles.leaveBtn,
                {
                  borderColor: colors.logoutBorder,
                  backgroundColor: colors.surface,
                  opacity: leaveBusy || pressed ? 0.78 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel="공간에서 나가기"
            >
              <MaterialIcons name="logout" size={18} color={colors.logoutText} />
              <Text style={[styles.leaveText, { color: colors.logoutText }]}>공간에서 나가기</Text>
            </Pressable>
          ) : null}
        </ScrollView>
      ) : (
        <View style={styles.stateWrap}>
          <ActivityIndicator size="large" color={BRAND_GREEN} />
        </View>
      )}

      <ConfirmModal
        visible={leaveOpen}
        title={LEAVE_CONFIRM_TITLE}
        message={LEAVE_CONFIRM_MESSAGE}
        confirmLabel={LEAVE_CONFIRM_LABEL}
        cancelLabel="취소"
        destructive
        loading={leaveBusy}
        onCancel={() => {
          if (leaveBusyRef.current) return;
          setLeaveOpen(false);
        }}
        onConfirm={() => {
          if (leaveBusyRef.current || !spaceId) return;
          leaveBusyRef.current = true;
          setLeaveBusy(true);
          void (async () => {
            try {
              await leaveSpace(spaceId);
              setLeaveOpen(false);
              router.replace('/spaces');
            } catch (error) {
              const mapped = toSpaceMembershipError(error, 'leave');
              if (isAlreadyLeftError(mapped)) {
                setLeaveOpen(false);
                router.replace('/spaces');
                return;
              }
              showAlert('공간을 나가지 못했어요', mapped.userMessage);
            } finally {
              leaveBusyRef.current = false;
              setLeaveBusy(false);
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
  membersWrap: {
    marginTop: 16,
  },
  sectionTitle: {
    marginTop: 22,
    marginBottom: 12,
    fontSize: 15,
    fontWeight: '800',
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
  leaveBtn: {
    marginTop: 28,
    minHeight: 52,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  leaveText: {
    fontSize: 16,
    fontWeight: '800',
  },
});
