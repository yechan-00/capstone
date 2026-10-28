import { useMemo } from 'react';
import { useTheme } from '@/theme/ThemeContext';

/** 소비 상세 화면 Color System v2 (Green + White + Pastel) */
export const EXPENSE_DETAIL = {
  bg: '#F6F9F7',
  surface: '#FFFFFF',
  primaryDeep: '#24563F',
  primary: '#35B779',
  secondary: '#58B98A',
  lightMint: '#DDF4E7',
  veryLightMint: '#EEF8F2',
  categoryPillBg: '#DDF4E7',
  categoryPillText: '#2F7E58',
  amount: '#24563F',
  text: '#202522',
  textSecondary: '#707A74',
  textTertiary: '#9AA39D',
  textMuted: '#7A847E',
  sectionLabel: '#5E7468',
  border: '#E4EBE7',
  borderSoft: '#DDE9E2',
  divider: '#EDF1EF',
  quoteBg: '#EEF8F2',
  quoteBorder: '#D9EBE1',
  quoteText: '#314239',
  quoteAccent: '#35B779',
  reviewNoteBg: '#F0F8F4',
  reviewNoteText: '#35453C',
  reviewMeta: '#8C9690',
  reviewBorder: '#DDE9E2',
  satisfactionText: '#2F8C60',
  commentEmptyBg: '#ECF8F1',
  commentEmptyBorder: '#D5EBDD',
  commentEmptyText: '#597066',
  commentNickname: '#24563F',
  commentBody: '#28342E',
  commentTime: '#929A95',
  similarEmptyText: '#435149',
  similarEmptySub: '#7D8781',
  similarIconBg: '#E5F5EC',
  shareIcon: '#2E7655',
  sharePressedBg: '#EEF8F2',
  shadowColor: '#24563F',
  shadow: 'rgba(36, 86, 63, 0.05)',
  shadowStrong: 'rgba(35, 86, 63, 0.08)',
  barLight: '#9ED9BB',
  barMid: '#69C499',
  barDark: '#35B779',
} as const;

/** 소비 상세 spacing system */
export const EXPENSE_DETAIL_SPACE = {
  pageX: 20,
  sectionTitleGap: 12,
  contextGroupGap: 16,
  sectionGap: 24,
  sectionGapMajor: 28,
  cardPadding: 20,
  cardPaddingAux: 16,
  chipGap: 8,
} as const;

export const EXPENSE_DETAIL_CARD = {
  backgroundColor: EXPENSE_DETAIL.surface,
  borderWidth: 1,
  borderColor: EXPENSE_DETAIL.border,
  borderRadius: 21,
  padding: EXPENSE_DETAIL_SPACE.cardPadding,
} as const;

export const EXPENSE_DETAIL_CARD_AUX = {
  backgroundColor: EXPENSE_DETAIL.surface,
  borderWidth: 1,
  borderColor: EXPENSE_DETAIL.border,
  borderRadius: 17,
  padding: EXPENSE_DETAIL_SPACE.cardPaddingAux,
} as const;

export const EXPENSE_DETAIL_CARD_REVIEW = {
  ...EXPENSE_DETAIL_CARD,
  borderColor: EXPENSE_DETAIL.reviewBorder,
} as const;

export function expenseDetailCardShadow(elevation = 2) {
  return {
    shadowColor: EXPENSE_DETAIL.shadowColor,
    shadowOffset: { width: 0, height: 4 } as const,
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation,
  };
}

export function expenseDetailCardShadowStrong() {
  return {
    shadowColor: EXPENSE_DETAIL.shadowColor,
    shadowOffset: { width: 0, height: 6 } as const,
    shadowOpacity: 0.06,
    shadowRadius: 22,
    elevation: 2,
  };
}

type ChipStyle = { bg: string; text: string; border?: string };

/** 리뷰 만족도별 pastel */
export function expenseSatisfactionStyle(stars: number): ChipStyle {
  if (stars >= 5) return { bg: '#DDF5E7', text: '#2F8C60' };
  if (stars >= 4) return { bg: '#E6F4EB', text: '#2F8C60' };
  if (stars >= 3) return { bg: '#FAF1DD', text: '#8A6D32' };
  if (stars >= 2) return { bg: '#F9E8E5', text: '#B35F5A' };
  return { bg: '#F5DDDA', text: '#A84E48' };
}

export function useExpenseDetailPalette() {
  const { colors, isDark } = useTheme();
  return useMemo(
    () => ({
      bg: isDark ? colors.bg : '#F7F9F7',
      surface: colors.surface,
      text: colors.text,
      textSec: colors.textSec,
      textMuted: colors.textMuted,
      border: isDark ? colors.border : '#E4EBE7',
      divider: isDark ? colors.border : 'rgba(32, 37, 34, 0.08)',
      headerDivider: colors.headerDivider,
      mintFill: isDark ? colors.choiceActiveBg : '#EEF8F2',
      mintText: isDark ? colors.primary : '#3E7A61',
      mintSoft: isDark ? colors.surfaceMuted : '#F3F8F5',
      chipBg: isDark ? colors.surfaceMuted : '#F3F5F4',
      chipText: isDark ? colors.textSec : '#4A5C52',
      photoBg: isDark ? colors.surfaceMuted : '#F7F8F7',
      iconBtnBg: isDark ? colors.surfaceMuted : '#F5F6F5',
      primary: colors.primary,
      logoutText: colors.logoutText,
      isDark,
    }),
    [colors, isDark],
  );
}
