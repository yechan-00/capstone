import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { INSIGHTS_THEME } from '@/theme/insightsTheme';

type RowProps = {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  title: string;
  description: string;
  onPress: () => void;
};

export function ExploreMoreRow({ icon, title, description, onPress }: RowProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      accessibilityRole="button"
    >
      <View style={styles.iconWrap}>
        <MaterialIcons name={icon} size={20} color={INSIGHTS_THEME.primaryDeep} />
      </View>
      <View style={styles.copy}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>
      <MaterialIcons name="chevron-right" size={20} color={INSIGHTS_THEME.textMuted} />
    </Pressable>
  );
}

export function ExploreMoreSection({ children }: { children: React.ReactNode }) {
  return <View style={styles.wrap}>{children}</View>;
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: INSIGHTS_THEME.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: INSIGHTS_THEME.border,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 68,
  },
  rowPressed: {
    opacity: 0.92,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: INSIGHTS_THEME.mintSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontSize: 15,
    fontWeight: '700',
    color: INSIGHTS_THEME.text,
  },
  description: {
    fontSize: 12,
    fontWeight: '500',
    color: INSIGHTS_THEME.textMuted,
    lineHeight: 16,
  },
});
