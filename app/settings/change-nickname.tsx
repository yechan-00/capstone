import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { ProfileAvatar } from '@/components/ProfileAvatar';
import { PrimaryButton } from '@/components/PrimaryButton';
import { SettingsFormScreen } from '@/components/SettingsFormScreen';
import { createSettingsFormStyles } from '@/components/settingsFormStyles';
import { useAuth } from '@/hooks/useAuth';
import { NICKNAME_MAX, normalizeNickname, ownProfileImageUri } from '@/lib/profileImage';
import { ImageUploadError, deleteProfileImageObject, getR2ImageApiBaseUrl, uploadProfileImage } from '@/services/storageService';
import { BRAND_GREEN, useTheme } from '@/theme/ThemeContext';
import { showAlert } from '@/utils/alert';

export default function ChangeNicknameScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const { user, account, updateProfileFields } = useAuth();
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [removed, setRemoved] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const lock = useRef(false);

  const current = (account?.nickname ?? '').trim();
  const styles = useMemo(() => createSettingsFormStyles(colors), [colors]);
  const uid = user?.uid ?? null;
  const savedKey = account?.profileImageKey ?? null;
  const remoteUri =
    !pickedUri && !removed && uid
      ? ownProfileImageUri(getR2ImageApiBaseUrl(), uid, savedKey)
      : null;
  const previewUri = pickedUri ?? remoteUri;
  const hasPhoto = Boolean(pickedUri || (savedKey && !removed));

  useEffect(() => {
    setNext(account?.nickname ?? '');
  }, [account?.nickname]);

  useEffect(() => {
    let cancelled = false;
    if (!user || !remoteUri) {
      setToken(null);
      return;
    }
    user
      .getIdToken()
      .then((value) => {
        if (!cancelled) setToken(value);
      })
      .catch(() => {
        if (!cancelled) setToken(null);
      });
    return () => {
      cancelled = true;
    };
  }, [remoteUri, user]);

  const pickPhoto = async () => {
    if (busy || lock.current) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showAlert('사진 권한 필요', '설정에서 사진 접근 권한을 허용해 주세요.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
      allowsMultipleSelection: false,
    });
    if (result.canceled) return;
    const uri = result.assets[0]?.uri;
    if (!uri) return;
    setPickedUri(uri);
    setRemoved(false);
  };

  const onRemovePhoto = () => {
    if (busy || lock.current) return;
    if (!hasPhoto) return;
    setPickedUri(null);
    setRemoved(true);
  };

  const onSubmit = async () => {
    if (lock.current || busy) return;
    if (!uid) {
      showAlert('프로필', '로그인이 필요해요.');
      return;
    }
    const trimmed = normalizeNickname(next);
    const nicknameChanged = trimmed !== current;
    const photoChanged = Boolean(pickedUri) || (removed && Boolean(savedKey));
    if (!nicknameChanged && !photoChanged) {
      showAlert('프로필', '변경된 내용이 없습니다.');
      return;
    }

    lock.current = true;
    setBusy(true);
    let uploadedKey: string | null = null;
    try {
      const patch: { nickname?: string; profileImageKey?: string | null } = {};
      if (nicknameChanged) patch.nickname = trimmed;

      if (pickedUri) {
        setProgress('사진을 올리고 있어요.');
        uploadedKey = await uploadProfileImage(uid, pickedUri);
        patch.profileImageKey = uploadedKey;
      } else if (removed && savedKey) {
        patch.profileImageKey = null;
      }

      setProgress('저장 중...');
      await updateProfileFields(patch);

      if (pickedUri && savedKey && savedKey !== uploadedKey) {
        try {
          await deleteProfileImageObject(uid, savedKey);
        } catch (error) {
          console.warn('[profile] previous image cleanup failed', error);
        }
      }
      if (removed && savedKey) {
        try {
          await deleteProfileImageObject(uid, savedKey);
        } catch (error) {
          console.warn('[profile] image delete cleanup failed', error);
        }
      }

      setPickedUri(null);
      setRemoved(false);
      showAlert('완료', '프로필이 저장되었습니다.', [{ text: '확인', onPress: () => router.back() }]);
    } catch (err) {
      if (uploadedKey) {
        try {
          await deleteProfileImageObject(uid, uploadedKey);
        } catch (cleanupError) {
          console.warn('[profile] uploaded image rollback failed', cleanupError);
        }
      }
      const message = err instanceof ImageUploadError
        ? err.message
        : '저장에 실패했습니다.';
      console.warn('[settings] profile update failed', err);
      showAlert('프로필', message);
    } finally {
      lock.current = false;
      setBusy(false);
      setProgress(null);
    }
  };

  return (
    <SettingsFormScreen
      title="프로필 편집"
      noticeTitle="프로필 설정"
      noticeBody="닉네임과 프로필 사진은 공유 공간 멤버에게만 보여요. 이메일이나 소비 기록은 공유되지 않습니다."
    >
      <View style={{ alignItems: 'center', gap: 12 }}>
        <ProfileAvatar
          uri={previewUri}
          headers={!pickedUri && token ? { Authorization: `Bearer ${token}` } : undefined}
          name={next || current}
          size={96}
        />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Pressable
            onPress={() => {
              void pickPhoto();
            }}
            disabled={busy}
            style={({ pressed }) => ({
              minHeight: 36,
              paddingHorizontal: 12,
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.surfaceMuted,
              opacity: busy ? 0.5 : pressed ? 0.85 : 1,
            })}
            accessibilityRole="button"
            accessibilityLabel="사진 변경"
          >
            <Text style={{ color: colors.text, fontWeight: '800', fontSize: 13 }}>사진 변경</Text>
          </Pressable>
          <Pressable
            onPress={onRemovePhoto}
            disabled={busy || !hasPhoto}
            style={({ pressed }) => ({
              minHeight: 36,
              paddingHorizontal: 12,
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.surfaceMuted,
              opacity: busy || !hasPhoto ? 0.4 : pressed ? 0.85 : 1,
            })}
            accessibilityRole="button"
            accessibilityLabel="사진 삭제"
          >
            <Text style={{ color: colors.logoutText, fontWeight: '800', fontSize: 13 }}>사진 삭제</Text>
          </Pressable>
        </View>
      </View>

      <View>
        <Text style={styles.label}>현재 닉네임</Text>
        <Text style={styles.current}>{current ? current : '미설정'}</Text>
      </View>

      <View>
        <Text style={styles.label}>새 닉네임</Text>
        <TextInput
          style={styles.input}
          value={next}
          onChangeText={setNext}
          maxLength={NICKNAME_MAX}
          autoCorrect={false}
          placeholder="닉네임 입력"
          placeholderTextColor={colors.placeholder}
          editable={!busy}
        />
      </View>

      {progress ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <ActivityIndicator size="small" color={BRAND_GREEN} />
          <Text style={[styles.noticeBody, { marginTop: 0 }]}>{progress}</Text>
        </View>
      ) : null}

      <PrimaryButton label={busy ? '저장 중...' : '저장'} onPress={() => { void onSubmit(); }} disabled={busy} />
    </SettingsFormScreen>
  );
}
