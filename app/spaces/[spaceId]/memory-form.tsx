import React, { useEffect, useRef, useState } from 'react';
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
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { ErrorRetryCard } from '@/components/ErrorRetryCard';
import { SubScreenHeader } from '@/components/SubScreenHeader';
import { SpaceEventPickerSheet } from '@/components/spaces/SpaceEventPickerSheet';
import { SpaceMemoryImage } from '@/components/spaces/SpaceMemoryImage';
import { useAuth } from '@/hooks/useAuth';
import { useAuthBearerHeaders } from '@/hooks/useAuthBearerHeaders';
import { useSpaceDetail } from '@/hooks/useSpaceDetail';
import {
  SPACE_MEMORY_CONTENT_MAX,
  SPACE_MEMORY_TITLE_MAX,
  isValidMemoryDateKey,
  isValidSpaceMemoryDraft,
  isValidSpaceMemoryTitle,
} from '@/lib/spaceMemory';
import {
  canMutateSpaceMemory,
  createMemoryWriteGate,
  toSpaceMemoryError,
} from '@/lib/spaceMemoryClient';
import {
  dateKeyFromLocalDate,
  formatSpaceDayHeading,
  localDateFromDateKey,
} from '@/lib/spaceEvent';
import {
  moveMemoryPhoto,
  remainingMemoryPhotoSlots,
  remoteMemoryPhotos,
  spaceMemoryImageUri,
  type MemoryPhotoDraft,
} from '@/lib/spaceMemoryImage';
import { SPACE_TYPE_BY_ID } from '@/lib/spaceTypes';
import { createSpaceMemory, getSpaceMemory, updateSpaceMemory } from '@/services/spaceMemoryService';
import { getR2ImageApiBaseUrl } from '@/services/storageService';
import { BRAND_GREEN, useTheme } from '@/theme/ThemeContext';
import { showAlert } from '@/utils/alert';
import { firstParam } from '@/utils/routerParams';

export default function SpaceMemoryFormScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{
    spaceId?: string | string[];
    memoryId?: string | string[];
    dateKey?: string | string[];
  }>();
  const spaceId = firstParam(params.spaceId);
  const memoryId = firstParam(params.memoryId);
  const isEdit = Boolean(memoryId);
  const { user, isRegistered, loading: authLoading } = useAuth();
  const uid = isRegistered && user?.uid ? user.uid : null;
  const fallbackHref = spaceId ? `/spaces/${spaceId}/memories` : '/spaces';
  const { space, status: detailStatus, errorKind, errorMessage, retry } = useSpaceDetail(spaceId);
  const { headers } = useAuthBearerHeaders();
  const accent = space?.type ? SPACE_TYPE_BY_ID[space.type].accent : colors.primary;
  const initialDateKey = firstParam(params.dateKey);

  const [loadStatus, setLoadStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>(
    isEdit ? 'loading' : 'ready',
  );
  const [loadMessage, setLoadMessage] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [dateKey, setDateKey] = useState(
    initialDateKey && isValidMemoryDateKey(initialDateKey)
      ? initialDateKey
      : dateKeyFromLocalDate(new Date()),
  );
  const [content, setContent] = useState('');
  const [photos, setPhotos] = useState<MemoryPhotoDraft[]>([]);
  const [originalKeys, setOriginalKeys] = useState<string[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [tempDate, setTempDate] = useState(new Date());
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const gate = useRef(createMemoryWriteGate());

  useEffect(() => {
    if (!isEdit || !spaceId || !memoryId || authLoading) return;
    let cancelled = false;
    setLoadStatus('loading');
    void (async () => {
      try {
        const memory = await getSpaceMemory(spaceId, memoryId);
        if (cancelled) return;
        if (!canMutateSpaceMemory(memory.createdByUid, uid)) {
          setLoadMessage('작성한 멤버만 기록을 수정할 수 있어요.');
          setLoadStatus('error');
          return;
        }
        setTitle(memory.title);
        setDateKey(memory.dateKey);
        setContent(memory.content);
        setOriginalKeys(memory.imageKeys);
        setPhotos(remoteMemoryPhotos(memory.imageKeys, spaceId, memory.id));
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
  }, [authLoading, isEdit, memoryId, spaceId, uid]);

  const draft = {
    title,
    content,
    dateKey,
    imageKeys: photos.flatMap((photo) => (photo.kind === 'remote' ? [photo.key] : [])),
  };
  const canSubmit =
    isValidSpaceMemoryTitle(title) &&
    isValidMemoryDateKey(dateKey) &&
    isValidSpaceMemoryDraft(draft) &&
    !submitting &&
    loadStatus === 'ready' &&
    detailStatus === 'ready';

  const remaining = remainingMemoryPhotoSlots(photos);

  const pickPhotos = async () => {
    if (submitting || remaining <= 0) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('사진 권한 필요', '설정에서 사진 접근을 허용해 주세요.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      orderedSelection: true,
      quality: 1,
    });
    if (result.canceled) return;
    const incoming: MemoryPhotoDraft[] = (result.assets ?? [])
      .map((asset) => asset.uri)
      .filter((uri) => uri.length > 0)
      .slice(0, remaining)
      .map((uri) => ({ kind: 'local' as const, id: `local-${uri}-${Math.random()}`, uri }));
    setPhotos((prev) => [...prev, ...incoming].slice(0, 5));
  };

  const onSubmit = () => {
    if (!spaceId || !canSubmit) return;
    if (!gate.current.tryStart()) return;
    setSubmitting(true);
    setSubmitError(null);
    void (async () => {
      try {
        const locals = photos.filter((photo) => photo.kind === 'local').map((photo) => photo.uri);
        if (isEdit && memoryId) {
          const result = await updateSpaceMemory(
            spaceId,
            memoryId,
            { title, content, dateKey },
            photos,
            originalKeys,
          );
          if (result.failedPhotoCount > 0) {
            showAlert('일부 사진을 올리지 못했어요', '글은 저장됐고, 실패한 사진은 다시 올려 주세요.');
          }
        } else {
          const result = await createSpaceMemory(spaceId, { title, content, dateKey, imageKeys: [] }, locals);
          if (result.failedPhotoCount > 0) {
            showAlert('일부 사진을 올리지 못했어요', '글은 저장됐고, 실패한 사진은 수정에서 다시 올려 주세요.');
          }
        }
        if (router.canGoBack()) router.back();
        else router.replace(fallbackHref);
      } catch (error) {
        setSubmitError(toSpaceMemoryError(error, 'write').userMessage);
        gate.current.end();
        setSubmitting(false);
      }
    })();
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SubScreenHeader title={isEdit ? '기록 수정' : '기록 추가'} fallbackHref={fallbackHref} />
      {detailStatus === 'loading' || loadStatus === 'loading' ? (
        <View style={styles.state}>
          <ActivityIndicator size="large" color={BRAND_GREEN} />
        </View>
      ) : detailStatus === 'error' || loadStatus === 'error' ? (
        <View style={styles.errorWrap}>
          <ErrorRetryCard
            title={loadMessage ?? errorMessage ?? '기록을 불러오지 못했어요.'}
            desc={
              errorKind === 'permission-denied'
                ? '이 공간의 멤버만 기록을 남길 수 있어요.'
                : '네트워크 연결을 확인한 뒤 다시 시도해 주세요.'
            }
            onRetry={retry}
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
              placeholder="예: 제주 첫날"
              placeholderTextColor={colors.placeholder}
              maxLength={SPACE_MEMORY_TITLE_MAX}
              style={[styles.input, { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.border }]}
            />

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

            <Text style={[styles.label, { color: colors.text }]}>사진 (최대 5장)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photos}>
              {photos.map((photo, index) => {
                const uri =
                  photo.kind === 'local'
                    ? photo.uri
                    : spaceId && memoryId
                      ? spaceMemoryImageUri(getR2ImageApiBaseUrl(), spaceId, memoryId, photo.key)
                      : null;
                return (
                  <View key={photo.id} style={styles.thumbWrap}>
                    <SpaceMemoryImage
                      uri={uri}
                      headers={photo.kind === 'remote' ? headers : undefined}
                      contentFit="cover"
                      style={styles.thumb}
                    />
                    <View style={styles.thumbActions}>
                      {index > 0 ? (
                        <Pressable onPress={() => setPhotos((prev) => moveMemoryPhoto(prev, index, index - 1))}>
                          <MaterialIcons name="chevron-left" size={18} color={colors.text} />
                        </Pressable>
                      ) : null}
                      {index < photos.length - 1 ? (
                        <Pressable onPress={() => setPhotos((prev) => moveMemoryPhoto(prev, index, index + 1))}>
                          <MaterialIcons name="chevron-right" size={18} color={colors.text} />
                        </Pressable>
                      ) : null}
                      <Pressable onPress={() => setPhotos((prev) => prev.filter((item) => item.id !== photo.id))}>
                        <MaterialIcons name="close" size={18} color={colors.logoutText} />
                      </Pressable>
                    </View>
                  </View>
                );
              })}
              {remaining > 0 ? (
                <Pressable
                  onPress={() => void pickPhotos()}
                  style={[styles.addThumb, { borderColor: colors.border, backgroundColor: colors.surface }]}
                  accessibilityLabel="사진 추가"
                >
                  <MaterialIcons name="add-a-photo" size={22} color={accent} />
                </Pressable>
              ) : null}
            </ScrollView>

            <Text style={[styles.label, { color: colors.text }]}>내용 (선택)</Text>
            <TextInput
              value={content}
              onChangeText={setContent}
              editable={!submitting}
              placeholder="함께한 순간을 적어 보세요"
              placeholderTextColor={colors.placeholder}
              maxLength={SPACE_MEMORY_CONTENT_MAX}
              multiline
              style={[
                styles.input,
                styles.textarea,
                { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.border },
              ]}
            />

            {submitError ? (
              <Text style={[styles.error, { color: colors.errorText }]}>{submitError}</Text>
            ) : null}

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
  textarea: { minHeight: 140, paddingTop: 12, textAlignVertical: 'top' },
  row: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    justifyContent: 'center',
  },
  rowText: { fontSize: 16, fontWeight: '600' },
  photos: { gap: 8, paddingRight: 8 },
  thumbWrap: { width: 88 },
  thumb: { width: 88, height: 88, borderRadius: 12, overflow: 'hidden' },
  thumbActions: { marginTop: 6, flexDirection: 'row', justifyContent: 'center', gap: 4 },
  addThumb: {
    width: 88,
    height: 88,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
