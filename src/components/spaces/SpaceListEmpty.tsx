import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';

export function SpaceListEmpty() {
  const { colors } = useTheme();

  return (
    <View style={styles.wrap}>
      <MaterialIcons name="people-outline" size={36} color={colors.emptyIcon} />
      <Text style={[styles.title, { color: colors.text }]}>아직 함께한 공간이 없어요</Text>
      <Text style={[styles.desc, { color: colors.textSec }]}>
        새 공간을 만들고 소중한 사람들과 기록을 시작해 보세요.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexGrow: 1,
    minHeight: 180,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingTop: 24,
    paddingBottom: 8,
  },
  title: {
    marginTop: 14,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: -0.2,
  },
  desc: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 20,
    textAlign: 'center',
  },
});
