import React, { useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { useLocalSearchParams, type Href } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { SubScreenHeader } from '@/components/SubScreenHeader';
import { ErrorRetryCard } from '@/components/ErrorRetryCard';
import {
  SpaceInviteCodeCard,
  SpaceInviteEmptyCard,
  SpaceInviteSummary,
} from '@/components/spaces/SpaceInviteCard';
import { useSpaceInvite } from '@/hooks/useSpaceInvite';
import { buildInviteShareMessage } from '@/lib/spaceInviteClient';
import { SPACE_TYPE_BY_ID, spaceTypeButtonFill, spaceTypeButtonInk } from '@/lib/spaceTypes';
import { BRAND_GREEN, useTheme } from '@/theme/ThemeContext';
import { showAlert } from '@/utils/alert';
import { firstParam } from '@/utils/routerParams';

function actionLabel(action: ReturnType<typeof useSpaceInvite>['action']): string | null {
  if (action === 'create') return '초대 코드를 만들고 있어요.';
  if (action === 'rotate') return '새 코드를 발급하고 있어요.';
  if (action === 'revoke') return '초대 코드를 취소하고 있어요.';
  return null;
}

export default function SpaceInviteScreen() {
  const { colors, isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ spaceId?: string | string[] }>();
  const spaceId = firstParam(params.spaceId);
  const inviteState = useSpaceInvite(spaceId);
  const {
    space,
    invite,
    expired,
    countdown,
    status,
    action,
    busy,
    errorKind,
    errorMessage,
    retry,
    create,
    rotate,
    revoke,
  } = inviteState;
  const accent = space?.type ? SPACE_TYPE_BY_ID[space.type].accent : colors.primary;
  const [notice, setNotice] = useState<string | null>(null);
  const copyLock = useRef(false);
  const shareLock = useRef(false);
  const fallbackHref = (spaceId ? `/spaces/${spaceId}` : '/spaces') as Href;

  const usable = Boolean(invite && !expired && !busy);
  const canRotate = Boolean(!busy && space);
  const canRevoke = Boolean(invite && !expired && !busy);

  const onCopy = async () => {
    if (!usable || !invite || copyLock.current) return;
    copyLock.current = true;
    try {
      await Clipboard.setStringAsync(invite.code);
      setNotice('초대 코드가 복사되었어요');
    } catch {
      setNotice(null);
      showAlert('복사하지 못했어요', '초대 코드를 다시 복사해 주세요.');
    } finally {
      copyLock.current = false;
    }
  };

  const onShare = async () => {
    if (!usable || !invite || shareLock.current) return;
    shareLock.current = true;
    try {
      await Share.share({
        message: buildInviteShareMessage({
          code: invite.code,
          expiresAt: invite.expiresAt,
          spaceName: space?.name,
        }),
      });
    } catch {
      /* 사용자가 공유 시트를 닫은 경우는 오류로 다루지 않습니다. */
    } finally {
      shareLock.current = false;
    }
  };

  const onCreate = () => {
    if (busy) return;
    setNotice(null);
    void create();
  };

  const onRotate = () => {
    if (!canRotate) return;
    setNotice(null);
    if (invite && !expired) {
      showAlert(
        '새 코드 발급',
        '새 초대 코드를 발급하면 기존 코드는 사용할 수 없어요.',
        [
          { text: '닫기', style: 'cancel' },
          { text: '발급하기', onPress: () => { void rotate(); } },
        ],
      );
      return;
    }
    void rotate();
  };

  const onRevoke = () => {
    if (!canRevoke) return;
    setNotice(null);
    showAlert(
      '초대 취소',
      '현재 초대 코드를 취소할까요? 취소한 코드는 다시 사용할 수 없어요.',
      [
        { text: '닫기', style: 'cancel' },
        { text: '취소하기', style: 'destructive', onPress: () => { void revoke(); } },
      ],
    );
  };

  const busyHint = actionLabel(action);

  return (
    <View style={[styles.root, { backgroundColor: colors.bg }]}>
      <SubScreenHeader title="공간 초대하기" fallbackHref={fallbackHref} />

      {status === 'loading' || (status === 'error' && errorKind === 'unauthenticated') ? (
        <View style={styles.stateWrap}>
          <ActivityIndicator size="large" color={BRAND_GREEN} />
        </View>
      ) : status === 'error' ? (
        <View style={styles.errorWrap}>
          <ErrorRetryCard
            title={errorMessage ?? '초대 코드를 불러오지 못했어요.'}
            desc={
              errorKind === 'permission-denied' || errorMessage?.includes('소유자')
                ? '공간 소유자만 초대 코드를 다룰 수 있어요.'
                : errorKind === 'not-found'
                  ? '주소가 바뀌었거나 공간이 삭제됐을 수 있어요.'
                  : errorKind === 'inactive'
                    ? '이 공간은 현재 사용할 수 없어요.'
                    : '네트워크 연결을 확인한 뒤 다시 시도해 주세요.'
            }
            onRetry={retry}
          />
        </View>
      ) : space ? (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.content,
            { paddingBottom: Math.max(insets.bottom, 12) + 32 },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <SpaceInviteSummary space={space} />
          {invite ? (
            <SpaceInviteCodeCard
              code={invite.code}
              countdown={countdown}
              expired={expired}
              accent={accent}
            />
          ) : (
            <SpaceInviteEmptyCard />
          )}

          {invite ? (
            <View style={styles.actions}>
              <Pressable
                onPress={onCopy}
                disabled={!usable}
                style={({ pressed }) => [
                  styles.primary,
                  {
                    backgroundColor: spaceTypeButtonFill(accent, isDark, pressed),
                    opacity: usable ? 1 : 0.45,
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ disabled: !usable }}
                accessibilityLabel="코드 복사"
              >
                <Text style={[styles.primaryLabel, { color: spaceTypeButtonInk(accent, isDark) }]}>
                  코드 복사
                </Text>
              </Pressable>
              <Pressable
                onPress={onShare}
                disabled={!usable}
                style={({ pressed }) => [
                  styles.primary,
                  {
                    backgroundColor: spaceTypeButtonFill(accent, isDark, pressed),
                    opacity: usable ? 1 : 0.45,
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ disabled: !usable }}
                accessibilityLabel="공유하기"
              >
                <Text style={[styles.primaryLabel, { color: spaceTypeButtonInk(accent, isDark) }]}>
                  공유하기
                </Text>
              </Pressable>
              <Pressable
                onPress={onRotate}
                disabled={!canRotate}
                style={({ pressed }) => [
                  styles.secondary,
                  {
                    borderColor: accent,
                    opacity: canRotate ? (pressed ? 0.85 : 1) : 0.45,
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ disabled: !canRotate, busy: action === 'rotate' }}
                accessibilityLabel="새 코드 발급"
              >
                <Text style={[styles.secondaryLabel, { color: colors.text }]}>새 코드 발급</Text>
              </Pressable>
              {invite && !expired ? (
                <Pressable
                  onPress={onRevoke}
                  disabled={!canRevoke}
                  style={({ pressed }) => [
                    styles.secondary,
                    {
                      borderColor: colors.logoutBorder,
                      opacity: canRevoke ? (pressed ? 0.85 : 1) : 0.45,
                    },
                  ]}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: !canRevoke, busy: action === 'revoke' }}
                  accessibilityLabel="초대 취소"
                >
                  <Text style={[styles.secondaryLabel, { color: colors.logoutText }]}>초대 취소</Text>
                </Pressable>
              ) : null}
            </View>
          ) : (
            <View style={styles.actions}>
              <Pressable
                onPress={onCreate}
                disabled={busy}
                style={({ pressed }) => [
                  styles.primary,
                  {
                    backgroundColor: spaceTypeButtonFill(accent, isDark, pressed),
                    opacity: busy ? 0.45 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityState={{ disabled: busy, busy: action === 'create' }}
                accessibilityLabel="초대 코드 만들기"
              >
                {action === 'create' ? (
                  <ActivityIndicator color={spaceTypeButtonInk(accent, isDark)} />
                ) : (
                  <Text style={[styles.primaryLabel, { color: spaceTypeButtonInk(accent, isDark) }]}>
                    초대 코드 만들기
                  </Text>
                )}
              </Pressable>
            </View>
          )}

          {busyHint ? (
            <Text style={[styles.hint, { color: colors.textMuted }]}>{busyHint}</Text>
          ) : notice ? (
            <Text style={[styles.hint, { color: colors.success }]}>{notice}</Text>
          ) : errorMessage ? (
            <Text style={[styles.hint, { color: colors.errorText }]}>{errorMessage}</Text>
          ) : null}
        </ScrollView>
      ) : (
        <View style={styles.stateWrap}>
          <ActivityIndicator size="large" color={BRAND_GREEN} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  actions: {
    marginTop: 18,
    gap: 10,
  },
  primary: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  primaryLabel: {
    fontSize: 15,
    fontWeight: '900',
  },
  secondary: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryLabel: {
    fontSize: 15,
    fontWeight: '800',
  },
  hint: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 20,
  },
  stateWrap: {
    flex: 1,
    minHeight: 220,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorWrap: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
});
