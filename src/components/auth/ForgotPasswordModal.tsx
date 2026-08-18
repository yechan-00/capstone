import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { validateEmail } from '@/utils/validation';

type Props = {
  visible: boolean;
  initialEmail?: string;
  sending: boolean;
  onClose: () => void;
  onSubmit: (email: string) => void;
};

export function ForgotPasswordModal({ visible, initialEmail = '', sending, onClose, onSubmit }: Props) {
  const { colors } = useTheme();
  const [email, setEmail] = useState(initialEmail);

  React.useEffect(() => {
    if (visible) setEmail(initialEmail);
  }, [visible, initialEmail]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>비밀번호 재설정</Text>
          <Text style={[styles.desc, { color: colors.textSec }]}>
            가입한 이메일을 입력하면 재설정 링크를 보내드립니다.
          </Text>
          <Text style={[styles.label, { color: colors.textSec }]} nativeID="reset-email-label">
            이메일
          </Text>
          <TextInput
            style={[
              styles.input,
              { color: colors.text, backgroundColor: colors.inputBg, borderColor: colors.borderInput },
            ]}
            placeholder="name@example.com"
            placeholderTextColor={colors.placeholder}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            autoComplete="email"
            editable={!sending}
            accessibilityLabel="비밀번호 재설정 이메일"
          />
          <View style={styles.actions}>
            <Pressable
              onPress={onClose}
              disabled={sending}
              style={[styles.cancelBtn, { borderColor: colors.border }]}
            >
              <Text style={[styles.cancelText, { color: colors.textSec }]}>취소</Text>
            </Pressable>
            <Pressable
              onPress={() => {
                if (!validateEmail(email)) return;
                onSubmit(email.trim());
              }}
              disabled={sending || !email.trim()}
              style={[
                styles.sendBtn,
                { backgroundColor: colors.accentCta, opacity: sending || !email.trim() ? 0.6 : 1 },
              ]}
            >
              {sending ? (
                <ActivityIndicator color={colors.onPrimary} />
              ) : (
                <Text style={[styles.sendText, { color: colors.onPrimary }]}>메일 보내기</Text>
              )}
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
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    padding: 24,
    borderWidth: StyleSheet.hairlineWidth,
  },
  title: { fontSize: 20, fontWeight: '900', marginBottom: 8 },
  desc: { fontSize: 14, lineHeight: 21, marginBottom: 18, fontWeight: '500' },
  label: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  input: {
    height: 52,
    borderRadius: 12,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    fontSize: 16,
    marginBottom: 18,
  },
  actions: { flexDirection: 'row', gap: 10 },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: { fontSize: 15, fontWeight: '700' },
  sendBtn: {
    flex: 1.2,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendText: { fontSize: 15, fontWeight: '800' },
});
