import { StyleSheet } from 'react-native';
import type { ThemeColors } from '@/theme/ThemeContext';

export function createSettingsFormStyles(colors: ThemeColors) {
  return StyleSheet.create({
    scroll: { flex: 1, backgroundColor: colors.bg },
    inner: { padding: 16, paddingBottom: 40, gap: 16 },
    notice: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: 14,
      padding: 14,
      borderWidth: 1,
      borderColor: colors.border,
    },
    noticeTitle: { fontWeight: '900', color: colors.text, marginBottom: 6 },
    noticeBody: { color: colors.textSec, fontWeight: '600', lineHeight: 20 },
    label: { fontWeight: '800', color: colors.textSec, marginBottom: 6 },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: colors.text,
      backgroundColor: colors.inputBg,
      fontWeight: '600',
    },
    current: { color: colors.text, fontWeight: '700' },
  });
}
