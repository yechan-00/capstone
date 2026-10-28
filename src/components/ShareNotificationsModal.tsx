import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import { useRouter } from 'expo-router';
import { useTheme } from '@/theme/ThemeContext';
import type { UserNotification } from '@/lib/types';
import { userNotificationService } from '@/services/userNotificationService';

type Props = {
  visible: boolean;
  userId: string | null;
  onClose: () => void;
  onUnreadChange?: (count: number) => void;
};

export function ShareNotificationsModal({ visible, userId, onClose, onUnreadChange }: Props) {
  const router = useRouter();
  const { colors } = useTheme();
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<UserNotification[]>([]);
  const onUnreadChangeRef = useRef(onUnreadChange);
  onUnreadChangeRef.current = onUnreadChange;

  const load = useCallback(async () => {
    if (!userId) {
      setItems([]);
      onUnreadChangeRef.current?.(0);
      return;
    }
    setLoading(true);
    try {
      const list = await userNotificationService.listForUser(userId);
      setItems(list);
      onUnreadChangeRef.current?.(list.filter((n) => !n.read).length);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (visible) void load();
  }, [visible, load]);

  const handlePress = async (item: UserNotification) => {
    if (!item.read) {
      await userNotificationService.markRead(item.id);
      setItems((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, read: true } : n)),
      );
      onUnreadChange?.(items.filter((n) => n.id !== item.id && !n.read).length);
    }
    onClose();
    if (item.expenseId) {
      router.push(`/expense/${item.expenseId}`);
    }
  };

  const handleMarkAllRead = async () => {
    if (!userId) return;
    await userNotificationService.markAllRead(userId);
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
    onUnreadChange?.(0);
  };

  const styles = useMemo(
    () =>
      StyleSheet.create({
        backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
        sheet: {
          maxHeight: '78%',
          backgroundColor: colors.surface,
          borderTopLeftRadius: 20,
          borderTopRightRadius: 20,
          paddingBottom: 24,
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingTop: 18,
          paddingBottom: 12,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        title: { fontSize: 17, fontWeight: '800', color: colors.text },
        markAll: { fontSize: 13, fontWeight: '700', color: colors.accentCta },
        empty: {
          padding: 40,
          alignItems: 'center',
          gap: 8,
        },
        emptyText: { fontSize: 14, fontWeight: '600', color: colors.textMuted, textAlign: 'center' },
        row: {
          flexDirection: 'row',
          alignItems: 'flex-start',
          gap: 12,
          paddingHorizontal: 20,
          paddingVertical: 14,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        rowUnread: { backgroundColor: `${colors.accentCta}08` },
        dot: {
          width: 8,
          height: 8,
          borderRadius: 4,
          backgroundColor: colors.accentCta,
          marginTop: 6,
        },
        dotRead: { backgroundColor: 'transparent' },
        body: { flex: 1, gap: 4 },
        rowTitle: { fontSize: 14, fontWeight: '800', color: colors.text },
        rowPreview: { fontSize: 13, lineHeight: 19, fontWeight: '500', color: colors.textSec },
        rowMeta: { fontSize: 11, fontWeight: '600', color: colors.textMuted },
        closeBtn: {
          marginHorizontal: 20,
          marginTop: 12,
          paddingVertical: 14,
          borderRadius: 14,
          backgroundColor: colors.border,
          alignItems: 'center',
        },
        closeBtnText: { fontSize: 15, fontWeight: '800', color: colors.text },
      }),
    [colors],
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>공유 알림</Text>
            {items.some((n) => !n.read) ? (
              <TouchableOpacity onPress={() => void handleMarkAllRead()}>
                <Text style={styles.markAll}>모두 읽음</Text>
              </TouchableOpacity>
            ) : (
              <View style={{ width: 56 }} />
            )}
          </View>

          {loading ? (
            <ActivityIndicator style={{ marginTop: 32 }} color={colors.accentCta} />
          ) : items.length === 0 ? (
            <View style={styles.empty}>
              <MaterialIcons name="forum" size={32} color={colors.textMuted} />
              <Text style={styles.emptyText}>아직 공유 코멘트 알림이 없어요.</Text>
            </View>
          ) : (
            <FlatList
              data={items}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.row, !item.read && styles.rowUnread]}
                  onPress={() => void handlePress(item)}
                  activeOpacity={0.85}
                >
                  <View style={[styles.dot, item.read && styles.dotRead]} />
                  <View style={styles.body}>
                    <Text style={styles.rowTitle}>
                      {item.guestName}님의 코멘트
                      {item.shareTitle ? ` · ${item.shareTitle}` : ''}
                    </Text>
                    <Text style={styles.rowPreview} numberOfLines={2}>
                      {item.bodyPreview}
                    </Text>
                    <Text style={styles.rowMeta}>
                      {formatDistanceToNow(item.createdAt, { addSuffix: true, locale: ko })}
                    </Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
                </TouchableOpacity>
              )}
            />
          )}

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeBtnText}>닫기</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
