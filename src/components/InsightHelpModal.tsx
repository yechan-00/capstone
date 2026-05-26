import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { InsightHelpContent } from '@/lib/insightCardHelp';
import { useTheme } from '@/theme/ThemeContext';

export function InsightHelpModal({
  visible,
  content,
  onClose,
}: {
  visible: boolean;
  content: InsightHelpContent | null;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
        sheet: {
          backgroundColor: colors.surface,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          maxHeight: '78%',
          paddingBottom: insets.bottom + 12,
        },
        header: {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 14,
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.border,
        },
        title: { flex: 1, fontSize: 17, fontWeight: '900', color: colors.text, paddingRight: 12 },
        close: { fontSize: 14, fontWeight: '800', color: colors.accentBlue },
        body: { paddingHorizontal: 16, paddingTop: 16, gap: 16, paddingBottom: 8 },
        section: { gap: 6 },
        sectionTitle: { fontSize: 14, fontWeight: '900', color: colors.text },
        sectionBody: { fontSize: 14, fontWeight: '600', color: colors.textSec, lineHeight: 22 },
      }),
    [colors, insets.bottom],
  );

  if (!visible || !content) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="닫기" />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.title}>{content.cardTitle}</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.close}>닫기</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {content.sections.map((section) => (
              <View key={section.title} style={styles.section}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                <Text style={styles.sectionBody}>{section.body}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}
