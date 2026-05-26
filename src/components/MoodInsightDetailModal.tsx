import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { MoodInsightDetail } from '@/lib/moodInsightDetail';
import { expenseCategoryLabel } from '@/lib/expenseCategoryLabel';
import { useTheme } from '@/theme/ThemeContext';
import { formatDate } from '@/utils/time';

function StatChip({ label, count }: { label: string; count: number }) {
  const { colors } = useTheme();
  return (
    <View style={[chipStyles.wrap, { backgroundColor: colors.surfaceMuted, borderColor: colors.border }]}>
      <Text style={[chipStyles.label, { color: colors.text }]} numberOfLines={1}>
        {label}
      </Text>
      <Text style={[chipStyles.count, { color: colors.textSec }]}>{count}건</Text>
    </View>
  );
}

const chipStyles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    minWidth: 72,
    gap: 2,
  },
  label: { fontSize: 12, fontWeight: '800' },
  count: { fontSize: 11, fontWeight: '700' },
});

function ExpenseMiniRow({
  item,
  onPress,
}: {
  item: MoodInsightDetail['expenses'][number];
  onPress: () => void;
}) {
  const { colors, isDark } = useTheme();
  const e = item.expense;
  const title = (e.item ?? e.content ?? e.reason ?? '소비').trim();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        rowStyles.wrap,
        {
          borderColor: colors.border,
          backgroundColor: item.isRegret ? (isDark ? '#3f1d24' : '#fff1f2') : colors.surface,
          opacity: pressed ? 0.88 : 1,
        },
      ]}
    >
      <View style={rowStyles.main}>
        <Text style={[rowStyles.title, { color: colors.text }]} numberOfLines={1}>
          {title}
        </Text>
        <Text style={[rowStyles.meta, { color: colors.textMuted }]}>
          {formatDate(e.spentAt, 'M/d')} · {expenseCategoryLabel(e.category)}
        </Text>
      </View>
      <View style={rowStyles.right}>
        <Text style={[rowStyles.amount, { color: colors.text }]}>{e.amount.toLocaleString()}원</Text>
        {item.isRegret ? (
          <Text style={[rowStyles.regret, { color: colors.logoutText }]}>후회</Text>
        ) : (
          <Text style={[rowStyles.regret, { color: colors.textMuted }]}>—</Text>
        )}
      </View>
      <MaterialIcons name="chevron-right" size={20} color={colors.textMuted} />
    </Pressable>
  );
}

const rowStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  main: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 14, fontWeight: '800' },
  meta: { fontSize: 11, fontWeight: '600' },
  right: { alignItems: 'flex-end', gap: 2, marginRight: 2 },
  amount: { fontSize: 13, fontWeight: '900' },
  regret: { fontSize: 11, fontWeight: '800' },
});

export function MoodInsightDetailModal({
  visible,
  loading,
  detail,
  periodLabel,
  onClose,
}: {
  visible: boolean;
  loading: boolean;
  detail: MoodInsightDetail | null;
  periodLabel: string;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { colors } = useTheme();

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
        sheet: {
          backgroundColor: colors.surface,
          borderTopLeftRadius: 18,
          borderTopRightRadius: 18,
          maxHeight: '88%',
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
        title: { fontSize: 17, fontWeight: '900', color: colors.text },
        sub: { marginTop: 2, fontSize: 12, fontWeight: '600', color: colors.textMuted },
        close: { fontSize: 14, fontWeight: '800', color: colors.accentBlue },
        body: { paddingHorizontal: 16, paddingTop: 14, gap: 14, paddingBottom: 8 },
        headline: {
          fontSize: 14,
          fontWeight: '700',
          color: colors.textSec,
          lineHeight: 21,
        },
        sectionTitle: { fontSize: 13, fontWeight: '900', color: colors.text },
        sectionSub: { fontSize: 12, fontWeight: '600', color: colors.textMuted, marginTop: 2 },
        chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
        list: { gap: 8, marginTop: 8 },
        empty: { fontSize: 13, fontWeight: '600', color: colors.textMuted, paddingVertical: 8 },
        center: { paddingVertical: 40, alignItems: 'center' },
      }),
    [colors, insets.bottom],
  );

  if (!visible) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="닫기" />
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={{ flex: 1, minWidth: 0, paddingRight: 12 }}>
              <Text style={styles.title}>{detail?.moodLabel ?? '기분 상세'}</Text>
              <Text style={styles.sub}>
                {detail?.moodIncludesLabel ? `${detail.moodIncludesLabel} · ` : ''}
                {periodLabel}
              </Text>
            </View>
            <Pressable onPress={onClose} hitSlop={8}>
              <Text style={styles.close}>닫기</Text>
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.center}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : !detail || detail.totalCount === 0 ? (
            <View style={styles.center}>
              <Text style={styles.empty}>
                {detail?.headline ?? '표시할 기록이 없어요.'}
              </Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
              <Text style={styles.headline}>{detail.headline}</Text>

              <View>
                <Text style={styles.sectionTitle}>패턴 요약</Text>
                <Text style={styles.sectionSub}>요일 · 시간대 · 카테고리 · 메뉴 빈도</Text>
                <View style={styles.chipRow}>
                  {detail.weekdayCounts.map((x) => (
                    <StatChip key={`wd-${x.label}`} label={`${x.label}요일`} count={x.count} />
                  ))}
                </View>
                <View style={[styles.chipRow, { marginTop: 8 }]}>
                  {detail.timeOfDayCounts.map((x) => (
                    <StatChip key={`tod-${x.label}`} label={x.label} count={x.count} />
                  ))}
                </View>
                <View style={[styles.chipRow, { marginTop: 8 }]}>
                  {detail.categoryCounts.map((x) => (
                    <StatChip key={`cat-${x.label}`} label={x.label} count={x.count} />
                  ))}
                </View>
                {detail.menuCounts.length > 0 ? (
                  <View style={[styles.chipRow, { marginTop: 8 }]}>
                    {detail.menuCounts.map((x) => (
                      <StatChip key={`menu-${x.label}`} label={x.label} count={x.count} />
                    ))}
                  </View>
                ) : null}
              </View>

              <View>
                <Text style={styles.sectionTitle}>전체 소비 ({detail.totalCount}건)</Text>
                <Text style={styles.sectionSub}>탭하면 상세 내역으로 이동해요.</Text>
                <View style={styles.list}>
                  {detail.expenses.map((row) => (
                    <ExpenseMiniRow
                      key={row.expense.id}
                      item={row}
                      onPress={() => {
                        onClose();
                        router.push(`/expense/${row.expense.id}`);
                      }}
                    />
                  ))}
                </View>
              </View>

              <View>
                <Text style={styles.sectionTitle}>후회한 소비 ({detail.regretCount}건)</Text>
                {detail.regretExpenses.length > 0 ? (
                  <View style={styles.list}>
                    {detail.regretExpenses.map((row) => (
                      <ExpenseMiniRow
                        key={`regret-${row.expense.id}`}
                        item={row}
                        onPress={() => {
                          onClose();
                          router.push(`/expense/${row.expense.id}`);
                        }}
                      />
                    ))}
                  </View>
                ) : (
                  <Text style={styles.empty}>이 기분으로 적은 기록 중 후회 리뷰는 없어요.</Text>
                )}
              </View>
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}
