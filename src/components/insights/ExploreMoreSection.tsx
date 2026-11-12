import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useInsightsPalette } from '@/theme/insightsTheme';

type RowProps = {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  title: string;
  description: string;
  onPress: () => void;
};

export function ExploreMoreRow({ icon, title, description, onPress }: RowProps) {
  const t = useInsightsPalette();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: t.surface, borderColor: t.border },
        pressed && styles.rowPressed,
      ]}
      accessibilityRole="button"
    >
      <View style={[styles.iconWrap, { backgroundColor: t.mintSoft }]}>
        <MaterialIcons name={icon} size={20} color={t.primaryDeep} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: t.text }]}>{title}</Text>
        <Text style={[styles.description, { color: t.textMuted }]}>{description}</Text>
      </View>
      <MaterialIcons name="chevron-right" size={20} color={t.textMuted} />
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
    borderRadius: 18,
    borderWidth: 1,
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
  },
  description: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
  },
});
