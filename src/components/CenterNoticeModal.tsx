import React from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

const NAVY = '#1B2D5B';

type Props = {
  visible: boolean;
  message: string;
  title?: string;
  onClose: () => void;
};

/** 로그인·회원가입 등 — 화면 중앙 알림 팝업 */
export function CenterNoticeModal({ visible, message, title, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {title ? <Text style={styles.title}>{title}</Text> : null}
          <Text style={[styles.message, !title && styles.messageOnly]}>{message}</Text>
          <Pressable
            style={({ pressed }) => [styles.btn, pressed && { opacity: 0.88 }]}
            onPress={onClose}
          >
            <Text style={styles.btnText}>확인</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: '#fff',
    borderRadius: 18,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 18,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 24,
    elevation: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    color: NAVY,
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    fontSize: 15,
    fontWeight: '600',
    color: '#374151',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 20,
  },
  messageOnly: {
    fontSize: 16,
    fontWeight: '700',
    color: NAVY,
    marginBottom: 22,
  },
  btn: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    backgroundColor: NAVY,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
});
