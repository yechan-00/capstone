import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { SubScreenHeader } from '@/components/SubScreenHeader';
import { SpaceListCard } from '@/components/spaces/SpaceListCard';
import { useAuth } from '@/hooks/useAuth';
import {
  INVITE_CODE_LENGTH,
  SpaceInviteError,
  inviteCodeFromRouteParam,
  isInviteCode,
  sanitizeInviteCodeInput,
  stashJoinCodeForAuth,
  type SpaceInvitePreview,
} from '@/lib/spaceInviteClient';
import { joinSpaceByInvite, previewSpaceInvite } from '@/services/spaceInviteService';
import { useTheme } from '@/theme/ThemeContext';
import { showAlert } from '@/utils/alert';

function loginHref() {
  return Platform.OS === 'web' ? '/home' : '/(auth)/login';
}

function previewHint(preview: SpaceInvitePreview): string {
  if (preview.reason === 'already-member') return '이미 참여한 공간이에요.';
  if (preview.reason === 'full') return '이 공간은 참여 인원이 가득 찼어요.';
  return '이 공간에 참여하시겠어요?';
}

export default function JoinSpaceScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const incomingCode = inviteCodeFromRouteParam(params.code);
  const rawCodeParam = Array.isArray(params.code) ? params.code[0] : params.code;
  const hadInvalidCodeParam = typeof rawCodeParam === 'string'
    && rawCodeParam.trim().length > 0
    && !isInviteCode(incomingCode);
  const { isRegistered, loading: authLoading } = useAuth();
  const [code, setCode] = useState(incomingCode);
  const appliedIncoming = useRef(incomingCode);
  const [focused, setFocused] = useState(false);
  const [preview, setPreview] = useState<SpaceInvitePreview | null>(null);
  const [checking, setChecking] = useState(false);
  const [joining, setJoining] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const checkingRef = useRef(false);
  const joiningRef = useRef(false);
  const autoPreviewedRef = useRef<string | null>(null);

  const codeValid = isInviteCode(code);
  const busy = checking || joining;
  const canPreview = codeValid && !busy && isRegistered && !authLoading;
  const canJoin = Boolean(preview?.canJoin && !busy && isRegistered);
  const canOpenExisting = Boolean(preview?.reason === 'already-member' && !busy && isRegistered);

  const formatHint = useMemo(() => {
    if (authLoading) return '로그인 상태를 확인하고 있어요.';
    if (!isRegistered) return '로그인이 필요해요.';
    if (checking) return '공간을 확인하고 있어요.';
    if (joining) return '공간에 참여하고 있어요.';
    if (code.length === 0) return null;
    if (!codeValid) return '초대 코드 8자리를 입력해 주세요.';
    return null;
  }, [authLoading, checking, code.length, codeValid, isRegistered, joining]);

  useEffect(() => {
    if (hadInvalidCodeParam) {
      setErrorMessage('초대 코드 형식을 다시 확인해 주세요.');
      return;
    }
    if (!incomingCode || incomingCode === appliedIncoming.current) return;
    appliedIncoming.current = incomingCode;
    autoPreviewedRef.current = null;
    setCode(incomingCode);
    setPreview(null);
    setErrorMessage(null);
  }, [hadInvalidCodeParam, incomingCode]);

  const goToLogin = useCallback(() => {
    stashJoinCodeForAuth(code);
    router.replace(loginHref());
  }, [code, router]);

  const goToSpace = (spaceId: string) => {
    router.replace({
      pathname: '/spaces/[spaceId]',
      params: { spaceId },
    });
  };

  const onChangeCode = (raw: string) => {
    if (busy) return;
    setCode(sanitizeInviteCodeInput(raw));
    setPreview(null);
    setErrorMessage(null);
  };

  const onPreview = useCallback(async () => {
    if (checkingRef.current || joiningRef.current) return;
    if (!isInviteCode(code) || authLoading) return;
    if (!isRegistered) {
      goToLogin();
      return;
    }
    checkingRef.current = true;
    setChecking(true);
    setErrorMessage(null);
    setPreview(null);
    try {
      const result = await previewSpaceInvite(code);
      setPreview(result);
    } catch (error) {
      const mapped = error instanceof SpaceInviteError
        ? error
        : new SpaceInviteError('unavailable');
      if (mapped.code === 'unauthenticated') {
        checkingRef.current = false;
        setChecking(false);
        goToLogin();
        return;
      }
      setErrorMessage(mapped.userMessage);
    } finally {
      checkingRef.current = false;
      setChecking(false);
    }
  }, [authLoading, code, goToLogin, isRegistered]);

  useEffect(() => {
    if (!isRegistered || authLoading) return;
    if (!isInviteCode(incomingCode) || incomingCode !== code) return;
    if (autoPreviewedRef.current === incomingCode) return;
    autoPreviewedRef.current = incomingCode;
    void onPreview();
  }, [authLoading, code, incomingCode, isRegistered, onPreview]);

  const onJoin = async () => {
    if (joiningRef.current || checkingRef.current) return;
    if (!preview || (!preview.canJoin && preview.reason !== 'already-member')) return;
    if (!isRegistered) {
      goToLogin();
      return;
    }
    joiningRef.current = true;
    setJoining(true);
    setErrorMessage(null);
    try {
      const spaceId = await joinSpaceByInvite(code);
      const already = preview.reason === 'already-member';
      showAlert(
        already ? '이미 참여한 공간이에요' : '참여했어요',
        already ? '해당 공간으로 이동할게요.' : '함께할 공간에 들어왔어요.',
        [{ text: '확인', onPress: () => goToSpace(spaceId) }],
      );
    } catch (error) {
      const mapped = error instanceof SpaceInviteError
        ? error
        : new SpaceInviteError('unavailable', '공간에 참여하지 못했어요. 잠시 후 다시 시도해 주세요.');
      joiningRef.current = false;
      setJoining(false);
      if (mapped.code === 'unauthenticated') {
        goToLogin();
        return;
      }
      setErrorMessage(mapped.userMessage);
    }
  };

  const onCancelPreview = () => {
    if (busy) return;
    setPreview(null);
    setErrorMessage(null);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SubScreenHeader title="공간 참여하기" fallbackHref="/spaces" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom, 12) + 24 },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.intro}>
            <Text style={[styles.headline, { color: colors.text }]}>
              전달받은 초대 코드를{'\n'}입력해 주세요.
            </Text>
            <Text style={[styles.subhead, { color: colors.textSec }]}>
              8자리 코드를 입력하면 참여할 공간을 미리 확인할 수 있어요.
            </Text>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>초대 코드</Text>
          <TextInput
            value={code}
            onChangeText={onChangeCode}
            editable={!busy}
            placeholder="예: 2345ABCD"
            placeholderTextColor={colors.placeholder}
            autoCapitalize="characters"
            autoCorrect={false}
            autoComplete="off"
            spellCheck={false}
            returnKeyType="done"
            onSubmitEditing={() => {
              if (canPreview) void onPreview();
            }}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={[
              styles.input,
              {
                color: colors.text,
                backgroundColor: colors.inputBg,
                borderColor: errorMessage && !preview
                  ? colors.errorText
                  : focused
                    ? colors.primary
                    : colors.borderInput,
              },
            ]}
            accessibilityLabel="초대 코드"
          />
          <Text style={[styles.counter, { color: colors.textMuted }]}>
            {code.length}/{INVITE_CODE_LENGTH}
          </Text>

          <Pressable
            onPress={() => { void onPreview(); }}
            disabled={!canPreview}
            style={({ pressed }) => [
              styles.primary,
              {
                backgroundColor: colors.accentCta,
                opacity: !canPreview ? 0.5 : pressed ? 0.85 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canPreview, busy: checking }}
            accessibilityLabel="공간 확인하기"
          >
            {checking ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={[styles.primaryLabel, { color: colors.onPrimary }]}>공간 확인하기</Text>
            )}
          </Pressable>

          {preview ? (
            <View style={styles.previewBlock}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>참여할 공간</Text>
              <SpaceListCard
                preview
                space={{
                  id: 'invite-preview',
                  name: preview.name,
                  type: preview.type,
                }}
              />
              <Text style={[styles.confirm, { color: colors.text }]}>{previewHint(preview)}</Text>
              {preview.reason === 'ok' ? (
                <View style={styles.actions}>
                  <Pressable
                    onPress={() => { void onJoin(); }}
                    disabled={!canJoin}
                    style={({ pressed }) => [
                      styles.primary,
                      {
                        backgroundColor: colors.accentCta,
                        opacity: !canJoin ? 0.5 : pressed ? 0.85 : 1,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !canJoin, busy: joining }}
                    accessibilityLabel="참여하기"
                  >
                    {joining ? (
                      <ActivityIndicator color={colors.onPrimary} />
                    ) : (
                      <Text style={[styles.primaryLabel, { color: colors.onPrimary }]}>참여하기</Text>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={onCancelPreview}
                    disabled={busy}
                    style={({ pressed }) => [
                      styles.secondary,
                      {
                        borderColor: colors.border,
                        opacity: busy ? 0.45 : pressed ? 0.85 : 1,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: busy }}
                    accessibilityLabel="취소"
                  >
                    <Text style={[styles.secondaryLabel, { color: colors.text }]}>취소</Text>
                  </Pressable>
                </View>
              ) : preview.reason === 'already-member' ? (
                <View style={styles.actions}>
                  <Pressable
                    onPress={() => { void onJoin(); }}
                    disabled={!canOpenExisting}
                    style={({ pressed }) => [
                      styles.primary,
                      {
                        backgroundColor: colors.accentCta,
                        opacity: !canOpenExisting ? 0.5 : pressed ? 0.85 : 1,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: !canOpenExisting, busy: joining }}
                    accessibilityLabel="공간 열기"
                  >
                    {joining ? (
                      <ActivityIndicator color={colors.onPrimary} />
                    ) : (
                      <Text style={[styles.primaryLabel, { color: colors.onPrimary }]}>공간 열기</Text>
                    )}
                  </Pressable>
                  <Pressable
                    onPress={onCancelPreview}
                    disabled={busy}
                    style={({ pressed }) => [
                      styles.secondary,
                      {
                        borderColor: colors.border,
                        opacity: busy ? 0.45 : pressed ? 0.85 : 1,
                      },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel="취소"
                  >
                    <Text style={[styles.secondaryLabel, { color: colors.text }]}>취소</Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable
                  onPress={onCancelPreview}
                  disabled={busy}
                  style={({ pressed }) => [
                    styles.secondary,
                    {
                      borderColor: colors.border,
                      opacity: pressed ? 0.85 : 1,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel="코드 다시 입력"
                >
                  <Text style={[styles.secondaryLabel, { color: colors.text }]}>코드 다시 입력</Text>
                </Pressable>
              )}
            </View>
          ) : null}

          {errorMessage ? (
            <Text style={[styles.hint, { color: colors.errorText }]}>{errorMessage}</Text>
          ) : formatHint ? (
            <Text style={[styles.hint, { color: colors.textMuted }]}>{formatHint}</Text>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  intro: {
    marginBottom: 28,
  },
  headline: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
    lineHeight: 30,
  },
  subhead: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 10,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 4,
  },
  counter: {
    marginTop: 6,
    marginBottom: 18,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
  },
  primary: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryLabel: {
    fontSize: 16,
    fontWeight: '900',
  },
  secondary: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {
    fontSize: 15,
    fontWeight: '800',
  },
  previewBlock: {
    marginTop: 28,
  },
  confirm: {
    marginTop: 16,
    marginBottom: 12,
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 22,
  },
  actions: {
    gap: 10,
  },
  hint: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
});
