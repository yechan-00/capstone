import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { resolveRegretPatternAlertEnabled } from '@/lib/accountSettings';
import {
  REGRET_PATTERN_ALERT_LEAD_MINUTES,
  formatRegretPatternClock,
  type HomeRegretPatternView,
} from '@/lib/regretPatternAlert';
import {
  resolvePatternAlertBadge,
  sheetStatusGuide,
  type PatternAlertBadgeTone,
} from '@/lib/regretPatternAlertStatus';
import { TIME_OF_DAY_LABELS, TIME_OF_DAY_RANGES, weekdayLabel } from '@/lib/timePatternInsight';
import type { Account, RegretPatternAlertSlot } from '@/lib/types';
import { useAuth } from '@/hooks/useAuth';
import { disableRegretPatternAlerts } from '@/services/regretPatternAlertService';
import {
  ensureNotificationPermission,
  getNotificationPermissionKind,
  type NotificationPermissionKind,
} from '@/services/notificationService';
import { BRAND_GREEN, useTheme } from '@/theme/ThemeContext';

type Props = {
  visible: boolean;
  onClose: () => void;
  account: Account;
  view: HomeRegretPatternView | null;
  patternStatus: 'loading' | 'error' | 'ready';
  permission: NotificationPermissionKind | 'loading';
  onPermissionRefresh: () => void;
};

const LIGHT = {
  text: '#253B32',
  muted: '#82918A',
  accent: '#4D9270',
  mint: '#EAF5EE',
  border: '#E8ECE8',
  warnText: '#9A6B32',
};

function slotTitle(slot: RegretPatternAlertSlot): string {
  if (slot.kind === 'weekday' && slot.weekday != null) {
    return `${weekdayLabel(slot.weekday)}요일`;
  }
  if (slot.kind === 'time' && slot.timeOfDay) {
    return `${TIME_OF_DAY_LABELS[slot.timeOfDay]} (${TIME_OF_DAY_RANGES[slot.timeOfDay]})`;
  }
  return slot.label;
}

function slotKindLabel(slot: RegretPatternAlertSlot): string {
  return slot.kind === 'weekday' ? '요일 패턴' : '시간대 패턴';
}

function hasAvgPurchase(slot: RegretPatternAlertSlot): boolean {
  return typeof slot.avgPurchaseHour === 'number' && typeof slot.avgPurchaseMinute === 'number';
}

function statusToneBg(
  tone: PatternAlertBadgeTone,
  palette: { mint: string; border: string; warnBg: string },
): string {
  if (tone === 'on') return palette.mint;
  if (tone === 'warn') return palette.warnBg;
  return palette.border;
}

function statusToneText(
  tone: PatternAlertBadgeTone,
  palette: { accent: string; muted: string; warnText: string },
): string {
  if (tone === 'on') return palette.accent;
  if (tone === 'warn') return palette.warnText;
  return palette.muted;
}

function statusIcon(tone: PatternAlertBadgeTone): React.ComponentProps<typeof MaterialIcons>['name'] {
  if (tone === 'on') return 'check-circle';
  if (tone === 'warn') return 'error-outline';
  if (tone === 'off') return 'notifications-off';
  return 'hourglass-empty';
}

function PatternSlotCard({
  slot,
  palette,
}: {
  slot: RegretPatternAlertSlot;
  palette: { text: string; muted: string; accent: string; mint: string; border: string };
}) {
  const lead = slot.leadMinutes ?? REGRET_PATTERN_ALERT_LEAD_MINUTES;
  return (
    <View style={[styles.slotCard, { borderColor: palette.border }]}>
      <View style={styles.slotHead}>
        <View style={[styles.slotIcon, { backgroundColor: palette.mint }]}>
          <MaterialIcons
            name={slot.kind === 'weekday' ? 'calendar-today' : 'schedule'}
            size={14}
            color={palette.accent}
          />
        </View>
        <View style={styles.slotHeadCopy}>
          <Text style={[styles.slotKind, { color: palette.muted }]}>{slotKindLabel(slot)}</Text>
          <Text style={[styles.slotTitle, { color: palette.text }]}>{slotTitle(slot)}</Text>
        </View>
      </View>

      <View style={[styles.slotDivider, { backgroundColor: palette.border }]} />

      <View style={styles.slotTimes}>
        {hasAvgPurchase(slot) ? (
          <View style={styles.slotRow}>
            <Text style={[styles.slotKey, { color: palette.muted }]}>예상 구매 시간</Text>
            <Text style={[styles.slotTime, { color: palette.text }]}>
              {formatRegretPatternClock(slot.avgPurchaseHour!, slot.avgPurchaseMinute!)}
            </Text>
          </View>
        ) : null}
        <View style={styles.slotRow}>
          <Text style={[styles.slotKey, { color: palette.muted }]}>예방 알림 시간</Text>
          <Text style={[styles.slotTime, { color: palette.accent }]}>
            {formatRegretPatternClock(slot.hour, slot.minute)}
          </Text>
        </View>
      </View>
      <Text style={[styles.slotLead, { color: palette.muted }]}>구매 예상 시간 {lead}분 전</Text>
    </View>
  );
}

export function HomeRegretPatternAlertSheet({
  visible,
  onClose,
  account,
  view,
  patternStatus,
  permission,
  onPermissionRefresh,
}: Props) {
  const insets = useSafeAreaInsets();
  const { colors, isDark } = useTheme();
  const { updateRegretPatternAlertSettings } = useAuth();
  const savedEnabled = resolveRegretPatternAlertEnabled(account);
  const [draftEnabled, setDraftEnabled] = useState(savedEnabled);
  const [saving, setSaving] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);

  const slots = account.regretPatternAlertSlots ?? [];
  const hasSlots = slots.length > 0;
  const badge = resolvePatternAlertBadge({
    patternStatus,
    permission,
    enabled: savedEnabled,
    hasSlots,
  });

  useEffect(() => {
    if (!visible) return;
    setDraftEnabled(savedEnabled);
    setSaving(false);
    setErrorText(null);
  }, [visible, savedEnabled]);

  const palette = isDark
    ? {
        surface: colors.surface,
        text: colors.text,
        muted: colors.textMuted,
        accent: BRAND_GREEN,
        mint: colors.surfaceMuted,
        border: colors.border,
        warnBg: colors.surfaceMuted,
        warnText: colors.textSec,
        track: colors.border,
      }
    : {
        surface: colors.surface,
        text: LIGHT.text,
        muted: LIGHT.muted,
        accent: LIGHT.accent,
        mint: LIGHT.mint,
        border: LIGHT.border,
        warnBg: '#F8EFE4',
        warnText: LIGHT.warnText,
        track: LIGHT.border,
      };

  const dirty = draftEnabled !== savedEnabled;
  const guide = sheetStatusGuide({ dirty, draftEnabled, badge });
  const canClose = !saving;

  const handleClose = () => {
    if (!canClose) return;
    onClose();
  };

  const handleSave = async () => {
    if (saving) return;
    if (!dirty) {
      onClose();
      return;
    }

    setErrorText(null);

    if (draftEnabled && Platform.OS !== 'web') {
      const current = await getNotificationPermissionKind();
      if (current === 'denied') {
        setErrorText('알림 권한이 꺼져 있어요. 설정에서 허용한 뒤 다시 저장해 주세요.');
        onPermissionRefresh();
        return;
      }
      if (current !== 'granted') {
        const granted = await ensureNotificationPermission();
        onPermissionRefresh();
        if (!granted) {
          setErrorText('알림 권한이 필요해요. 허용하지 않으면 예방 알림을 켜 둘 수 없어요.');
          return;
        }
      }
    }

    setSaving(true);
    try {
      if (draftEnabled) {
        await updateRegretPatternAlertSettings(true);
      } else {
        await updateRegretPatternAlertSettings(false);
        if (account.id) await disableRegretPatternAlerts(account.id);
      }
      onPermissionRefresh();
      onClose();
    } catch {
      setErrorText('설정을 저장하지 못했어요. 다시 시도해 주세요.');
    } finally {
      setSaving(false);
    }
  };

  const showPermissionHelp =
    draftEnabled && (permission === 'denied' || permission === 'undetermined') && Platform.OS !== 'web';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable
        style={styles.backdrop}
        onPress={handleClose}
        accessibilityLabel="닫기"
        disabled={!canClose}
      />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: palette.surface,
            paddingBottom: Math.max(insets.bottom, 12),
          },
        ]}
      >
        <View style={[styles.handle, { backgroundColor: palette.border }]} />

        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={[styles.title, { color: palette.text }]}>후회 예방 알림</Text>
            <Text style={[styles.subtitle, { color: palette.muted }]}>
              소비 패턴을 분석해 후회를 줄일 수 있도록 미리 알려드려요.
            </Text>
          </View>
          <Pressable
            onPress={handleClose}
            disabled={!canClose}
            hitSlop={10}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel="닫기"
          >
            <MaterialIcons name="close" size={20} color={palette.muted} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.toggleCard, { borderColor: palette.border }]}>
            <View style={[styles.iconCircle, { backgroundColor: palette.mint }]}>
              <MaterialIcons name="notifications" size={16} color={palette.accent} />
            </View>
            <View style={styles.toggleCopy}>
              <Text style={[styles.toggleTitle, { color: palette.text }]}>알림 사용</Text>
              <Text style={[styles.toggleHint, { color: palette.muted }]}>
                소비 전 자동으로 알려드려요.
              </Text>
            </View>
            <Switch
              value={draftEnabled}
              onValueChange={setDraftEnabled}
              disabled={saving}
              trackColor={{ false: palette.track, true: palette.accent }}
              thumbColor="#FFFFFF"
              ios_backgroundColor={palette.track}
              accessibilityLabel="알림 사용"
            />
          </View>

          <View style={[styles.statusCard, { backgroundColor: statusToneBg(guide.tone, palette) }]}>
            <MaterialIcons
              name={statusIcon(guide.tone)}
              size={16}
              color={statusToneText(guide.tone, palette)}
              style={styles.statusIcon}
            />
            <View style={styles.statusCopy}>
              <Text style={[styles.statusTitle, { color: statusToneText(guide.tone, palette) }]}>
                {guide.title}
              </Text>
              {guide.body ? (
                <Text style={[styles.statusBody, { color: palette.muted }]}>{guide.body}</Text>
              ) : null}
            </View>
          </View>

          {showPermissionHelp ? (
            <View style={[styles.warnBox, { backgroundColor: palette.warnBg }]}>
              <Text style={[styles.warnText, { color: palette.warnText }]}>
                알림 권한이 없어 예방 알림을 표시하지 못할 수 있어요.
              </Text>
              {permission === 'denied' ? (
                <Pressable
                  onPress={() => void Linking.openSettings()}
                  accessibilityRole="button"
                  accessibilityLabel="시스템 설정 열기"
                >
                  <Text style={[styles.warnAction, { color: palette.accent }]}>시스템 설정 열기</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {hasSlots ? (
            slots.map((slot) => <PatternSlotCard key={slot.id} slot={slot} palette={palette} />)
          ) : (
            <View style={[styles.empty, { backgroundColor: palette.mint }]}>
              <MaterialIcons name="hourglass-empty" size={16} color={palette.muted} />
              <View style={styles.emptyCopy}>
                <Text style={[styles.emptyTitle, { color: palette.text }]}>
                  {view?.hasPattern
                    ? '저장된 알림 시간이 아직 없어요.'
                    : '아직 뚜렷한 후회 패턴이 없어요.'}
                </Text>
                <Text style={[styles.emptyBody, { color: palette.muted }]}>
                  소비와 리뷰가 쌓이면 알림 시간을 자동으로 찾아드릴게요.
                </Text>
              </View>
            </View>
          )}

          {hasSlots ? (
            <View style={styles.autoHintRow}>
              <MaterialIcons name="info-outline" size={14} color={palette.muted} />
              <Text style={[styles.autoHint, { color: palette.muted }]}>
                소비 패턴에 따라 알림 시간이 자동으로 조정돼요.
              </Text>
            </View>
          ) : null}

          {errorText ? (
            <Text style={[styles.error, { color: colors.logoutText }]}>{errorText}</Text>
          ) : null}
        </ScrollView>

        <Pressable
          onPress={() => void handleSave()}
          disabled={saving}
          accessibilityRole="button"
          accessibilityLabel={saving ? '저장 중' : '저장'}
          style={({ pressed }) => [
            styles.saveBtn,
            { backgroundColor: BRAND_GREEN, opacity: saving ? 0.5 : pressed ? 0.85 : 1 },
          ]}
        >
          {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : null}
          <Text style={styles.saveLabel}>{saving ? '저장 중...' : '저장'}</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '78%',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 16,
    paddingTop: 6,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 14,
  },
  headerCopy: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { fontSize: 12, fontWeight: '600', lineHeight: 17 },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: { flexGrow: 0 },
  scrollContent: { gap: 10, paddingBottom: 14 },
  toggleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  iconCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  toggleCopy: { flex: 1, minWidth: 0, gap: 1 },
  toggleTitle: { fontSize: 15, fontWeight: '800' },
  toggleHint: { fontSize: 12, fontWeight: '600' },
  statusCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 14,
    gap: 8,
  },
  statusIcon: { marginTop: 1 },
  statusCopy: { flex: 1, minWidth: 0, gap: 2 },
  statusTitle: { fontSize: 13, fontWeight: '800' },
  statusBody: { fontSize: 12, fontWeight: '600', lineHeight: 16 },
  warnBox: {
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 6,
  },
  warnText: { fontSize: 12, fontWeight: '600', lineHeight: 17 },
  warnAction: { fontSize: 13, fontWeight: '800' },
  slotCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  slotHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  slotIcon: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotHeadCopy: { flex: 1, minWidth: 0, gap: 1 },
  slotKind: { fontSize: 11, fontWeight: '700' },
  slotTitle: { fontSize: 16, fontWeight: '800', letterSpacing: -0.2 },
  slotDivider: {
    height: StyleSheet.hairlineWidth,
    marginTop: 10,
    marginBottom: 8,
  },
  slotTimes: { gap: 6 },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 22,
  },
  slotKey: { flex: 1, minWidth: 0, fontSize: 12, fontWeight: '600' },
  slotTime: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
    letterSpacing: -0.2,
    textAlign: 'right',
    flexShrink: 0,
    minWidth: 86,
    fontVariant: ['tabular-nums'],
  },
  slotLead: {
    marginTop: 6,
    textAlign: 'right',
    fontSize: 11,
    fontWeight: '600',
  },
  empty: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 8,
  },
  emptyCopy: { flex: 1, minWidth: 0, gap: 3 },
  emptyTitle: { fontSize: 13, fontWeight: '800' },
  emptyBody: { fontSize: 12, fontWeight: '600', lineHeight: 17 },
  autoHintRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    paddingHorizontal: 2,
  },
  autoHint: { flex: 1, fontSize: 12, fontWeight: '600', lineHeight: 16 },
  error: { fontSize: 13, fontWeight: '700', lineHeight: 18 },
  saveBtn: {
    height: 48,
    borderRadius: 14,
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  saveLabel: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
});
