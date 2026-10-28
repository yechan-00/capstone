import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import type { GuestComment } from '@/lib/types';
import { useExpenseDetailPalette } from '@/theme/expenseDetailTheme';
import { CommentItem } from '@/components/expenseDetail/CommentItem';

type Props = {
  isShared: boolean;
  loading: boolean;
  comments: GuestComment[];
  sharing?: boolean;
  onShare?: () => void;
};

export function ExpenseCommentSection({
  isShared,
  loading,
  comments,
  sharing,
  onShare,
}: Props) {
  const p = useExpenseDetailPalette();
  const showComments = isShared && !loading && comments.length > 0;

  return (
    <View style={styles.wrap}>
      <Text style={[styles.sectionTitle, { color: p.text }]}>공유와 댓글</Text>

      <View style={[styles.card, { backgroundColor: p.surface, borderColor: p.border }]}>
        {showComments ? (
          <View
            style={styles.introRow}
            accessible
            accessibilityLabel={`친구의 의견이 도착했어요. 댓글 ${comments.length}개`}
          >
            <View style={[styles.iconCircle, { backgroundColor: p.mintFill }]}>
              <MaterialIcons name="chat-bubble-outline" size={18} color={p.mintText} />
            </View>
            <View style={styles.introText}>
              <Text style={[styles.title, { color: p.text }]}>친구의 의견이 도착했어요</Text>
              <Text style={[styles.hint, { color: p.textMuted }]}>댓글 {comments.length}개</Text>
            </View>
          </View>
        ) : (
          <View style={styles.introRow} accessible accessibilityLabel="친구의 생각도 들어볼까요? 공유하고 의견을 받아보세요.">
            <View style={[styles.iconCircle, { backgroundColor: p.mintFill }]}>
              <MaterialIcons name="chat-bubble-outline" size={18} color={p.mintText} />
            </View>
            <View style={styles.introText}>
              <Text style={[styles.title, { color: p.text }]}>친구의 생각도 들어볼까요?</Text>
              <Text style={[styles.hint, { color: p.textMuted }]}>공유하고 의견을 받아보세요.</Text>
            </View>
          </View>
        )}

        {isShared && loading ? (
          <ActivityIndicator color={p.primary} style={styles.loading} />
        ) : null}

        {showComments ? (
          <View style={styles.list}>
            {comments.map((comment) => (
              <CommentItem key={comment.id} comment={comment} />
            ))}
          </View>
        ) : null}

        {onShare ? (
          <Pressable
            onPress={onShare}
            disabled={sharing}
            style={({ pressed }) => [
              styles.shareBtn,
              { backgroundColor: p.mintFill, opacity: pressed || sharing ? 0.72 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="이 소비의 공유 링크 열기"
          >
            {sharing ? (
              <ActivityIndicator size="small" color={p.mintText} />
            ) : (
              <>
                <Text style={[styles.shareBtnText, { color: p.mintText }]}>링크 공유하기</Text>
                <MaterialIcons name="north-east" size={15} color={p.mintText} />
              </>
            )}
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 28, gap: 10 },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
  },
  introRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  introText: { flex: 1, minWidth: 0, gap: 2 },
  title: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.2,
    lineHeight: 21,
  },
  hint: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  loading: { alignSelf: 'flex-start' },
  list: { gap: 14 },
  shareBtn: {
    minHeight: 42,
    paddingHorizontal: 14,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  shareBtnText: {
    fontSize: 14,
    fontWeight: '700',
  },
});
