import React, { useMemo } from 'react';
import { View, Text, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { useTheme } from '@/theme/ThemeContext';
import { SubScreenHeader } from '@/components/SubScreenHeader';
import { createSettingsFormStyles } from '@/components/settingsFormStyles';

type Props = {
  title: string;
  noticeTitle: string;
  noticeBody: string;
  children: React.ReactNode;
};

export function SettingsFormScreen({ title, noticeTitle, noticeBody, children }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => createSettingsFormStyles(colors), [colors]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <SubScreenHeader title={title} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.inner}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>{noticeTitle}</Text>
            <Text style={styles.noticeBody}>{noticeBody}</Text>
          </View>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}
