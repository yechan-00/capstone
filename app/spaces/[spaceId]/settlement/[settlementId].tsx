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
import { formatSpaceDayHeading, formatSpaceEventCreatedAt } from '@/lib/spaceEvent';
import {
  canCompleteSettlementTransfer,
  canEditOrCancelSpaceSettlement,
  expenseDiffersFromSettlement,
  formatSettlementAmount,
  resolveSettlementMember,
  settlementHasCompletedTransfer,
  settlementOverallLabel,
  type SettlementTransfer,
  type SpaceSettlement,
} from '@/lib/spaceSettlement';
import {
  CANCEL_SETTLEMENT_CONFIRM_LABEL,
  CANCEL_SETTLEMENT_CONFIRM_MESSAGE,
  CANCEL_SETTLEMENT_CONFIRM_TITLE,
  COMPLETE_LAST_TRANSFER_CONFIRM_LABEL,
  COMPLETE_LAST_TRANSFER_CONFIRM_MESSAGE,
  COMPLETE_LAST_TRANSFER_CONFIRM_TITLE,
  COMPLETE_TRANSFER_CONFIRM_LABEL,
  COMPLETE_TRANSFER_CONFIRM_MESSAGE,
  COMPLETE_TRANSFER_CONFIRM_TITLE,
  UNCOMPLETE_TRANSFER_CONFIRM_LABEL,
  UNCOMPLETE_TRANSFER_CONFIRM_MESSAGE,
  UNCOMPLETE_TRANSFER_CONFIRM_TITLE,
  classifySpaceSettlementError,
  createSettlementWriteGate,
  logSpaceSettlementError,
  spaceSettlementErrorCardCopy,
  toSpaceSettlementError,
  type SpaceSettlementErrorKind,
} from '@/lib/spaceSettlementClient';
import type { SpaceSharedExpense } from '@/lib/spaceSharedExpense';
import { SPACE_TYPE_BY_ID, spaceTypeButtonFill, spaceTypeButtonInk } from '@/lib/spaceTypes';
import { getSpaceSharedExpense } from '@/services/spaceSharedExpenseService';
import {
  cancelSpaceSettlement,
  getSpaceSettlement,
  setSpaceSettlementTransferStatus,
} from '@/services/spaceSettlementService';
import { BRAND_GREEN, useTheme } from '@/theme/ThemeContext';
import { showAlert } from '@/utils/alert';
import { firstParam } from '@/utils/routerParams';

type ConfirmKind = 'cancel' | 'complete' | 'uncomplete';

export default function SpaceSettlementDetailScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ spaceId?: string | string[]; settlementId?: string | string[] }>();
  const spaceId = firstParam(params.spaceId);
  const settlementId = firstParam(params.settlementId);
  const fallbackHref = spaceId ? `/spaces/${spaceId}/settlements` : '/spaces';
  const { user, isRegistered } = useAuth();
  const uid = isRegistered && user?.uid ? user.uid : null;
  const { space, status: detailStatus, errorKind, retry } = useSpaceDetail(spaceId);
  const membersState = useSpaceMembers(spaceId);
  const accent = space?.type ? SPACE_TYPE_BY_ID[space.type].accent : colors.primary;

  const [settlement, setSettlement] = useState<SpaceSettlement | null>(null);
  const [expense, setExpense] = useState<SpaceSharedExpense | null>(null);
  const [loadStatus, setLoadStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadErrorKind, setLoadErrorKind] = useState<SpaceSettlementErrorKind | null>(null);
  const [confirmKind, setConfirmKind] = useState<ConfirmKind | null>(null);
  const [targetTransfer, setTargetTransfer] = useState<SettlementTransfer | null>(null);
  const [busy, setBusy] = useState(false);
  const gate = useRef(createSettlementWriteGate());

  const reload = async () => {
    if (!spaceId || !settlementId) return;
    const next = await getSpaceSettlement(spaceId, settlementId);
    setSettlement(next);
    try {
      setExpense(await getSpaceSharedExpense(spaceId, next.sharedExpenseId));
    } catch {
      setExpense(null);
    }
  };

  useEffect(() => {
    if (!spaceId || !settlementId) return;
    let cancelled = false;
    setLoadStatus('loading');
    void (async () => {
      try {
        const next = await getSpaceSettlement(spaceId, settlementId);
        if (cancelled) return;
        setSettlement(next);
        try {
          setExpense(await getSpaceSharedExpense(spaceId, next.sharedExpenseId));
        } catch {
          if (!cancelled) setExpense(null);
        }
        setLoadStatus('ready');
      } catch (error) {
        if (cancelled) return;
        logSpaceSettlementError('SpaceSettlementDetail', error);
        setLoadErrorKind(classifySpaceSettlementError(error));
        setLoadStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [settlementId, spaceId]);

  const canEdit = settlement
    ? canEditOrCancelSpaceSettlement(settlement.createdByUid, uid)
      && settlement.status === 'open'
      && !settlementHasCompletedTransfer(settlement.transfers)
    : false;
  const canCancel = settlement
    ? canEditOrCancelSpaceSettlement(settlement.createdByUid, uid) && settlement.status === 'open'
    : false;
  const mismatch = settlement ? expenseDiffersFromSettlement(expense, settlement) : false;
  const paidBy = settlement ? resolveSettlementMember(settlement.paidByUidSnapshot, membersState.members) : null;
  const blocked = detailStatus === 'error' || loadStatus === 'error';
  const resolvedErrorKind = loadErrorKind ?? errorKind;
  const errorCopy = spaceSettlementErrorCardCopy(resolvedErrorKind ?? null);
  const pendingTransferCount = settlement
    ? settlement.transfers.filter((row) => row.status !== 'completed').length
    : 0;
  const isLastComplete =
    confirmKind === 'complete' && targetTransfer != null && pendingTransferCount === 1;

  const runMutation = (work: () => Promise<void>) => {
    if (!gate.current.tryStart()) return;
    setBusy(true);
    void (async () => {
      try {
        await work();
        setConfirmKind(null);
        setTargetTransfer(null);
      } catch (error) {
        showAlert('정산을 바꾸지 못했어요', toSpaceSettlementError(error, confirmKind === 'cancel' ? 'write' : 'complete').userMessage);
      } finally {
        gate.current.end();
        setBusy(false);
      }
    })();
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SubScreenHeader title="정산 상세" fallbackHref={fallbackHref} />
      {detailStatus === 'loading' || loadStatus === 'loading' ? (
        <View style={styles.state}>
          <ActivityIndicator size="large" color={BRAND_GREEN} />
        </View>
      ) : blocked ? (
        <View style={styles.errorWrap}>
          <ErrorRetryCard
            title={errorCopy.title}
            desc={errorCopy.desc}
            onRetry={() => {
              if (resolvedErrorKind === 'unauthenticated') {
                router.replace(Platform.OS === 'web' ? '/home' : '/(auth)/login');
                return;
              }
              retry();
              if (spaceId && settlementId) {
                setLoadStatus('loading');
                setLoadErrorKind(null);
                void (async () => {
                  try {
                    const next = await getSpaceSettlement(spaceId, settlementId);
                    setSettlement(next);
                    try {
                      setExpense(await getSpaceSharedExpense(spaceId, next.sharedExpenseId));
                    } catch {
                      setExpense(null);
                    }
                    setLoadStatus('ready');
                  } catch (error) {
                    logSpaceSettlementError('SpaceSettlementDetail.retry', error);
                    setLoadErrorKind(classifySpaceSettlementError(error));
                    setLoadStatus('error');
                  }
                })();
              }
            }}
          />
        </View>
      ) : settlement && spaceId ? (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 12) + 24 }]}>
          <Text style={[styles.kicker, { color: colors.textSec }]}>
            {settlementOverallLabel(settlement.status, settlement.transfers)}
          </Text>
          <Text style={[styles.title, { color: colors.text }]}>{settlement.titleSnapshot}</Text>
          <Text style={[styles.amount, { color: accent }]}>{formatSettlementAmount(settlement.amountSnapshot)}</Text>
          <Text style={[styles.meta, { color: colors.textSec }]}>
            {formatSpaceDayHeading(settlement.dateKeySnapshot)} · {settlement.splitMode === 'equal' ? '균등 분할' : '직접 입력'}
          </Text>

          {mismatch ? (
            <View style={[styles.warn, { borderColor: colors.logoutBorder }]}>
              <Text style={[styles.warnText, { color: colors.logoutText }]}>
                공동 소비의 금액·결제자·참여자가 정산 당시와 달라요. 이 정산은 만든 시점의 금액으로 유지돼요.
              </Text>
            </View>
          ) : null}
          {!expense ? (
            <Text style={[styles.hint, { color: colors.textMuted }]}>
              원본 공동 소비는 없지만, 정산 기록은 그대로 남아 있어요.
            </Text>
          ) : null}

          {paidBy ? (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: colors.textSec }]}>결제자 · 받을 사람</Text>
              <View style={styles.person}>
                <ProfileAvatar uri={paidBy.photoURL} name={paidBy.displayName} size={36} accent={accent} />
                <Text style={[styles.personName, { color: colors.text }]}>{paidBy.displayName}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textSec }]}>참여자별 부담액</Text>
            {settlement.shares.map((share) => {
              const member = resolveSettlementMember(share.uid, membersState.members);
              return (
                <View key={share.uid} style={styles.shareRow}>
                  <ProfileAvatar uri={member.photoURL} name={member.displayName} size={28} accent={accent} />
                  <Text style={[styles.personName, { color: colors.text, flex: 1 }]}>{member.displayName}</Text>
                  <Text style={[styles.shareAmount, { color: colors.text }]}>{formatSettlementAmount(share.amount)}</Text>
                </View>
              );
            })}
          </View>

          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: colors.textSec }]}>송금해야 할 사람</Text>
            {settlement.transfers.length === 0 ? (
              <Text style={[styles.hint, { color: colors.textSec }]}>송금할 금액이 없어요.</Text>
            ) : (
              settlement.transfers.map((transfer) => {
                const from = resolveSettlementMember(transfer.fromUid, membersState.members);
                const to = resolveSettlementMember(transfer.toUid, membersState.members);
                const canToggle = settlement.status === 'open' && canCompleteSettlementTransfer(transfer, uid);
                const completedLabel = transfer.completedAt
                  ? formatSpaceEventCreatedAt(transfer.completedAt)
                  : null;
                return (
                  <View
                    key={transfer.fromUid}
                    style={[styles.transfer, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  >
                    <Text style={[styles.personName, { color: colors.text }]}>
                      {from.displayName} → {to.displayName}
                    </Text>
                    <Text style={[styles.shareAmount, { color: accent }]}>{formatSettlementAmount(transfer.amount)}</Text>
                    <Text style={[styles.meta, { color: colors.textSec }]}>
                      {transfer.status === 'completed' ? `정산 완료${completedLabel ? ` · ${completedLabel}` : ''}` : '미정산'}
                    </Text>
                    {canToggle ? (
                      <Pressable
                        onPress={() => {
                          setTargetTransfer(transfer);
                          setConfirmKind(transfer.status === 'completed' ? 'uncomplete' : 'complete');
                        }}
                        style={[styles.smallBtn, { borderColor: colors.border }]}
                      >
                        <Text style={[styles.smallBtnText, { color: colors.text }]}>
                          {transfer.status === 'completed' ? '미정산으로' : '완료로 표시'}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                );
              })
            )}
          </View>

          {canEdit || canCancel ? (
            <View style={styles.actions}>
              {canEdit ? (
                <Pressable
                  onPress={() =>
                    router.push({
                      pathname: '/spaces/[spaceId]/settlement-form',
                      params: { spaceId, settlementId: settlement.id },
                    })
                  }
                  style={[styles.btn, { backgroundColor: spaceTypeButtonFill(accent, isDark) }]}
                >
                  <Text style={[styles.btnText, { color: spaceTypeButtonInk(accent, isDark) }]}>수정</Text>
                </Pressable>
              ) : null}
              {canCancel ? (
                <Pressable
                  onPress={() => setConfirmKind('cancel')}
                  style={[styles.btn, { borderColor: colors.logoutBorder, borderWidth: StyleSheet.hairlineWidth }]}
                >
                  <Text style={[styles.btnText, { color: colors.logoutText }]}>정산 취소</Text>
                </Pressable>
              ) : null}
            </View>
          ) : settlement.status === 'open' ? (
            <Text style={[styles.hint, { color: colors.textMuted }]}>정산을 만든 멤버만 수정하거나 취소할 수 있어요.</Text>
          ) : null}
        </ScrollView>
      ) : null}

      <ConfirmModal
        visible={confirmKind != null}
        title={
          confirmKind === 'cancel'
            ? CANCEL_SETTLEMENT_CONFIRM_TITLE
            : confirmKind === 'uncomplete'
              ? UNCOMPLETE_TRANSFER_CONFIRM_TITLE
              : isLastComplete
                ? COMPLETE_LAST_TRANSFER_CONFIRM_TITLE
                : COMPLETE_TRANSFER_CONFIRM_TITLE
        }
        message={
          confirmKind === 'cancel'
            ? CANCEL_SETTLEMENT_CONFIRM_MESSAGE
            : confirmKind === 'uncomplete'
              ? UNCOMPLETE_TRANSFER_CONFIRM_MESSAGE
              : isLastComplete
                ? COMPLETE_LAST_TRANSFER_CONFIRM_MESSAGE
                : COMPLETE_TRANSFER_CONFIRM_MESSAGE
        }
        confirmLabel={
          confirmKind === 'cancel'
            ? CANCEL_SETTLEMENT_CONFIRM_LABEL
            : confirmKind === 'uncomplete'
              ? UNCOMPLETE_TRANSFER_CONFIRM_LABEL
              : isLastComplete
                ? COMPLETE_LAST_TRANSFER_CONFIRM_LABEL
                : COMPLETE_TRANSFER_CONFIRM_LABEL
        }
        cancelLabel="닫기"
        destructive={confirmKind === 'cancel'}
        loading={busy}
        onCancel={() => {
          if (gate.current.busy) return;
          setConfirmKind(null);
          setTargetTransfer(null);
        }}
        onConfirm={() => {
          if (!spaceId || !settlement) return;
          if (confirmKind === 'cancel') {
            runMutation(async () => {
              await cancelSpaceSettlement(spaceId, settlement.id);
              if (router.canGoBack()) router.back();
              else router.replace(fallbackHref);
            });
            return;
          }
          if (!targetTransfer) return;
          runMutation(async () => {
            await setSpaceSettlementTransferStatus(
              spaceId,
              settlement.id,
              targetTransfer.fromUid,
              confirmKind === 'complete',
            );
            await reload();
          });
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
  kicker: { fontSize: 12, fontWeight: '800', marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  amount: { marginTop: 8, fontSize: 28, fontWeight: '800' },
  meta: { marginTop: 6, fontSize: 13, fontWeight: '700' },
  warn: {
    marginTop: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
  },
  warnText: { fontSize: 13, fontWeight: '700', lineHeight: 19 },
  hint: { marginTop: 12, fontSize: 13, fontWeight: '600', lineHeight: 19 },
  section: { marginTop: 22 },
  sectionLabel: { fontSize: 12, fontWeight: '800', marginBottom: 10 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  personName: { fontSize: 15, fontWeight: '800' },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  shareAmount: { fontSize: 15, fontWeight: '800' },
  transfer: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 12,
    marginBottom: 10,
  },
  smallBtn: {
    marginTop: 10,
    minHeight: 36,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallBtnText: { fontSize: 13, fontWeight: '800' },
  actions: { marginTop: 24, flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: 15, fontWeight: '800' },
});
