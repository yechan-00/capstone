import React, { useMemo, useRef, useState } from 'react';
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
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SubScreenHeader } from '@/components/SubScreenHeader';
import { SpaceListCard } from '@/components/spaces/SpaceListCard';
import { SpaceTypePicker } from '@/components/spaces/SpaceTypePicker';
import { useAuth } from '@/hooks/useAuth';
import {
  SPACE_NAME_MAX,
  SPACE_PREVIEW_FALLBACK_NAME,
  isValidSpaceName,
  parseClientSpaceName,
  type SpaceTypeId,
} from '@/lib/spaceTypes';
import { CreateSpaceError, toCreateSpaceError } from '@/lib/createSpaceClient';
import { createSpace } from '@/services/spaceService';
import { useTheme } from '@/theme/ThemeContext';

function loginHref() {
  return Platform.OS === 'web' ? '/home' : '/(auth)/login';
}

export default function CreateSpaceScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isRegistered, loading: authLoading } = useAuth();
  const [name, setName] = useState('');
  const [type, setType] = useState<SpaceTypeId | null>(null);
  const [focused, setFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const submittingRef = useRef(false);

  const trimmed = parseClientSpaceName(name);
  const nameValid = isValidSpaceName(name);
  const whitespaceOnly = name.length > 0 && trimmed.length === 0;
  const canSubmit =
    nameValid && type !== null && !submitting && isRegistered && !authLoading;
  const previewName = trimmed || SPACE_PREVIEW_FALLBACK_NAME;

  const disabledHint = useMemo(() => {
    if (submitting) return '잠시만 기다려 주세요.';
    if (authLoading) return '로그인 상태를 확인하고 있어요.';
    if (!isRegistered) return '로그인이 필요해요.';
    if (!nameValid && type == null) return '공간 이름과 유형을 모두 선택해 주세요.';
    if (!nameValid) return '공간 이름을 입력해 주세요.';
    if (type == null) return '공간 유형을 선택해 주세요.';
    return null;
  }, [authLoading, isRegistered, nameValid, submitting, type]);

  const goToLogin = () => {
    router.replace(loginHref());
  };

  const onSubmit = async () => {
    if (submittingRef.current || submitting) return;
    if (authLoading) return;
    if (!isRegistered) {
      goToLogin();
      return;
    }
    if (!isValidSpaceName(name) || type == null) return;

    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await createSpace({ name, type });
      if (!result.spaceId) {
        setSubmitError(new CreateSpaceError('unavailable', true).userMessage);
        submittingRef.current = false;
        setSubmitting(false);
        return;
      }
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/spaces');
      }
    } catch (error) {
      const mapped = toCreateSpaceError(error);
      if (mapped.code === 'unauthenticated') {
        submittingRef.current = false;
        setSubmitting(false);
        goToLogin();
        return;
      }
      setSubmitError(mapped.userMessage);
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SubScreenHeader title="새 공간 만들기" fallbackHref="/spaces" />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          <View style={styles.intro}>
            <Text style={[styles.headline, { color: colors.text }]}>
              {'함께할 공간을\n만들어 보세요'}
            </Text>
            <Text style={[styles.subhead, { color: colors.textSec }]}>
              소중한 사람들과 기록을 모을 공간의 이름과 유형을 선택해 주세요.
            </Text>
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>공간 이름</Text>
          <TextInput
            value={name}
            onChangeText={(text) => {
              if (submitting) return;
              setSubmitError(null);
              setName(text);
            }}
            editable={!submitting}
            placeholder="예: 우리들의 추억"
            placeholderTextColor={colors.placeholder}
            maxLength={SPACE_NAME_MAX}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="done"
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={[
              styles.input,
              {
                color: colors.text,
                backgroundColor: colors.inputBg,
                borderColor: whitespaceOnly
                  ? colors.errorText
                  : focused
                    ? colors.primary
                    : colors.borderInput,
              },
            ]}
            accessibilityLabel="공간 이름"
          />
          <View style={styles.inputMeta}>
            {whitespaceOnly ? (
              <Text style={[styles.error, { color: colors.errorText }]}>
                공간 이름을 입력해 주세요.
              </Text>
            ) : (
              <View />
            )}
            <Text style={[styles.counter, { color: colors.textMuted }]}>
              {name.length}/{SPACE_NAME_MAX}
            </Text>
          </View>

          <View style={styles.typeBlock}>
            <SpaceTypePicker
              value={type}
              disabled={submitting}
              onChange={(next) => {
                if (submitting) return;
                setSubmitError(null);
                setType(next);
              }}
            />
          </View>

          <Text style={[styles.sectionTitle, { color: colors.text }]}>공간 미리보기</Text>
          <SpaceListCard
            preview
            previewName={previewName}
            space={{
              id: 'preview',
              name: trimmed,
              type: type ?? undefined,
            }}
          />
        </ScrollView>

        <View
          style={[
            styles.footer,
            {
              paddingBottom: Math.max(insets.bottom, 12) + 8,
              borderTopColor: colors.border,
              backgroundColor: colors.bg,
            },
          ]}
        >
          <Pressable
            onPress={onSubmit}
            disabled={!canSubmit}
            style={({ pressed }) => [
              styles.submit,
              {
                backgroundColor: colors.accentCta,
                opacity: !canSubmit ? 0.5 : pressed ? 0.85 : 1,
              },
            ]}
            accessibilityRole="button"
            accessibilityState={{ disabled: !canSubmit, busy: submitting }}
            accessibilityLabel="공간 만들기"
          >
            {submitting ? (
              <ActivityIndicator color={colors.onPrimary} />
            ) : (
              <Text style={[styles.submitLabel, { color: colors.onPrimary }]}>공간 만들기</Text>
            )}
          </Pressable>
          {submitError ? (
            <Text style={[styles.hint, { color: colors.errorText }]}>{submitError}</Text>
          ) : disabledHint ? (
            <Text style={[styles.hint, { color: colors.textMuted }]}>{disabledHint}</Text>
          ) : null}
        </View>
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
    paddingBottom: 24,
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
    fontSize: 16,
    fontWeight: '600',
  },
  inputMeta: {
    marginTop: 6,
    marginBottom: 22,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 18,
  },
  error: {
    fontSize: 12,
    fontWeight: '700',
  },
  counter: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 'auto',
  },
  typeBlock: {
    marginBottom: 24,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  submit: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitLabel: {
    fontSize: 16,
    fontWeight: '900',
  },
  hint: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
});
