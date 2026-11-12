import React from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SpentAtDateTimePickers, type SpentAtPickerPhase } from '@/components/SpentAtDateTimePickers';
import { useTheme } from '@/theme/ThemeContext';

type Props = {
  visible: boolean;
  phase: SpentAtPickerPhase;
  value: Date;
  accent: string;
  onChange: (next: Date) => void;
  onCancel: () => void;
  onConfirm: () => void;
};

export function SpaceEventPickerSheet({
  visible,
  phase,
  value,
  accent,
  onChange,
  onCancel,
  onConfirm,
}: Props) {
  const { colors, isDark } = useTheme();
  if (!visible || Platform.OS === 'web') return null;

  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onCancel}>
      <View style={styles.wrap}>
        <Pressable style={styles.backdrop} onPress={onCancel} accessibilityLabel="닫기" />
        <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            <Pressable onPress={onCancel}>
              <Text style={[styles.cancel, { color: colors.textMuted }]}>취소</Text>
            </Pressable>
            <Text style={[styles.title, { color: colors.text }]}>
              {phase === 'date' ? '날짜 선택' : '시간 선택'}
            </Text>
            <Pressable onPress={onConfirm}>
              <Text style={[styles.confirm, { color: accent }]}>완료</Text>
            </Pressable>
          </View>
          <View style={styles.body}>
            <SpentAtDateTimePickers
              phase={phase}
              value={value}
              onChange={onChange}
              textColor={colors.text}
              themeVariant={isDark ? 'dark' : 'light'}
              accentColor={accent}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: {
    fontSize: 15,
    fontWeight: '800',
  },
  cancel: {
    fontSize: 15,
    fontWeight: '600',
  },
  confirm: {
    fontSize: 15,
    fontWeight: '800',
  },
  body: {
    paddingBottom: 20,
  },
});
