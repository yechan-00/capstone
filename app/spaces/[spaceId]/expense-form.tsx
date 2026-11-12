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
import { ErrorRetryCard } from '@/components/ErrorRetryCard';
import { SubScreenHeader } from '@/components/SubScreenHeader';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { SpaceEventPickerSheet } from '@/components/spaces/SpaceEventPickerSheet';
import { useAuth } from '@/hooks/useAuth';
import { useSpaceDetail } from '@/hooks/useSpaceDetail';
import { useSpaceMembers } from '@/hooks/useSpaceMembers';
import { CATEGORIES } from '@/lib/expenseOptions';
import { formatAmountInput, parseAmount, unformat } from '@/lib/expenseForm';
import {
  dateKeyFromLocalDate,
  formatSpaceDayHeading,
  localDateFromDateKey,
} from '@/lib/spaceEvent';
import {
  SHARED_EXPENSE_MEMO_MAX,
  SHARED_EXPENSE_TITLE_MAX,
  defaultSharedExpensePaidBy,
  defaultSharedExpenseParticipants,
  isAllowedSharedExpenseMembershipCreate,
  isAllowedSharedExpenseMembershipUpdate,
  isValidSharedExpenseDateKey,
  isValidSpaceSharedExpenseDraft,
  resolveSpaceSharedExpenseMember,
  type SharedExpenseCategory,
} from '@/lib/spaceSharedExpense';
import {
  OPEN_SETTLEMENT_DENIED,
  canMutateSpaceSharedExpense,
  createSharedExpenseWriteGate,
  toSpaceSharedExpenseError,
} from '@/lib/spaceSharedExpenseClient';
import type { SpaceSettlementLock } from '@/lib/spaceSettlement';
import type { SpaceMember } from '@/lib/spaceMembersClient';
import { SPACE_TYPE_BY_ID } from '@/lib/spaceTypes';
import {
  createSpaceSharedExpense,
  getSpaceSharedExpense,
  updateSpaceSharedExpense,
} from '@/services/spaceSharedExpenseService';
import { getSpaceSettlementLock } from '@/services/spaceSettlementService';
import { BRAND_GREEN, useTheme } from '@/theme/ThemeContext';
import { firstParam } from '@/utils/routerParams';

function toggleUid(uids: string[], uid: string): string[] {
  return uids.includes(uid) ? uids.filter((item) => item !== uid) : [...uids, uid];
}

export default function SpaceSharedExpenseFormScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    spaceId?: string | string[];
    expenseId?: string | string[];
    dateKey?: string | string[];
  }>();
  const spaceId = firstParam(params.spaceId);
  const expenseId = firstParam(params.expenseId);
  const isEdit = Boolean(expenseId);
  const { user, isRegistered, loading: authLoading } = useAuth();
  const uid = isRegistered && user?.uid ? user.uid : null;
  const fallbackHref = spaceId ? `/spaces/${spaceId}/expenses` : '/spaces';
  const { space, status: detailStatus, errorKind, errorMessage, retry } = useSpaceDetail(spaceId);
  const membersState = useSpaceMembers(spaceId);
  const accent = space?.type ? SPACE_TYPE_BY_ID[space.type].accent : colors.primary;
  const initialDateKey = firstParam(params.dateKey);
  const currentMemberUids = membersState.members.map((member) => member.uid);

  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    isEdit ? 'loading' : 'ready',
  );
  const [loadMessage, setLoadMessage] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [amountText, setAmountText] = useState('');
  const [dateKey, setDateKey] = useState(
    initialDateKey && isValidSharedExpenseDateKey(initialDateKey)
      ? initialDateKey
      : dateKeyFromLocalDate(new Date()),
  );
  const [category, setCategory] = useState<SharedExpenseCategory>('takeout');
  const [paidByUid, setPaidByUid] = useState(uid ?? '');
  const [participantUids, setParticipantUids] = useState<string[]>(uid ? [uid] : []);
  const [originalPaidByUid, setOriginalPaidByUid] = useState('');
  const [originalParticipantUids, setOriginalParticipantUids] = useState<string[]>([]);
  const [memo, setMemo] = useState('');
  const [defaultsReady, setDefaultsReady] = useState(isEdit);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [settlementLock, setSettlementLock] = useState<SpaceSettlementLock | null>(null);
  const gate = useRef(createSharedExpenseWriteGate());

  useEffect(() => {
    if (isEdit || defaultsReady || membersState.status !== 'ready' || !uid) return;
    const nextParticipants = defaultSharedExpenseParticipants(currentMemberUids, uid);
    setParticipantUids(nextParticipants);
    setPaidByUid(defaultSharedExpensePaidBy(nextParticipants, uid));
    setDefaultsReady(true);
  }, [currentMemberUids, defaultsReady, isEdit, membersState.status, uid]);

  useEffect(() => {
    if (!isEdit || !spaceId || !expenseId || authLoading) return;
    let cancelled = false;
    setLoadStatus('loading');
    void (async () => {
      try {
        const expense = await getSpaceSharedExpense(spaceId, expenseId);
        if (cancelled) return;
        if (!canMutateSpaceSharedExpense(expense.createdByUid, uid)) {
          setLoadMessage('작성한 멤버만 공동 소비를 수정할 수 있어요.');
          setLoadStatus('error');
          return;
        }
        setTitle(expense.title);
        setAmountText(formatAmountInput(String(expense.amount)));
        setDateKey(expense.dateKey);
        setCategory(expense.category);
        setPaidByUid(expense.paidByUid);
        setParticipantUids(expense.participantUids);
        setOriginalPaidByUid(expense.paidByUid);
        setOriginalParticipantUids(expense.participantUids);
        setMemo(expense.memo);
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
  }, [authLoading, expenseId, isEdit, spaceId, uid]);

  const currentUidSet = useMemo(() => new Set(currentMemberUids), [currentMemberUids]);
  const departedUids = participantUids.filter((memberUid) => !currentUidSet.has(memberUid));
  const amount = parseAmount(amountText);
  const draft = {
    title,
    amount,
    dateKey,
    category,
    paidByUid,
    participantUids,
    memo,
  };
  const membershipOk = isEdit
    ? isAllowedSharedExpenseMembershipUpdate(
        { paidByUid: originalPaidByUid, participantUids: originalParticipantUids },
        { paidByUid, participantUids },
        currentMemberUids,
      )
    : isAllowedSharedExpenseMembershipCreate(paidByUid, participantUids, currentMemberUids);
  const settlementLocked = settlementLock?.status === 'open';
  const canSubmit = isValidSpaceSharedExpenseDraft(draft)
    && membershipOk
    && !submitting
    && Boolean(uid);

  const onSubmit = () => {
    if (!spaceId || !canSubmit || !gate.current.tryStart()) return;
    setSubmitting(true);
    setSubmitError(null);
    void (async () => {
      try {
        if (isEdit && expenseId) {
          await updateSpaceSharedExpense(spaceId, expenseId, draft);
        } else {
          await createSpaceSharedExpense(spaceId, draft);
        }
        if (router.canGoBack()) router.back();
        else router.replace(fallbackHref);
      } catch (error) {
        setSubmitError(toSpaceSharedExpenseError(error, 'write').userMessage);
      } finally {
        gate.current.end();
        setSubmitting(false);
      }
    })();
  };

  const blocked = detailStatus === 'error' || loadStatus === 'error';
  const showSpinner =
    (detailStatus === 'loading' || loadStatus === 'loading' || (membersState.status === 'loading' && !isEdit))
    && !blocked;

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SubScreenHeader title={isEdit ? '공동 소비 수정' : '공동 소비 추가'} fallbackHref={fallbackHref} />
      {showSpinner ? (
        <View style={styles.state}>
          <ActivityIndicator size="large" color={BRAND_GREEN} />
        </View>
      ) : blocked ? (
        <View style={styles.errorWrap}>
          <ErrorRetryCard
            title={loadMessage ?? errorMessage ?? '공동 소비를 불러오지 못했어요.'}
            desc={
              errorKind === 'permission-denied'
                ? '이 공간의 멤버만 공동 소비를 기록할 수 있어요.'
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
      ) : (
        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView
            contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 12) + 24 }]}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={[styles.label, { color: colors.text }]}>제목</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              editable={!submitting}
              placeholder="예: 저녁 회식"
              placeholderTextColor={colors.placeholder}
              maxLength={SHARED_EXPENSE_TITLE_MAX}
              style={[styles.input, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.border }]}
            />

            <Text style={[styles.label, { color: colors.text }]}>금액</Text>
            <TextInput
              value={amountText}
              onChangeText={(next) => setAmountText(formatAmountInput(unformat(next)))}
              editable={!submitting && !settlementLocked}
              keyboardType="number-pad"
              placeholder="0"
              placeholderTextColor={colors.placeholder}
              style={[styles.input, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.border }]}
            />
            {settlementLocked ? (
              <Text style={[styles.hint, { color: colors.textMuted }]}>{OPEN_SETTLEMENT_DENIED}</Text>
            ) : null}

            <Text style={[styles.label, { color: colors.text }]}>날짜</Text>
            <Pressable
              onPress={() => {
                if (submitting) return;
                setTempDate(localDateFromDateKey(dateKey) ?? new Date());
                setPickerOpen(true);
              }}
              style={[styles.row, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
            >
              <Text style={[styles.rowText, { color: colors.text }]}>{formatSpaceDayHeading(dateKey)}</Text>
            </Pressable>

            <Text style={[styles.label, { color: colors.text }]}>카테고리</Text>
            <View style={styles.chips}>
              {CATEGORIES.map((item) => {
                const selected = category === item.key;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => setCategory(item.key)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: selected ? accent : colors.surface,
                        borderColor: selected ? accent : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.chipText, { color: selected ? colors.onPrimary : colors.text }]}>
                      {item.emoji} {item.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={[styles.label, { color: colors.text }]}>결제자</Text>
            {paidByUid && !currentUidSet.has(paidByUid) ? (
              <View
                style={[
                  styles.memberRow,
                  { backgroundColor: colors.surface, borderColor: accent, marginBottom: 8 },
                ]}
              >
                <ProfileAvatar
                  name={resolveSpaceSharedExpenseMember(paidByUid, membersState.members).displayName}
                  size={32}
                  accent={accent}
                />
                <Text style={[styles.memberName, { color: colors.text }]} numberOfLines={1}>
                  {resolveSpaceSharedExpenseMember(paidByUid, membersState.members).displayName} · 공간에 없음
                </Text>
              </View>
            ) : null}
            <MemberPicker
              members={membersState.members}
              selectedUids={[paidByUid]}
              accent={accent}
              mode="single"
              disabled={settlementLocked}
              onSelect={(memberUid) => {
                if (settlementLocked) return;
                setPaidByUid(memberUid);
                setParticipantUids((prev) => (prev.includes(memberUid) ? prev : [...prev, memberUid]));
              }}
            />

            <Text style={[styles.label, { color: colors.text }]}>참여 멤버</Text>
            <MemberPicker
              members={membersState.members}
              selectedUids={participantUids}
              accent={accent}
              mode="multiple"
              disabled={settlementLocked}
              onSelect={(memberUid) => {
                if (settlementLocked) return;
                if (memberUid === paidByUid && participantUids.includes(memberUid)) return;
                setParticipantUids((prev) => toggleUid(prev, memberUid));
              }}
            />
            {departedUids.length > 0 ? (
              <View style={styles.departed}>
                {departedUids.map((memberUid) => {
                  const member = resolveSpaceSharedExpenseMember(memberUid, membersState.members);
                  return (
                    <Pressable
                      key={memberUid}
                      onPress={() => {
                        if (settlementLocked) return;
                        setParticipantUids((prev) => prev.filter((item) => item !== memberUid));
                      }}
                      style={[styles.departedChip, { borderColor: colors.border }]}
                    >
                      <Text style={[styles.departedText, { color: colors.textSec }]}>
                        {member.displayName} · 공간에 없음
                      </Text>
                    </Pressable>
                  );
                })}
                <Text style={[styles.hint, { color: colors.textMuted }]}>
                  공간을 나간 멤버는 그대로 둘 수 있어요. 새로 고를 때는 현재 멤버만 가능해요.
                </Text>
              </View>
            ) : null}

            <Text style={[styles.label, { color: colors.text }]}>메모</Text>
            <TextInput
              value={memo}
              onChangeText={setMemo}
              editable={!submitting}
              placeholder="선택 사항"
              placeholderTextColor={colors.placeholder}
              maxLength={SHARED_EXPENSE_MEMO_MAX}
              multiline
              style={[
                styles.input,
                styles.textarea,
                { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.border },
              ]}
            />

            <Text style={[styles.hint, { color: colors.textMuted }]}>
              공동 소비는 이 공간에만 저장돼요. 개인 가계부에는 자동으로 추가되지 않아요.
            </Text>

            {submitError ? <Text style={[styles.error, { color: colors.logoutText }]}>{submitError}</Text> : null}

            <Pressable
              onPress={onSubmit}
              disabled={!canSubmit}
              style={({ pressed }) => [
                styles.submit,
                { backgroundColor: accent, opacity: !canSubmit || pressed ? 0.72 : 1 },
              ]}
            >
              {submitting ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={[styles.submitText, { color: colors.onPrimary }]}>{isEdit ? '저장' : '추가'}</Text>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      )}

      <SpaceEventPickerSheet
        visible={pickerOpen}
        phase="date"
        value={tempDate}
        accent={accent}
        onChange={setTempDate}
        onCancel={() => setPickerOpen(false)}
        onConfirm={() => {
          setDateKey(dateKeyFromLocalDate(tempDate));
          setPickerOpen(false);
        }}
      />
    </View>
  );
}

function MemberPicker({
  members,
  selectedUids,
  accent,
  mode,
  disabled,
  onSelect,
}: {
  members: SpaceMember[];
  selectedUids: string[];
  accent: string;
  mode: 'single' | 'multiple';
  disabled?: boolean;
  onSelect: (uid: string) => void;
}) {
  const { colors } = useTheme();
  if (members.length === 0) {
    return <Text style={[styles.hint, { color: colors.textMuted }]}>멤버를 불러오는 중이에요.</Text>;
  }
  return (
    <View style={styles.memberList}>
      {members.map((member) => {
        const selected = selectedUids.includes(member.uid);
        return (
          <Pressable
            key={member.uid}
            onPress={() => {
              if (disabled) return;
              onSelect(member.uid);
            }}
            style={[
              styles.memberRow,
              {
                backgroundColor: colors.surface,
                borderColor: selected ? accent : colors.border,
              },
            ]}
            accessibilityRole={mode === 'single' ? 'radio' : 'checkbox'}
            accessibilityState={{ selected }}
          >
            <ProfileAvatar uri={member.photoURL} name={member.displayName} size={32} accent={accent} />
            <Text style={[styles.memberName, { color: colors.text }]} numberOfLines={1}>
              {member.displayName}
            </Text>
            <View
              style={[
                mode === 'single' ? styles.radio : styles.check,
                { borderColor: selected ? accent : colors.border, backgroundColor: selected ? accent : 'transparent' },
              ]}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 20 },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorWrap: { paddingHorizontal: 20, paddingTop: 24 },
  label: { marginTop: 16, marginBottom: 8, fontSize: 13, fontWeight: '800' },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: '600',
  },
  textarea: { minHeight: 100, paddingTop: 12, textAlignVertical: 'top' },
  row: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  rowText: { fontSize: 16, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    minHeight: 36,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    justifyContent: 'center',
  },
  chipText: { fontSize: 13, fontWeight: '700' },
  memberList: { gap: 8 },
  memberRow: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  memberName: { flex: 1, fontSize: 15, fontWeight: '700' },
  radio: { width: 16, height: 16, borderRadius: 8, borderWidth: 2 },
  check: { width: 16, height: 16, borderRadius: 4, borderWidth: 2 },
  departed: { marginTop: 8, gap: 8 },
  departedChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  departedText: { fontSize: 12, fontWeight: '700' },
  hint: { marginTop: 12, fontSize: 12, fontWeight: '600', lineHeight: 18 },
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
