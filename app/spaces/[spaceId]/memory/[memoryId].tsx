import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ConfirmModal } from '@/components/ConfirmModal';
import { ErrorRetryCard } from '@/components/ErrorRetryCard';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { SubScreenHeader } from '@/components/SubScreenHeader';
import { SpaceMemoryGallery } from '@/components/spaces/SpaceMemoryGallery';
import { useAuth } from '@/hooks/useAuth';
import { useAuthBearerHeaders } from '@/hooks/useAuthBearerHeaders';
import { useSpaceDetail } from '@/hooks/useSpaceDetail';
import { useSpaceMembers } from '@/hooks/useSpaceMembers';
import { formatSpaceDayHeading, formatSpaceEventCreatedAt } from '@/lib/spaceEvent';
import { resolveSpaceMemoryAuthor, type SpaceMemory } from '@/lib/spaceMemory';
import {
  DELETE_MEMORY_CONFIRM_LABEL,
  DELETE_MEMORY_CONFIRM_MESSAGE,
  DELETE_MEMORY_CONFIRM_TITLE,
  canMutateSpaceMemory,
  createMemoryWriteGate,
  toSpaceMemoryError,
} from '@/lib/spaceMemoryClient';
import { SPACE_TYPE_BY_ID, spaceTypeButtonFill, spaceTypeButtonInk } from '@/lib/spaceTypes';
import { deleteSpaceMemory, getSpaceMemory } from '@/services/spaceMemoryService';
import { BRAND_GREEN, useTheme } from '@/theme/ThemeContext';
import { showAlert } from '@/utils/alert';
import { firstParam } from '@/utils/routerParams';

export default function SpaceMemoryDetailScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ spaceId?: string | string[]; memoryId?: string | string[] }>();
  const spaceId = firstParam(params.spaceId);
  const memoryId = firstParam(params.memoryId);
  const fallbackHref = spaceId ? `/spaces/${spaceId}/memories` : '/spaces';
  const { user, isRegistered } = useAuth();
  const uid = isRegistered && user?.uid ? user.uid : null;
  const { space, status: detailStatus, errorKind, errorMessage, retry } = useSpaceDetail(spaceId);
  const membersState = useSpaceMembers(spaceId);
  const { headers } = useAuthBearerHeaders();
  const accent = space?.type ? SPACE_TYPE_BY_ID[space.type].accent : colors.primary;

  const [memory, setMemory] = useState<SpaceMemory | null>(null);
  const [loadStatus, setLoadStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadMessage, setLoadMessage] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const gate = useRef(createMemoryWriteGate());

  useEffect(() => {
    if (!spaceId || !memoryId) return;
    let cancelled = false;
    setLoadStatus('loading');
    void (async () => {
      try {
        const next = await getSpaceMemory(spaceId, memoryId);
        if (cancelled) return;
        setMemory(next);
        setLoadStatus('ready');
      } catch (error) {
        if (cancelled) return;
        setLoadMessage(toSpaceMemoryError(error, 'read').userMessage);
        setLoadStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [memoryId, spaceId]);

  const author = memory ? resolveSpaceMemoryAuthor(memory.createdByUid, membersState.members) : null;
  const canMutate = memory ? canMutateSpaceMemory(memory.createdByUid, uid) : false;
  const createdLabel = memory ? formatSpaceEventCreatedAt(memory.createdAt) : null;
  const blocked = detailStatus === 'error' || loadStatus === 'error';

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SubScreenHeader title="기록" fallbackHref={fallbackHref} />
      {detailStatus === 'loading' || loadStatus === 'loading' ? (
        <View style={styles.state}>
          <ActivityIndicator size="large" color={BRAND_GREEN} />
        </View>
      ) : blocked ? (
        <View style={styles.errorWrap}>
          <ErrorRetryCard
            title={loadMessage ?? errorMessage ?? '기록을 불러오지 못했어요.'}
            desc={
              errorKind === 'permission-denied'
                ? '이 공간의 멤버만 기록을 볼 수 있어요.'
                : '네트워크 연결을 확인한 뒤 다시 시도해 주세요.'
            }
            onRetry={() => {
              if (errorKind === 'unauthenticated') {
                router.replace(Platform.OS === 'web' ? '/home' : '/(auth)/login');
                return;
              }
              retry();
            }}
          />
        </View>
      ) : memory && spaceId ? (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 12) + 24 }]}
        >
          <Text style={[styles.title, { color: colors.text }]}>{memory.title}</Text>
          <Text style={[styles.date, { color: colors.textSec }]}>{formatSpaceDayHeading(memory.dateKey)}</Text>

          {author ? (
            <View style={styles.authorRow}>
              <ProfileAvatar uri={author.photoURL} name={author.displayName} size={40} accent={accent} />
              <View>
                <Text style={[styles.author, { color: colors.text }]}>{author.displayName}</Text>
                {createdLabel ? (
                  <Text style={[styles.created, { color: colors.textSec }]}>{createdLabel}</Text>
                ) : null}
              </View>
            </View>
          ) : null}

          {memory.imageKeys.length > 0 ? (
            <View style={styles.gallery}>
              <SpaceMemoryGallery
                spaceId={spaceId}
                memoryId={memory.id}
                imageKeys={memory.imageKeys}
                title={memory.title}
                headers={headers}
              />
            </View>
          ) : null}

          {memory.content ? (
            <Text style={[styles.body, { color: colors.text }]}>{memory.content}</Text>
          ) : null}

          {canMutate ? (
            <View style={styles.actions}>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/spaces/[spaceId]/memory-form',
                    params: { spaceId, memoryId: memory.id, dateKey: memory.dateKey },
                  })
                }
                style={[styles.btn, { backgroundColor: spaceTypeButtonFill(accent, isDark) }]}
              >
                <Text style={[styles.btnText, { color: spaceTypeButtonInk(accent, isDark) }]}>수정</Text>
              </Pressable>
              <Pressable
                onPress={() => setDeleteOpen(true)}
                style={[styles.btn, { borderColor: colors.logoutBorder, borderWidth: StyleSheet.hairlineWidth }]}
              >
                <Text style={[styles.btnText, { color: colors.logoutText }]}>삭제</Text>
              </Pressable>
            </View>
          ) : (
            <Text style={[styles.readonly, { color: colors.textMuted }]}>작성한 멤버만 수정할 수 있어요.</Text>
          )}
        </ScrollView>
      ) : null}

      <ConfirmModal
        visible={deleteOpen}
        title={DELETE_MEMORY_CONFIRM_TITLE}
        message={DELETE_MEMORY_CONFIRM_MESSAGE}
        confirmLabel={DELETE_MEMORY_CONFIRM_LABEL}
        cancelLabel="취소"
        destructive
        loading={deleteBusy}
        onCancel={() => {
          if (gate.current.busy) return;
          setDeleteOpen(false);
        }}
        onConfirm={() => {
          if (!spaceId || !memory || !canMutateSpaceMemory(memory.createdByUid, uid)) return;
          if (!gate.current.tryStart()) return;
          setDeleteBusy(true);
          void (async () => {
            try {
              await deleteSpaceMemory(spaceId, memory);
              setDeleteOpen(false);
              if (router.canGoBack()) router.back();
              else router.replace(fallbackHref);
            } catch (error) {
              showAlert('기록을 삭제하지 못했어요', toSpaceMemoryError(error, 'write').userMessage);
            } finally {
              gate.current.end();
              setDeleteBusy(false);
            }
          })();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorWrap: { paddingHorizontal: 20, paddingTop: 24 },
  content: { paddingHorizontal: 20, paddingTop: 20 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  date: { marginTop: 6, fontSize: 13, fontWeight: '700' },
  authorRow: { marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  author: { fontSize: 15, fontWeight: '800' },
  created: { marginTop: 3, fontSize: 12, fontWeight: '600' },
  gallery: { marginTop: 18 },
  body: { marginTop: 18, fontSize: 16, fontWeight: '600', lineHeight: 24 },
  actions: { marginTop: 24, flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: 15, fontWeight: '800' },
  readonly: { marginTop: 18, fontSize: 13, fontWeight: '600' },
});
