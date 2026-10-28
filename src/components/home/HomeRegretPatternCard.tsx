import React from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import {
  formatRegretPatternScheduledTimes,
  type HomeRegretPatternView,
} from '@/lib/regretPatternAlert';
import { resolvePatternAlertBadge, type PatternAlertBadgeTone } from '@/lib/regretPatternAlertStatus';
import { resolveRegretPatternAlertEnabled } from '@/lib/accountSettings';
import type { Account, RegretPatternAlertSlot } from '@/lib/types';
import type { NotificationPermissionKind } from '@/services/notificationService';
import { BRAND_GREEN, useTheme } from '@/theme/ThemeContext';

type LoadStatus = 'loading' | 'error' | 'ready';

type Props = {
  status: LoadStatus;
  view: HomeRegretPatternView | null;
  account: Account;
  permission: NotificationPermissionKind | 'loading';
  elevation?: ViewStyle;
  onPress?: () => void;
};

const LIGHT = {
  accentBg: '#EAF5EE',
  accent: '#4D9270',
  text: '#253B32',
  muted: '#87958D',
  border: '#E8ECE8',
  soft: '#F4F8F5',
  warnBg: '#F8EFE4',
  warnText: '#9A6B32',
  coralBg: '#F8E4E1',
  coralText: '#C67A72',
};

function badgeColors(
  tone: PatternAlertBadgeTone,
  palette: { accent: string; accentBg: string; muted: string; border: string; soft: string; warnBg: string; warnText: string; coralBg: string; coralText: string },
) {
  if (tone === 'on') return { bg: palette.accentBg, text: palette.accent };
  if (tone === 'warn') return { bg: palette.warnBg, text: palette.warnText };
  if (tone === 'error') return { bg: palette.coralBg, text: palette.coralText };
  return { bg: palette.border, text: palette.muted };
}

export function HomeRegretPatternCard({
  status,
  view,
  account,
  permission,
  elevation,
  onPress,
}: Props) {
  const { colors, isDark } = useTheme();
  const alertsEnabled = resolveRegretPatternAlertEnabled(account);
  const slots: RegretPatternAlertSlot[] = alertsEnabled ? account.regretPatternAlertSlots ?? [] : [];
  const hasSlots = slots.length > 0;
  const hasPattern = Boolean(view?.hasPattern && view.summary);
  const badge = resolvePatternAlertBadge({
    patternStatus: status,
    permission,
    enabled: alertsEnabled,
    hasSlots,
  });
  const scheduledTimes =
    status === 'ready' && alertsEnabled && hasSlots ? formatRegretPatternScheduledTimes(slots) : [];

  const palette = isDark
    ? {
        surface: colors.surface,
        border: colors.border,
        accentBg: colors.surfaceMuted,
        accent: BRAND_GREEN,
        text: colors.text,
        muted: colors.textMuted,
        soft: colors.surfaceMuted,
        warnBg: colors.surfaceMuted,
        warnText: colors.textSec,
        coralBg: colors.surfaceMuted,
        coralText: colors.logoutText,
      }
    : {
        surface: colors.surface,
        border: LIGHT.border,
        accentBg: LIGHT.accentBg,
        accent: LIGHT.accent,
        text: LIGHT.text,
        muted: LIGHT.muted,
        soft: LIGHT.soft,
        warnBg: LIGHT.warnBg,
        warnText: LIGHT.warnText,
        coralBg: LIGHT.coralBg,
        coralText: LIGHT.coralText,
      };

  const headline =
    status === 'loading'
      ? '소비 패턴을 확인하고 있어요.'
      : status === 'error'
        ? '패턴을 불러오지 못했어요.'
        : hasPattern
          ? view!.summary!
          : '소비 리뷰가 쌓이면 패턴을 알려드려요.';

  const detail =
    status === 'loading' || status === 'error'
      ? null
      : hasPattern
        ? '반복되는 소비 패턴을 발견했어요.'
        : '반복되는 후회 시간대를 분석하고 있어요.';

  const a11y = ['후회 예방 알림', badge.label, headline, detail, ...scheduledTimes, '알림 설정 열기']
    .filter(Boolean)
    .join(', ');
  const chip = badgeColors(badge.tone, palette);

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: palette.surface, borderColor: palette.border },
        elevation,
        pressed && onPress ? styles.pressed : null,
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.iconWrap, { backgroundColor: palette.accentBg }]}>
          <MaterialIcons
            name={alertsEnabled ? 'notifications-active' : 'schedule'}
            size={18}
            color={palette.accent}
          />
        </View>
        <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>
          후회 예방 알림
        </Text>
        <View style={[styles.badge, { backgroundColor: chip.bg }]}>
          <Text style={[styles.badgeText, { color: chip.text }]}>{badge.label}</Text>
        </View>
        <MaterialIcons name="chevron-right" size={20} color={palette.muted} />
      </View>

      <Text style={[styles.headline, { color: palette.text }]}>{headline}</Text>
      {detail ? <Text style={[styles.detail, { color: palette.muted }]}>{detail}</Text> : null}

      {scheduledTimes.length > 0 ? (
        <View style={[styles.timeBox, { backgroundColor: palette.soft }]}>
          <Text style={[styles.timeLabel, { color: palette.muted }]}>예방 알림</Text>
          <View style={styles.timeValues}>
            {scheduledTimes.map((line) => (
              <Text key={line} style={[styles.timeValue, { color: palette.text }]}>
                {line}
              </Text>
            ))}
          </View>
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 8,
  },
  pressed: { opacity: 0.88 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { flex: 1, minWidth: 0, fontSize: 14, fontWeight: '800', letterSpacing: -0.2 },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    flexShrink: 0,
  },
  badgeText: { fontSize: 11, fontWeight: '800' },
  headline: { fontSize: 16, fontWeight: '800', lineHeight: 22, letterSpacing: -0.3 },
  detail: { fontSize: 13, fontWeight: '600', lineHeight: 18, marginTop: -2 },
  timeBox: {
    marginTop: 4,
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  timeLabel: { fontSize: 12, fontWeight: '700', flexShrink: 0 },
  timeValues: { flex: 1, minWidth: 0, gap: 2 },
  timeValue: { fontSize: 13, fontWeight: '800', lineHeight: 18, textAlign: 'right' },
});
