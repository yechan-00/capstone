import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatDistanceToNow } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { GuestComment } from '@/lib/types';
import { useExpenseDetailPalette } from '@/theme/expenseDetailTheme';

type Props = {
  comment: GuestComment;
};

export function CommentItem({ comment }: Props) {
  const p = useExpenseDetailPalette();
  const initial = (comment.guestName?.trim()?.[0] ?? '?').toUpperCase();
  const when = formatDistanceToNow(comment.createdAt, { addSuffix: true, locale: ko });

  return (
    <View style={styles.row}>
      <View style={[styles.avatar, { backgroundColor: p.mintFill }]}>
        <Text style={[styles.avatarText, { color: p.mintText }]}>{initial}</Text>
      </View>
      <View style={styles.body}>
        <View style={styles.metaRow}>
          <Text style={[styles.name, { color: p.text }]}>{comment.guestName}</Text>
          <Text style={[styles.time, { color: p.textMuted }]}>{when}</Text>
        </View>
        {comment.body?.trim() ? (
          <Text style={[styles.content, { color: p.textSec }]}>{comment.body.trim()}</Text>
        ) : comment.imageUrl ? (
          <Text style={[styles.content, { color: p.textMuted }]}>사진</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 14,
    fontWeight: '700',
  },
  body: { flex: 1, gap: 4 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  name: {
    fontSize: 14,
    fontWeight: '700',
  },
  time: {
    fontSize: 12,
    fontWeight: '500',
  },
  content: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '400',
  },
});
