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
import { useAuth } from '@/hooks/useAuth';
import { useSpaceDetail } from '@/hooks/useSpaceDetail';
import { useSpaceMembers } from '@/hooks/useSpaceMembers';
import { expenseCategoryLabel } from '@/lib/expenseCategoryLabel';
import { formatSpaceDayHeading, formatSpaceEventCreatedAt } from '@/lib/spaceEvent';
import {
  canCreateSpaceSettlement,
  type SpaceSettlementLock,
} from '@/lib/spaceSettlement';
import {
  formatSharedExpenseAmount,
  resolveSpaceSharedExpenseMember,
  type SpaceSharedExpense,
} from '@/lib/spaceSharedExpense';
import {
  DELETE_SHARED_EXPENSE_CONFIRM_LABEL,
  DELETE_SHARED_EXPENSE_CONFIRM_MESSAGE,
  DELETE_SHARED_EXPENSE_CONFIRM_TITLE,
  canMutateSpaceSharedExpense,
  createSharedExpenseWriteGate,
  toSpaceSharedExpenseError,
} from '@/lib/spaceSharedExpenseClient';
import { SPACE_TYPE_BY_ID, spaceTypeButtonFill, spaceTypeButtonInk } from '@/lib/spaceTypes';
import { deleteSpaceSharedExpense, getSpaceSharedExpense } from '@/services/spaceSharedExpenseService';
import { getSpaceSettlementLock } from '@/services/spaceSettlementService';
import { BRAND_GREEN, useTheme } from '@/theme/ThemeContext';
import { showAlert } from '@/utils/alert';
import { firstParam } from '@/utils/routerParams';

export default function SpaceSharedExpenseDetailScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ spaceId?: string | string[]; expenseId?: string | string[] }>();
  const spaceId = firstParam(params.spaceId);
  const expenseId = firstParam(params.expenseId);
  const fallbackHref = spaceId ? `/spaces/${spaceId}/expenses` : '/spaces';
  const { user, isRegistered } = useAuth();
  const uid = isRegistered && user?.uid ? user.uid : null;
  const { space, status: detailStatus, errorKind, errorMessage, retry } = useSpaceDetail(spaceId);
  const membersState = useSpaceMembers(spaceId);
  const accent = space?.type ? SPACE_TYPE_BY_ID[space.type].accent : colors.primary;

  const [expense, setExpense] = useState<SpaceSharedExpense | null>(null);
  const [settlementLock, setSettlementLock] = useState<SpaceSettlementLock | null>(null);
  const [loadStatus, setLoadStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadMessage, setLoadMessage] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const gate = useRef(createSharedExpenseWriteGate());

  useEffect(() => {
    if (!spaceId || !expenseId) return;
    let cancelled = false;
    setLoadStatus('loading');
    void (async () => {
      try {
        const next = await getSpaceSharedExpense(spaceId, expenseId);
        if (cancelled) return;
        setExpense(next);
        try {
          setSettlementLock(await getSpaceSettlementLock(spaceId, expenseId));
        } catch {
          if (!cancelled) setSettlementLock(null);
        }
        setLoadStatus('ready');
      } catch (error) {
        if (cancelled) return;
        setLoadMessage(toSpaceSharedExpenseError(error, 'read').userMessage);
        setLoadStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [expenseId, spaceId]);

  const author = expense ? resolveSpaceSharedExpenseMember(expense.createdByUid, membersState.members) : null;
  const paidBy = expense ? resolveSpaceSharedExpenseMember(expense.paidByUid, membersState.members) : null;
  const canMutate = expense ? canMutateSpaceSharedExpense(expense.createdByUid, uid) : false;
  const canStartSettlement = expense ? canCreateSpaceSettlement(expense.createdByUid, uid) : false;
  const openSettlement = () => {
    if (!spaceId || !expense) return;
    if (settlementLock) {
      router.push({
        pathname: '/spaces/[spaceId]/settlement/[settlementId]',
        params: { spaceId, settlementId: settlementLock.settlementId },
      });
      return;
    }
    if (!canStartSettlement) return;
    router.push({
      pathname: '/spaces/[spaceId]/settlement-form',
      params: { spaceId, expenseId: expense.id },
    });
  };
  const createdLabel = expense ? formatSpaceEventCreatedAt(expense.createdAt) : null;
  const blocked = detailStatus === 'error' || loadStatus === 'error';

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SubScreenHeader title="공동 소비" fallbackHref={fallbackHref} />
      {detailStatus === 'loading' || loadStatus === 'loading' ? (
        <View style={styles.state}>
          <ActivityIndicator size="large" color={BRAND_GREEN} />
        </View>
      ) : blocked ? (
        <View style={styles.errorWrap}>
          <ErrorRetryCard
            title={loadMessage ?? errorMessage ?? '공동 소비를 불러오지 못했어요.'}
            desc={
              errorKind === 'permission-denied'
                ? '이 공간의 멤버만 공동 소비를 볼 수 있어요.'
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
      ) : expense && spaceId ? (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 12) + 24 }]}
        >
          <Text style={[styles.title, { color: colors.text }]}>{expense.title}</Text>
          <Text style={[styles.amount, { color: accent }]}>{formatSharedExpenseAmount(expense.amount)}</Text>
          <Text style={[styles.date, { color: colors.textSec }]}>
            {formatSpaceDayHeading(expense.dateKey)} · {expenseCategoryLabel(expense.category)}
          </Text>

          {paidBy ? (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.textSec }]}>결제자</Text>
              <View style={styles.person}>
                <ProfileAvatar uri={paidBy.photoURL} name={paidBy.displayName} size={36} accent={accent} />
                <Text style={[styles.personName, { color: colors.text }]}>{paidBy.displayName}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textSec }]}>
              참여 멤버 · {expense.participantUids.length}명
            </Text>
            <View style={styles.participants}>
              {expense.participantUids.map((memberUid) => {
                const member = resolveSpaceSharedExpenseMember(memberUid, membersState.members);
                return (
                  <View key={memberUid} style={styles.person}>
                    <ProfileAvatar uri={member.photoURL} name={member.displayName} size={32} accent={accent} />
                    <Text style={[styles.personName, { color: colors.text }]}>{member.displayName}</Text>
                  </View>
                );
              })}
            </View>
          </View>

          {expense.memo ? (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.textSec }]}>메모</Text>
              <Text style={[styles.body, { color: colors.text }]}>{expense.memo}</Text>
            </View>
          ) : null}

          {author ? (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.textSec }]}>작성자</Text>
              <View style={styles.person}>
                <ProfileAvatar uri={author.photoURL} name={author.displayName} size={36} accent={accent} />
                <View>
                  <Text style={[styles.personName, { color: colors.text }]}>{author.displayName}</Text>
                  {createdLabel ? (
                    <Text style={[styles.created, { color: colors.textSec }]}>{createdLabel}</Text>
                  ) : null}
                </View>
              </View>
            </View>
          ) : null}

          {canStartSettlement || settlementLock ? (
            <Pressable
              onPress={openSettlement}
              style={[styles.settleBtn, { backgroundColor: spaceTypeButtonFill(accent, isDark) }]}
            >
              <Text style={[styles.btnText, { color: spaceTypeButtonInk(accent, isDark) }]}>
                {settlementLock ? '정산 보기' : '정산하기'}
              </Text>
            </Pressable>
          ) : null}

          {canMutate ? (
            <View style={styles.actions}>
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/spaces/[spaceId]/expense-form',
                    params: { spaceId, expenseId: expense.id, dateKey: expense.dateKey },
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
        title={DELETE_SHARED_EXPENSE_CONFIRM_TITLE}
        message={DELETE_SHARED_EXPENSE_CONFIRM_MESSAGE}
        confirmLabel={DELETE_SHARED_EXPENSE_CONFIRM_LABEL}
        cancelLabel="취소"
        destructive
        loading={deleteBusy}
        onCancel={() => {
          if (gate.current.busy) return;
          setDeleteOpen(false);
        }}
        onConfirm={() => {
          if (!spaceId || !expense || !canMutateSpaceSharedExpense(expense.createdByUid, uid)) return;
          if (!gate.current.tryStart()) return;
          setDeleteBusy(true);
          void (async () => {
            try {
              await deleteSpaceSharedExpense(spaceId, expense);
              setDeleteOpen(false);
              if (router.canGoBack()) router.back();
              else router.replace(fallbackHref);
            } catch (error) {
              showAlert('공동 소비를 삭제하지 못했어요', toSpaceSharedExpenseError(error, 'write').userMessage);
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
  amount: { marginTop: 8, fontSize: 28, fontWeight: '800' },
  date: { marginTop: 6, fontSize: 13, fontWeight: '700' },
  section: { marginTop: 22 },
  sectionLabel: { fontSize: 12, fontWeight: '800', marginBottom: 10 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  personName: { fontSize: 15, fontWeight: '800' },
  created: { marginTop: 3, fontSize: 12, fontWeight: '600' },
  participants: { gap: 10 },
  body: { fontSize: 16, fontWeight: '600', lineHeight: 24 },
  settleBtn: {
    marginTop: 24,
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { marginTop: 12, flexDirection: 'row', gap: 8 },
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
