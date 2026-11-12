import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useAuth } from '@/hooks/useAuth';
import { useMySpaces } from '@/hooks/useMySpaces';
import { expenseCategoryLabel } from '@/lib/expenseCategoryLabel';
import { dateKeyFromLocalDate } from '@/lib/spaceEvent';
import {
  defaultSharedExpensePaidBy,
  defaultSharedExpenseParticipants,
  formatSharedExpenseAmount,
  pickPersonalExpenseShareFields,
} from '@/lib/spaceSharedExpense';
import {
  SHARE_TO_SPACE_CONFIRM_LABEL,
  SHARE_TO_SPACE_CONFIRM_MESSAGE,
  SHARE_TO_SPACE_CONFIRM_TITLE,
  createSharedExpenseWriteGate,
  toSpaceSharedExpenseError,
} from '@/lib/spaceSharedExpenseClient';
import type { SpaceListItem } from '@/lib/spaceTypes';
import type { Expense } from '@/lib/types';
import { listSpaceMembers } from '@/services/spaceMembersService';
import { createSpaceSharedExpense } from '@/services/spaceSharedExpenseService';
import { useExpenseDetailPalette } from '@/theme/expenseDetailTheme';
import { BRAND_GREEN } from '@/theme/ThemeContext';

type Props = {
  visible: boolean;
  expense: Expense;
  onClose: () => void;
};

export function ShareToSpaceSheet({ visible, expense, onClose }: Props) {
  const p = useExpenseDetailPalette();
  const router = useRouter();
  const { user } = useAuth();
  const uid = user?.uid ?? '';
  const spacesState = useMySpaces();
  const [spaceId, setSpaceId] = useState<string | null>(null);
  const [includeTitle, setIncludeTitle] = useState(true);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const gate = useRef(createSharedExpenseWriteGate());

  const dateKey = dateKeyFromLocalDate(expense.spentAt instanceof Date ? expense.spentAt : new Date(expense.spentAt));
  const picked = pickPersonalExpenseShareFields(expense, dateKey, includeTitle);
  const selectedSpace = spacesState.spaces.find((space) => space.id === spaceId) ?? null;

  useEffect(() => {
    if (!visible) {
      setSpaceId(null);
      setIncludeTitle(true);
      setConfirmOpen(false);
      setBusy(false);
      setError(null);
    }
  }, [visible]);

  const preview = useMemo(
    () => ({
      title: picked?.title ?? '',
      amount: picked ? formatSharedExpenseAmount(picked.amount) : '',
      dateKey: picked?.dateKey ?? '',
      category: picked ? expenseCategoryLabel(picked.category) : '',
    }),
    [picked],
  );

  const onShare = () => {
    if (!picked || !spaceId || !gate.current.tryStart()) return;
    setBusy(true);
    setError(null);
    void (async () => {
      try {
        const members = await listSpaceMembers(spaceId);
        const memberUids = members.map((member) => member.uid);
        const participantUids = defaultSharedExpenseParticipants(memberUids, uid);
        const paidByUid = defaultSharedExpensePaidBy(participantUids, uid);
        const sharedExpenseId = await createSpaceSharedExpense(
          spaceId,
          {
            title: picked.title,
            amount: picked.amount,
            dateKey: picked.dateKey,
            category: picked.category,
            paidByUid,
            participantUids,
            memo: '',
          },
          expense.id,
        );
        setConfirmOpen(false);
        onClose();
        router.push({
          pathname: '/spaces/[spaceId]/expense/[expenseId]',
          params: { spaceId, expenseId: sharedExpenseId },
        });
      } catch (shareError) {
        setError(toSpaceSharedExpenseError(shareError, 'share').userMessage);
      } finally {
        gate.current.end();
        setBusy(false);
      }
    })();
  };

  return (
    <>
      <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
        <View style={[styles.root, { backgroundColor: p.bg }]}>
          <View style={[styles.header, { borderBottomColor: p.border }]}>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={[styles.close, { color: p.textSec }]}>닫기</Text>
            </Pressable>
            <Text style={[styles.headerTitle, { color: p.text }]}>공유 공간에 공유</Text>
            <View style={styles.headerSpacer} />
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            <Text style={[styles.lead, { color: p.textSec }]}>
              제목·금액·날짜·카테고리만 복사할 수 있어요. 메모·후회 평가·사진은 공유되지 않아요.
            </Text>

            <Text style={[styles.label, { color: p.textMuted }]}>공유할 공간</Text>
            {spacesState.status === 'loading' ? (
              <ActivityIndicator color={BRAND_GREEN} />
            ) : spacesState.spaces.length === 0 ? (
              <Text style={[styles.empty, { color: p.textSec }]}>아직 공유 공간이 없어요.</Text>
            ) : (
              <View style={styles.spaceList}>
                {spacesState.spaces.map((space) => (
                  <SpaceChoice
                    key={space.id}
                    space={space}
                    selected={space.id === spaceId}
                    onPress={() => setSpaceId(space.id)}
                  />
                ))}
              </View>
            )}

            <Text style={[styles.label, { color: p.textMuted }]}>공유할 정보</Text>
            <Pressable
              onPress={() => setIncludeTitle((prev) => !prev)}
              style={[styles.fieldRow, { borderColor: p.border, backgroundColor: p.surface }]}
            >
              <View style={[styles.check, { borderColor: includeTitle ? p.primary : p.border, backgroundColor: includeTitle ? p.primary : 'transparent' }]} />
              <Text style={[styles.fieldText, { color: p.text }]}>제목 · {preview.title || '카테고리 이름으로 대체'}</Text>
            </Pressable>
            <View style={[styles.fieldRow, { borderColor: p.border, backgroundColor: p.surface }]}>
              <View style={[styles.check, { borderColor: p.primary, backgroundColor: p.primary }]} />
              <Text style={[styles.fieldText, { color: p.text }]}>금액 · {preview.amount}</Text>
            </View>
            <View style={[styles.fieldRow, { borderColor: p.border, backgroundColor: p.surface }]}>
              <View style={[styles.check, { borderColor: p.primary, backgroundColor: p.primary }]} />
              <Text style={[styles.fieldText, { color: p.text }]}>날짜 · {preview.dateKey}</Text>
            </View>
            <View style={[styles.fieldRow, { borderColor: p.border, backgroundColor: p.surface }]}>
              <View style={[styles.check, { borderColor: p.primary, backgroundColor: p.primary }]} />
              <Text style={[styles.fieldText, { color: p.text }]}>카테고리 · {preview.category}</Text>
            </View>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              onPress={() => setConfirmOpen(true)}
              disabled={!picked || !selectedSpace || busy}
              style={({ pressed }) => [
                styles.submit,
                { backgroundColor: p.primary, opacity: !picked || !selectedSpace || busy || pressed ? 0.72 : 1 },
              ]}
            >
              <Text style={styles.submitText}>공유하기</Text>
            </Pressable>
          </ScrollView>
        </View>
      </Modal>
      <ConfirmModal
        visible={confirmOpen}
        title={SHARE_TO_SPACE_CONFIRM_TITLE}
        message={SHARE_TO_SPACE_CONFIRM_MESSAGE}
        confirmLabel={SHARE_TO_SPACE_CONFIRM_LABEL}
        cancelLabel="취소"
        loading={busy}
        onCancel={() => {
          if (gate.current.busy) return;
          setConfirmOpen(false);
        }}
        onConfirm={onShare}
      />
    </>
  );
}

function SpaceChoice({
  space,
  selected,
  onPress,
}: {
  space: SpaceListItem;
  selected: boolean;
  onPress: () => void;
}) {
  const p = useExpenseDetailPalette();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.spaceRow,
        { borderColor: selected ? p.primary : p.border, backgroundColor: p.surface },
      ]}
    >
      <Text style={[styles.spaceName, { color: p.text }]}>{space.name}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    minHeight: 52,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 16, fontWeight: '800' },
  close: { fontSize: 14, fontWeight: '700', width: 48 },
  headerSpacer: { width: 48 },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 32 },
  lead: { fontSize: 13, fontWeight: '600', lineHeight: 19, marginBottom: 18 },
  label: { marginTop: 16, marginBottom: 8, fontSize: 12, fontWeight: '800' },
  empty: { fontSize: 14, fontWeight: '600' },
  spaceList: { gap: 8 },
  spaceRow: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  spaceName: { fontSize: 15, fontWeight: '800' },
  fieldRow: {
    minHeight: 44,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  check: { width: 16, height: 16, borderRadius: 4, borderWidth: 2 },
  fieldText: { flex: 1, fontSize: 14, fontWeight: '700' },
  error: { marginTop: 12, fontSize: 13, fontWeight: '700', color: '#B42318' },
  submit: {
    marginTop: 24,
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: { fontSize: 16, fontWeight: '800', color: '#FFFFFF' },
});
