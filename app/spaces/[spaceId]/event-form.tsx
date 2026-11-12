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
import { SpaceEventPickerSheet } from '@/components/spaces/SpaceEventPickerSheet';
import { useAuth } from '@/hooks/useAuth';
import { useSpaceDetail } from '@/hooks/useSpaceDetail';
import {
  SPACE_EVENT_DESCRIPTION_MAX,
  SPACE_EVENT_TITLE_MAX,
  dateFromDateKeyAndTime,
  dateKeyFromLocalDate,
  formatSpaceDayHeading,
  isValidDateKey,
  isValidSpaceEventDraft,
  isValidSpaceEventTitle,
  localDateFromDateKey,
  timeHmFromDate,
  type SpaceEventDraft,
} from '@/lib/spaceEvent';
import {
  canMutateSpaceEvent,
  createEventWriteGate,
  toSpaceEventError,
} from '@/lib/spaceEventClient';
import { SPACE_TYPE_BY_ID } from '@/lib/spaceTypes';
import { createSpaceEvent, getSpaceEvent, updateSpaceEvent } from '@/services/spaceEventService';
import { BRAND_GREEN, useTheme } from '@/theme/ThemeContext';
import { firstParam } from '@/utils/routerParams';

type PickerKind = 'date' | 'start' | 'end' | null;

export default function SpaceEventFormScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    spaceId?: string | string[];
    dateKey?: string | string[];
    eventId?: string | string[];
  }>();
  const spaceId = firstParam(params.spaceId);
  const eventId = firstParam(params.eventId);
  const initialDateKey = firstParam(params.dateKey);
  const isEdit = Boolean(eventId);
  const { user, isRegistered, loading: authLoading } = useAuth();
  const uid = isRegistered && user?.uid ? user.uid : null;
  const fallbackHref = spaceId ? `/spaces/${spaceId}/calendar` : '/spaces';
  const { space, status: detailStatus, errorKind: detailKind, errorMessage: detailError, retry } =
    useSpaceDetail(spaceId);
  const accent = space?.type ? SPACE_TYPE_BY_ID[space.type].accent : colors.primary;

  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    isEdit ? 'loading' : 'ready',
  );
  const [loadMessage, setLoadMessage] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [dateKey, setDateKey] = useState(
    initialDateKey && isValidDateKey(initialDateKey)
      ? initialDateKey
      : dateKeyFromLocalDate(new Date()),
  );
  const [allDay, setAllDay] = useState(true);
  const [startTime, setStartTime] = useState<string | null>(null);
  const [endTime, setEndTime] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [picker, setPicker] = useState<PickerKind>(null);
  const [tempDate, setTempDate] = useState(new Date());
  const gate = useRef(createEventWriteGate());

  useEffect(() => {
    if (!isEdit || !spaceId || !eventId || authLoading) return;
    let cancelled = false;
    setLoadStatus('loading');
    void (async () => {
      try {
        const event = await getSpaceEvent(spaceId, eventId);
        if (cancelled) return;
        if (!canMutateSpaceEvent(event.createdByUid, uid)) {
          setLoadMessage('작성한 멤버만 일정을 수정할 수 있어요.');
          setLoadStatus('error');
          return;
        }
        setTitle(event.title);
        setDateKey(event.dateKey);
        setAllDay(event.allDay);
        setStartTime(event.startTime);
        setEndTime(event.endTime);
        setDescription(event.description);
        setLoadStatus('ready');
      } catch (error) {
        if (cancelled) return;
        setLoadMessage(toSpaceEventError(error, 'read').userMessage);
        setLoadStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authLoading, eventId, isEdit, spaceId, uid]);

  const draft: SpaceEventDraft = {
    title,
    dateKey,
    allDay,
    startTime: allDay ? null : startTime,
    endTime: allDay ? null : endTime,
    description,
  };
  const canSubmit =
    isValidSpaceEventDraft(draft) &&
    !submitting &&
    loadStatus === 'ready' &&
    detailStatus === 'ready';

  const disabledHint = useMemo(() => {
    if (submitting) return '잠시만 기다려 주세요.';
    if (!isValidSpaceEventTitle(title)) return '제목을 입력해 주세요.';
    if (!allDay && !startTime) return '시작 시간을 선택해 주세요.';
    if (!allDay && endTime && startTime && endTime < startTime) return '종료 시간은 시작 시간 이후여야 해요.';
    return null;
  }, [allDay, endTime, startTime, submitting, title]);

  const openPicker = (kind: PickerKind) => {
    if (submitting) return;
    if (kind === 'date') {
      setTempDate(localDateFromDateKey(dateKey) ?? new Date());
    } else if (kind === 'start') {
      setTempDate(dateFromDateKeyAndTime(dateKey, startTime ?? '09:00') ?? new Date());
    } else if (kind === 'end') {
      setTempDate(dateFromDateKeyAndTime(dateKey, endTime ?? startTime ?? '10:00') ?? new Date());
    }
    setPicker(kind);
  };

  const confirmPicker = () => {
    if (picker === 'date') {
      setDateKey(dateKeyFromLocalDate(tempDate));
    } else if (picker === 'start') {
      const next = timeHmFromDate(tempDate);
      setStartTime(next);
      setAllDay(false);
      if (endTime && endTime < next) setEndTime(null);
    } else if (picker === 'end') {
      setEndTime(timeHmFromDate(tempDate));
      setAllDay(false);
    }
    setPicker(null);
  };

  const onSubmit = () => {
    if (!spaceId || !canSubmit) return;
    if (!gate.current.tryStart()) return;
    setSubmitting(true);
    setSubmitError(null);
    void (async () => {
      try {
        if (isEdit && eventId) {
          await updateSpaceEvent(spaceId, eventId, draft);
        } else {
          await createSpaceEvent(spaceId, draft);
        }
        if (router.canGoBack()) router.back();
        else router.replace(fallbackHref);
      } catch (error) {
        setSubmitError(toSpaceEventError(error, 'write').userMessage);
        gate.current.end();
        setSubmitting(false);
      }
    })();
  };

  const showForm = detailStatus === 'ready' && loadStatus === 'ready';

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SubScreenHeader title={isEdit ? '일정 수정' : '일정 추가'} fallbackHref={fallbackHref} />
      {detailStatus === 'loading' || loadStatus === 'loading' ? (
        <View style={styles.stateWrap}>
          <ActivityIndicator size="large" color={BRAND_GREEN} />
        </View>
      ) : detailStatus === 'error' || loadStatus === 'error' ? (
        <View style={styles.errorWrap}>
          <ErrorRetryCard
            title={loadMessage ?? detailError ?? '일정을 불러오지 못했어요.'}
            desc={
              detailKind === 'permission-denied'
                ? '이 공간의 멤버만 일정을 만들 수 있어요.'
                : '네트워크 연결을 확인한 뒤 다시 시도해 주세요.'
            }
            onRetry={retry}
          />
        </View>
      ) : showForm ? (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            style={styles.flex}
            contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 12) + 24 }]}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={[styles.label, { color: colors.text }]}>제목</Text>
            <TextInput
              value={title}
              onChangeText={(text) => {
                setSubmitError(null);
                setTitle(text);
              }}
              editable={!submitting}
              placeholder="예: 저녁 모임"
              placeholderTextColor={colors.placeholder}
              maxLength={SPACE_EVENT_TITLE_MAX}
              style={[
                styles.input,
                { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.border },
              ]}
            />

            <Text style={[styles.label, { color: colors.text }]}>날짜</Text>
            {Platform.OS === 'web' ? (
              React.createElement('input', {
                type: 'date',
                lang: 'ko-KR',
                value: dateKey,
                onChange: (e: { target?: { value?: string } }) => {
                  const next = e?.target?.value ?? '';
                  if (isValidDateKey(next)) setDateKey(next);
                },
                style: webInputStyle(isDark, colors.text, colors.inputBg, colors.border),
              })
            ) : (
              <Pressable
                onPress={() => openPicker('date')}
                disabled={submitting}
                style={[styles.row, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
              >
                <Text style={[styles.rowText, { color: colors.text }]}>{formatSpaceDayHeading(dateKey)}</Text>
              </Pressable>
            )}

            <Pressable
              onPress={() => {
                if (submitting) return;
                if (allDay) {
                  setAllDay(false);
                  setStartTime(startTime ?? '09:00');
                } else {
                  setAllDay(true);
                  setStartTime(null);
                  setEndTime(null);
                }
              }}
              style={[styles.toggle, { borderColor: colors.border, backgroundColor: colors.surface }]}
              accessibilityRole="button"
              accessibilityLabel={allDay ? '시간 지정하기' : '종일 일정으로 바꾸기'}
            >
              <Text style={[styles.toggleText, { color: colors.text }]}>
                {allDay ? '종일 일정' : '시간 있는 일정'}
              </Text>
              <Text style={[styles.toggleHint, { color: colors.textSec }]}>
                {allDay ? '시간을 지정하려면 눌러 주세요' : '하루 종일로 바꾸려면 눌러 주세요'}
              </Text>
            </Pressable>

            {!allDay ? (
              <>
                <Text style={[styles.label, { color: colors.text }]}>시작 시간</Text>
                {Platform.OS === 'web' ? (
                  React.createElement('input', {
                    type: 'time',
                    lang: 'ko-KR',
                    value: startTime ?? '',
                    onChange: (e: { target?: { value?: string } }) => {
                      const next = (e?.target?.value ?? '').slice(0, 5);
                      setStartTime(next || null);
                    },
                    style: webInputStyle(isDark, colors.text, colors.inputBg, colors.border),
                  })
                ) : (
                  <Pressable
                    onPress={() => openPicker('start')}
                    disabled={submitting}
                    style={[styles.row, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
                  >
                    <Text style={[styles.rowText, { color: startTime ? colors.text : colors.placeholder }]}>
                      {startTime ?? '시작 시간 선택'}
                    </Text>
                  </Pressable>
                )}

                <Text style={[styles.label, { color: colors.text }]}>종료 시간 (선택)</Text>
                {Platform.OS === 'web' ? (
                  React.createElement('input', {
                    type: 'time',
                    lang: 'ko-KR',
                    value: endTime ?? '',
                    onChange: (e: { target?: { value?: string } }) => {
                      const next = (e?.target?.value ?? '').slice(0, 5);
                      setEndTime(next || null);
                    },
                    style: webInputStyle(isDark, colors.text, colors.inputBg, colors.border),
                  })
                ) : (
                  <Pressable
                    onPress={() => openPicker('end')}
                    disabled={submitting}
                    style={[styles.row, { backgroundColor: colors.inputBg, borderColor: colors.border }]}
                  >
                    <Text style={[styles.rowText, { color: endTime ? colors.text : colors.placeholder }]}>
                      {endTime ?? '종료 시간 선택'}
                    </Text>
                  </Pressable>
                )}
              </>
            ) : null}

            <Text style={[styles.label, { color: colors.text }]}>설명 (선택)</Text>
            <TextInput
              value={description}
              onChangeText={(text) => {
                setSubmitError(null);
                setDescription(text);
              }}
              editable={!submitting}
              placeholder="메모를 남겨 보세요"
              placeholderTextColor={colors.placeholder}
              maxLength={SPACE_EVENT_DESCRIPTION_MAX}
              multiline
              style={[
                styles.input,
                styles.textarea,
                { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.border },
              ]}
            />

            {submitError ? (
              <Text style={[styles.error, { color: colors.errorText }]}>{submitError}</Text>
            ) : disabledHint && !canSubmit ? (
              <Text style={[styles.hint, { color: colors.textSec }]}>{disabledHint}</Text>
            ) : null}

            <Pressable
              onPress={onSubmit}
              disabled={!canSubmit}
              style={({ pressed }) => [
                styles.submit,
                {
                  backgroundColor: accent,
                  opacity: !canSubmit || pressed ? 0.72 : 1,
                },
              ]}
              accessibilityRole="button"
              accessibilityLabel={isEdit ? '일정 저장' : '일정 추가'}
            >
              {submitting ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={[styles.submitText, { color: colors.onPrimary }]}>
                  {isEdit ? '저장' : '추가'}
                </Text>
              )}
            </Pressable>
          </ScrollView>
        </KeyboardAvoidingView>
      ) : null}

      <SpaceEventPickerSheet
        visible={picker != null}
        phase={picker === 'date' ? 'date' : 'time'}
        value={tempDate}
        accent={accent}
        onChange={setTempDate}
        onCancel={() => setPicker(null)}
        onConfirm={confirmPicker}
      />
    </View>
  );
}

function webInputStyle(_isDark: boolean, color: string, background: string, border: string) {
  return {
    height: 48,
    borderRadius: 12,
    border: `1px solid ${border}`,
    padding: '0 12px',
    fontSize: 15,
    fontWeight: 600,
    color,
    background,
    marginBottom: 4,
  };
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  stateWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorWrap: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  label: {
    marginTop: 16,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '800',
  },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    fontSize: 16,
    fontWeight: '600',
  },
  textarea: {
    minHeight: 120,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  row: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  rowText: {
    fontSize: 16,
    fontWeight: '600',
  },
  toggle: {
    marginTop: 16,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  toggleText: {
    fontSize: 15,
    fontWeight: '800',
  },
  toggleHint: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '600',
  },
  hint: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '600',
  },
  error: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '700',
  },
  submit: {
    marginTop: 24,
    minHeight: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitText: {
    fontSize: 16,
    fontWeight: '800',
  },
});
