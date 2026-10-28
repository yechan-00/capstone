import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useExpenseDetailPalette } from '@/theme/expenseDetailTheme';

type Props = {
  onBack: () => void;
  onShare: () => void;
  sharing: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  /** 본문 제목·금액이 스크롤로 가려졌을 때 가운데에 표시 */
  compactTitle?: string;
  compactAmountLabel?: string;
  compactVisible?: boolean;
};

export function ExpenseDetailHeader({
  onBack,
  onShare,
  sharing,
  onEdit,
  onDelete,
  compactTitle,
  compactAmountLabel,
  compactVisible = false,
}: Props) {
  const p = useExpenseDetailPalette();
  const insets = useSafeAreaInsets();
  const [menuOpen, setMenuOpen] = useState(false);
  const canManage = Boolean(onEdit || onDelete);
  const compactOpacity = useRef(new Animated.Value(compactVisible ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(compactOpacity, {
      toValue: compactVisible ? 1 : 0,
      duration: 160,
      useNativeDriver: true,
    }).start();
  }, [compactOpacity, compactVisible]);

  return (
    <View style={styles.row}>
      <Pressable
        onPress={onBack}
        style={({ pressed }) => [styles.iconBtn, { backgroundColor: p.iconBtnBg, opacity: pressed ? 0.88 : 1 }]}
        accessibilityRole="button"
        accessibilityLabel="뒤로"
      >
        <MaterialIcons name="arrow-back" size={20} color={p.text} />
      </Pressable>

      <Animated.View
        style={[styles.compact, { opacity: compactOpacity }]}
        pointerEvents="none"
        accessibilityElementsHidden={!compactVisible}
        importantForAccessibility={compactVisible ? 'auto' : 'no-hide-descendants'}
      >
        {compactTitle ? (
          <>
            <Text style={[styles.compactTitle, { color: p.text }]} numberOfLines={1}>
              {compactTitle}
            </Text>
            {compactAmountLabel ? (
              <Text style={[styles.compactAmount, { color: p.text }]} numberOfLines={1}>
                {` · ${compactAmountLabel}`}
              </Text>
            ) : null}
          </>
        ) : null}
      </Animated.View>

      <View style={styles.right}>
        <Pressable
          onPress={onShare}
          disabled={sharing}
          style={({ pressed }) => [styles.iconBtn, { backgroundColor: p.iconBtnBg, opacity: pressed || sharing ? 0.72 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel="공유"
        >
          {sharing ? (
            <ActivityIndicator size="small" color={p.mintText} />
          ) : (
            <MaterialIcons name="share" size={18} color={p.text} />
          )}
        </Pressable>

        {canManage ? (
          <Pressable
            onPress={() => setMenuOpen(true)}
            style={({ pressed }) => [styles.iconBtn, { backgroundColor: p.iconBtnBg, opacity: pressed ? 0.88 : 1 }]}
            accessibilityRole="button"
            accessibilityLabel="더보기"
          >
            <MaterialIcons name="more-horiz" size={20} color={p.text} />
          </Pressable>
        ) : null}
      </View>

      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <View style={styles.menuRoot}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setMenuOpen(false)} />
          <View
            style={[
              styles.menuCard,
              {
                backgroundColor: p.surface,
                borderColor: p.border,
                marginBottom: Math.max(insets.bottom, 8),
              },
            ]}
          >
            {onEdit ? (
              <Pressable
                onPress={() => {
                  setMenuOpen(false);
                  onEdit();
                }}
                style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.88 : 1 }]}
                accessibilityRole="button"
                accessibilityLabel="수정"
              >
                <Text style={[styles.menuText, { color: p.text }]}>수정</Text>
              </Pressable>
            ) : null}
            {onDelete ? (
              <Pressable
                onPress={() => {
                  setMenuOpen(false);
                  onDelete();
                }}
                style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.88 : 1 }]}
                accessibilityRole="button"
                accessibilityLabel="삭제"
              >
                <Text style={[styles.menuText, { color: p.logoutText }]}>삭제</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={() => setMenuOpen(false)}
              style={({ pressed }) => [styles.menuRow, { opacity: pressed ? 0.88 : 1 }]}
              accessibilityRole="button"
              accessibilityLabel="취소"
            >
              <Text style={[styles.menuText, { color: p.textMuted }]}>취소</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  compact: {
    flex: 1,
    minWidth: 0,
    marginHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  /** 제목만 말줄임하고 금액은 줄이지 않습니다. */
  compactTitle: {
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  compactAmount: {
    flexShrink: 0,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(15, 18, 16, 0.32)',
    padding: 16,
  },
  menuCard: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    alignSelf: 'center',
    width: '100%',
    maxWidth: 420,
  },
  menuRow: {
    minHeight: 48,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  menuText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});
