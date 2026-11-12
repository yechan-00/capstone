import React, { useRef } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  cancelLabel?: string;
  confirmLabel?: string;
  showCancel?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function LoginRequiredModal({
  visible,
  title,
  message,
  cancelLabel = '취소',
  confirmLabel = '확인',
  showCancel = true,
  onCancel,
  onConfirm,
}: Props) {
  const { colors, isDark } = useTheme();
  const busyRef = useRef(false);

  const handleCancel = () => {
    if (busyRef.current) return;
    onCancel();
  };

  const handleConfirm = () => {
    if (busyRef.current) return;
    busyRef.current = true;
    onConfirm();
    requestAnimationFrame(() => {
      busyRef.current = false;
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleCancel}
    >
      <View
        style={[
          styles.backdrop,
          { backgroundColor: isDark ? 'rgba(0,0,0,0.62)' : 'rgba(15,23,20,0.45)' },
        ]}
      >
        <View
          style={[
            styles.card,
            {
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        >
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          <Text style={[styles.message, { color: colors.textSec }]}>{message}</Text>
          <View style={styles.actions}>
            {showCancel ? (
              <Pressable
                onPress={handleCancel}
                style={({ pressed }) => [
                  styles.btn,
                  styles.cancelBtn,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.surfaceMuted,
                    opacity: pressed ? 0.78 : 1,
                  },
                ]}
                accessibilityRole="button"
                accessibilityLabel={cancelLabel}
              >
                <Text style={[styles.btnText, { color: colors.text }]}>{cancelLabel}</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={handleConfirm}
              style={({ pressed }) => [
                styles.btn,
                {
                  backgroundColor: colors.primary,
                  opacity: pressed ? 0.78 : 1,
                },
                !showCancel && styles.btnSingle,
              ]}
              accessibilityRole="button"
              accessibilityLabel={confirmLabel}
            >
              <Text style={[styles.btnText, { color: colors.onPrimary }]}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 16,
  },
  title: {
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: -0.3,
    textAlign: 'center',
    marginBottom: 10,
  },
  message: {
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
  },
  btn: {
    flex: 1,
    minHeight: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  btnSingle: { flex: 1 },
  cancelBtn: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  btnText: {
    fontSize: 16,
    fontWeight: '800',
  },
});
