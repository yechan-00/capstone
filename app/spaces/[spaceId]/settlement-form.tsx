import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
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
import { formatAmountInput, parseAmount, unformat } from '@/lib/expenseForm';
import { formatSpaceDayHeading } from '@/lib/spaceEvent';
import {
  buildSettlementTransfers,
  canCreateSpaceSettlement,
  canEditOrCancelSpaceSettlement,
  formatSettlementAmount,
  isValidCustomShares,
  resolveSettlementMember,
  settlementHasCompletedTransfer,
  splitEqually,
  type SettlementShare,
  type SettlementSplitMode,
  type SpaceSettlement,
} from '@/lib/spaceSettlement';
import {
  CREATE_SETTLEMENT_CONFIRM_LABEL,
  CREATE_SETTLEMENT_CONFIRM_MESSAGE,
  CREATE_SETTLEMENT_CONFIRM_TITLE,
  classifySpaceSettlementError,
  createSettlementWriteGate,
  spaceSettlementErrorCardCopy,
  toSpaceSettlementError,
  type SpaceSettlementErrorKind,
} from '@/lib/spaceSettlementClient';
import {
  formatSharedExpenseAmount,
  type SpaceSharedExpense,
} from '@/lib/spaceSharedExpense';
import { SPACE_TYPE_BY_ID, spaceTypeButtonFill, spaceTypeButtonInk } from '@/lib/spaceTypes';
import { getSpaceSharedExpense } from '@/services/spaceSharedExpenseService';
import {
  createSpaceSettlement,
  getSpaceSettlement,
  getSpaceSettlementLock,
  updateSpaceSettlement,
} from '@/services/spaceSettlementService';
import { BRAND_GREEN, useTheme } from '@/theme/ThemeContext';
import { firstParam } from '@/utils/routerParams';

function sharesFromMode(
  mode: SettlementSplitMode,
  total: number,
  participantUids: string[],
  customAmounts: Record<string, string>,
): SettlementShare[] | null {
  if (mode === 'equal') return splitEqually(total, participantUids);
  const shares = participantUids.map((uid) => ({
    uid,
    amount: parseAmount(customAmounts[uid] ?? ''),
  }));
  return isValidCustomShares(total, participantUids, shares) ? shares : shares;
}

export default function SpaceSettlementFormScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    spaceId?: string | string[];
    expenseId?: string | string[];
    settlementId?: string | string[];
  }>();
  const spaceId = firstParam(params.spaceId);
  const expenseId = firstParam(params.expenseId);
  const settlementId = firstParam(params.settlementId);
  const isEdit = Boolean(settlementId);
  const fallbackHref = spaceId ? `/spaces/${spaceId}/settlements` : '/spaces';
  const { user, isRegistered, loading: authLoading } = useAuth();
  const uid = isRegistered && user?.uid ? user.uid : null;
  const { space, status: detailStatus, errorKind, retry } = useSpaceDetail(spaceId);
  const membersState = useSpaceMembers(spaceId);
  const accent = space?.type ? SPACE_TYPE_BY_ID[space.type].accent : colors.primary;

  const [loadStatus, setLoadStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadMessage, setLoadMessage] = useState<string | null>(null);
  const [loadErrorKind, setLoadErrorKind] = useState<SpaceSettlementErrorKind | null>(null);
  const [expense, setExpense] = useState<SpaceSharedExpense | null>(null);
  const [settlement, setSettlement] = useState<SpaceSettlement | null>(null);
  const [splitMode, setSplitMode] = useState<SettlementSplitMode>('equal');
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const gate = useRef(createSettlementWriteGate());

  useEffect(() => {
    if (!spaceId || authLoading) return;
    let cancelled = false;
    setLoadStatus('loading');
    setLoadErrorKind(null);
    setLoadMessage(null);
    void (async () => {
      try {
        if (isEdit && settlementId) {
          const next = await getSpaceSettlement(spaceId, settlementId);
          if (cancelled) return;
          if (!canEditOrCancelSpaceSettlement(next.createdByUid, uid)) {
            setLoadMessage('정산을 만든 멤버만 수정할 수 있어요.');
            setLoadStatus('error');
            return;
          }
          if (next.status !== 'open' || settlementHasCompletedTransfer(next.transfers)) {
            setLoadMessage('일부 완료되었거나 끝난 정산은 부담액을 바꿀 수 없어요.');
            setLoadStatus('error');
            return;
          }
          setSettlement(next);
          setSplitMode(next.splitMode);
          setCustomAmounts(
            Object.fromEntries(next.shares.map((row) => [row.uid, formatAmountInput(String(row.amount))])),
          );
          try {
            const linked = await getSpaceSharedExpense(spaceId, next.sharedExpenseId);
            if (!cancelled) setExpense(linked);
          } catch {
            if (!cancelled) setExpense(null);
          }
          setLoadStatus('ready');
          return;
        }
        if (!expenseId) {
          setLoadMessage('공동 소비를 확인할 수 없어요.');
          setLoadStatus('error');
          return;
        }
        const nextExpense = await getSpaceSharedExpense(spaceId, expenseId);
        if (cancelled) return;
        if (!canCreateSpaceSettlement(nextExpense.createdByUid, uid)) {
          setLoadMessage('공동 소비를 작성한 멤버만 정산을 시작할 수 있어요.');
          setLoadStatus('error');
          return;
        }
        const lock = await getSpaceSettlementLock(spaceId, expenseId);
        if (cancelled) return;
        if (lock) {
          router.replace({
            pathname: '/spaces/[spaceId]/settlement/[settlementId]',
            params: { spaceId, settlementId: lock.settlementId },
          });
          return;
        }
        const equal = splitEqually(nextExpense.amount, nextExpense.participantUids) ?? [];
        setExpense(nextExpense);
        setCustomAmounts(Object.fromEntries(equal.map((row) => [row.uid, formatAmountInput(String(row.amount))])));
        setLoadStatus('ready');
      } catch (error) {
        if (cancelled) return;
        setLoadErrorKind(classifySpaceSettlementError(error));
        setLoadMessage(toSpaceSettlementError(error, isEdit ? 'write' : 'create').userMessage);
        setLoadStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, expenseId, isEdit, router, settlementId, spaceId, uid]);

  const snapshot = useMemo(() => {
    if (settlement) {
      return {
        title: settlement.titleSnapshot,
        amount: settlement.amountSnapshot,
        dateKey: settlement.dateKeySnapshot,
        paidByUid: settlement.paidByUidSnapshot,
        participantUids: settlement.participantUidsSnapshot,
      };
    }
    if (expense) {
      return {
        title: expense.title,
        amount: expense.amount,
        dateKey: expense.dateKey,
        paidByUid: expense.paidByUid,
        participantUids: expense.participantUids,
      };
    }
    return null;
  }, [expense, settlement]);

  const shares = snapshot
    ? sharesFromMode(splitMode, snapshot.amount, snapshot.participantUids, customAmounts)
    : null;
  const customOk = snapshot
    ? isValidCustomShares(
        snapshot.amount,
        snapshot.participantUids,
        snapshot.participantUids.map((memberUid) => ({
          uid: memberUid,
          amount: parseAmount(customAmounts[memberUid] ?? ''),
        })),
      )
    : false;
  const previewShares = splitMode === 'equal' ? shares : customOk ? shares : null;
  const transfers = previewShares && snapshot
    ? buildSettlementTransfers(snapshot.paidByUid, previewShares)
    : null;
  const canSubmit = Boolean(snapshot && previewShares && transfers && uid && !submitting);

  const blocked = detailStatus === 'error' || loadStatus === 'error';
  const resolvedErrorKind = loadErrorKind ?? errorKind;
  const errorCopy = loadMessage && !loadErrorKind
    ? { title: loadMessage, desc: '내용을 확인한 뒤 다시 시도해 주세요.' }
    : spaceSettlementErrorCardCopy(resolvedErrorKind ?? null);

  const submit = () => {
    if (!spaceId || !snapshot || !previewShares || !canSubmit || !gate.current.tryStart()) return;
    setSubmitting(true);
    setSubmitError(null);
    void (async () => {
      try {
        if (isEdit && settlementId) {
          await updateSpaceSettlement(
            spaceId,
            settlementId,
            splitMode,
            splitMode === 'custom' ? previewShares : undefined,
          );
          if (router.canGoBack()) router.back();
          else {
            router.replace({
              pathname: '/spaces/[spaceId]/settlement/[settlementId]',
              params: { spaceId, settlementId },
            });
          }
        } else if (expenseId) {
          const createdId = await createSpaceSettlement(
            spaceId,
            expenseId,
            splitMode,
            splitMode === 'custom' ? previewShares : undefined,
          );
          router.replace({
            pathname: '/spaces/[spaceId]/settlement/[settlementId]',
            params: { spaceId, settlementId: createdId },
          });
        }
      } catch (error) {
        setSubmitError(toSpaceSettlementError(error, isEdit ? 'write' : 'create').userMessage);
      } finally {
        gate.current.end();
        setSubmitting(false);
        setConfirmOpen(false);
      }
    })();
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SubScreenHeader title={isEdit ? '정산 수정' : '정산하기'} fallbackHref={fallbackHref} />
      {loadStatus === 'loading' || detailStatus === 'loading' ? (
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
            }}
          />
        </View>
      ) : snapshot ? (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 12) + 24 }]}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={[styles.title, { color: colors.text }]}>{snapshot.title}</Text>
            <Text style={[styles.amount, { color: accent }]}>{formatSharedExpenseAmount(snapshot.amount)}</Text>
            <Text style={[styles.meta, { color: colors.textSec }]}>{formatSpaceDayHeading(snapshot.dateKey)}</Text>

            <Text style={[styles.label, { color: colors.text }]}>정산 참여자</Text>
            <View style={styles.people}>
              {snapshot.participantUids.map((memberUid) => {
                const member = resolveSettlementMember(memberUid, membersState.members);
                const isPayer = memberUid === snapshot.paidByUid;
                return (
                  <View key={memberUid} style={styles.person}>
                    <ProfileAvatar uri={member.photoURL} name={member.displayName} size={32} accent={accent} />
                    <Text style={[styles.personName, { color: colors.text }]}>
                      {member.displayName}
                      {isPayer ? ' · 결제자' : ''}
                    </Text>
                  </View>
                );
              })}
            </View>

            <Text style={[styles.label, { color: colors.text }]}>나누는 방법</Text>
            <View style={styles.chips}>
              {([
                ['equal', '균등 분할'],
                ['custom', '직접 입력'],
              ] as const).map(([mode, label]) => {
                const selected = splitMode === mode;
                return (
                  <Pressable
                    key={mode}
                    onPress={() => setSplitMode(mode)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: selected ? accent : colors.surface,
                        borderColor: selected ? accent : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: selected ? colors.onPrimary : colors.text }]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.label, { color: colors.text }]}>참여자별 부담액</Text>
            {snapshot.participantUids.map((memberUid) => {
              const member = resolveSettlementMember(memberUid, membersState.members);
              const equalAmount = splitEqually(snapshot.amount, snapshot.participantUids)?.find(
                (row) => row.uid === memberUid,
              )?.amount ?? 0;
              return (
                <View key={memberUid} style={[styles.shareRow, { borderColor: colors.border, backgroundColor: colors.surface }]}>
                  <ProfileAvatar uri={member.photoURL} name={member.displayName} size={28} accent={accent} />
                  <Text style={[styles.shareName, { color: colors.text }]} numberOfLines={1}>
                    {member.displayName}
                  </Text>
                  {splitMode === 'equal' ? (
                    <Text style={[styles.shareAmount, { color: accent }]}>{formatSettlementAmount(equalAmount)}</Text>
                  ) : (
                    <TextInput
                      value={customAmounts[memberUid] ?? ''}
                      onChangeText={(next) =>
                        setCustomAmounts((prev) => ({ ...prev, [memberUid]: formatAmountInput(unformat(next)) }))
                      }
                      keyboardType="number-pad"
                      placeholder="0"
                      placeholderTextColor={colors.placeholder}
                      style={[styles.shareInput, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.border }]}
                    />
                  )}
                </View>
              );
            })}
            {splitMode === 'custom' && !customOk ? (
              <Text style={[styles.error, { color: colors.logoutText }]}>
                부담액 합계가 {formatSettlementAmount(snapshot.amount)}과 같아야 해요. 0원도 가능해요.
              </Text>
            ) : null}

            <Text style={[styles.label, { color: colors.text }]}>정산 미리보기</Text>
            {transfers && transfers.length === 0 ? (
              <Text style={[styles.hint, { color: colors.textSec }]}>송금할 금액이 없어요. 결제자 부담만 있거나 모두 0원이에요.</Text>
            ) : (
              (transfers ?? []).map((row) => {
                const from = resolveSettlementMember(row.fromUid, membersState.members);
                const to = resolveSettlementMember(row.toUid, membersState.members);
                return (
                  <Text key={row.fromUid} style={[styles.preview, { color: colors.text }]}>
                    {from.displayName} → {to.displayName} {formatSettlementAmount(row.amount)}
                  </Text>
                );
              })
            )}

            {submitError ? <Text style={[styles.error, { color: colors.logoutText }]}>{submitError}</Text> : null}

            <Pressable
              onPress={() => {
                if (!canSubmit) return;
                setConfirmOpen(true);
              }}
              disabled={!canSubmit}
              style={({ pressed }) => [
                styles.submit,
                { backgroundColor: spaceTypeButtonFill(accent, isDark), opacity: !canSubmit || pressed ? 0.72 : 1 },
              ]}
            >
              <Text style={[styles.submitText, { color: spaceTypeButtonInk(accent, isDark) }]}>
                {isEdit ? '정산 수정' : '정산 결과 확인'}
              </Text>
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : null}

      <ConfirmModal
        visible={confirmOpen}
        title={CREATE_SETTLEMENT_CONFIRM_TITLE}
        message={CREATE_SETTLEMENT_CONFIRM_MESSAGE}
        confirmLabel={isEdit ? '저장' : CREATE_SETTLEMENT_CONFIRM_LABEL}
        cancelLabel="돌아가기"
        loading={submitting}
        onCancel={() => {
          if (gate.current.busy) return;
          setConfirmOpen(false);
        }}
        onConfirm={submit}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorWrap: { paddingHorizontal: 20, paddingTop: 24 },
  content: { paddingHorizontal: 20, paddingTop: 20 },
  title: { fontSize: 22, fontWeight: '800', letterSpacing: -0.4 },
  amount: { marginTop: 8, fontSize: 28, fontWeight: '800' },
  meta: { marginTop: 6, fontSize: 13, fontWeight: '700' },
  label: { marginTop: 22, marginBottom: 10, fontSize: 12, fontWeight: '800' },
  people: { gap: 10 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  personName: { fontSize: 15, fontWeight: '800' },
  chips: { flexDirection: 'row', gap: 8 },
  chip: {
    minHeight: 36,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  chipText: { fontSize: 13, fontWeight: '700' },
  shareRow: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  shareName: { flex: 1, fontSize: 14, fontWeight: '700' },
  shareAmount: { fontSize: 14, fontWeight: '800' },
  shareInput: {
    width: 110,
    minHeight: 40,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    textAlign: 'right',
    fontSize: 15,
    fontWeight: '700',
  },
  preview: { marginBottom: 6, fontSize: 15, fontWeight: '700' },
  hint: { fontSize: 13, fontWeight: '600', lineHeight: 19 },
  error: { marginTop: 12, fontSize: 13, fontWeight: '700' },
  submit: {
    marginTop: 24,
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: { fontSize: 16, fontWeight: '800' },
});
