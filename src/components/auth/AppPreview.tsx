import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeContext';

export function AppPreview() {
  const { colors } = useTheme();

  return (
    <View style={styles.shell}>
      <View style={[styles.phone, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={[styles.notch, { backgroundColor: colors.surfaceMuted }]} />
        <View style={styles.screen}>
          <Text style={[styles.screenTitle, { color: colors.text }]}>이번 달 요약</Text>
          <View style={[styles.statCard, { backgroundColor: colors.surfaceMuted }]}>
            <Text style={[styles.statLabel, { color: colors.textSec }]}>후회율</Text>
            <Text style={[styles.statValue, { color: colors.accentCta }]}>13%</Text>
            <Text style={[styles.statHint, { color: colors.textMuted }]}>지난달보다 4%p ↓</Text>
          </View>
          <View style={[styles.rowCard, { backgroundColor: colors.surfaceMuted }]}>
            <MaterialIcons name="mood-bad" size={18} color={colors.logoutText} />
            <Text style={[styles.rowText, { color: colors.text }]}>스트레스 소비가 늘었어요</Text>
          </View>
          <View style={[styles.rowCard, { backgroundColor: colors.surfaceMuted }]}>
            <MaterialIcons name="delivery-dining" size={18} color={colors.success} />
            <Text style={[styles.rowText, { color: colors.text }]}>이번 주 배달은 줄었어요</Text>
          </View>
          <View style={[styles.miniCalendar, { borderColor: colors.border }]}>
            {['월', '화', '수', '목', '금'].map((d, i) => (
              <View
                key={d}
                style={[
                  styles.dot,
                  {
                    backgroundColor: i === 2 ? colors.accentCta : colors.catPill,
                    opacity: i === 2 ? 1 : 0.55,
                  },
                ]}
              />
            ))}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: { alignItems: 'center', paddingVertical: 8 },
  phone: {
    width: 240,
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 10,
    shadowColor: '#1a2d4a',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 8,
  },
  notch: {
    alignSelf: 'center',
    width: 72,
    height: 6,
    borderRadius: 999,
    marginBottom: 12,
  },
  screen: { gap: 10, paddingHorizontal: 4, paddingBottom: 8 },
  screenTitle: { fontSize: 16, fontWeight: '800', marginBottom: 2 },
  statCard: { borderRadius: 14, padding: 14, gap: 2 },
  statLabel: { fontSize: 12, fontWeight: '600' },
  statValue: { fontSize: 28, fontWeight: '900' },
  statHint: { fontSize: 12, fontWeight: '600' },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  rowText: { fontSize: 12, fontWeight: '600', flex: 1 },
  miniCalendar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  dot: { width: 28, height: 28, borderRadius: 8 },
});
