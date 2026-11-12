import { useMemo } from 'react';
import { useTheme } from '@/theme/ThemeContext';

/** 인사이트 화면 — Green + White 시스템 (라이트 기본값) */
export const INSIGHTS_THEME = {
  bg: '#F6F9F7',
  surface: '#FFFFFF',
  primary: '#35B779',
  primaryDeep: '#24563F',
  heroNumber: '#244C3A',
  text: '#202522',
  textSecondary: '#707A74',
  textMuted: '#7A847E',
  link: '#476356',
  border: '#E4EBE7',
  heroBorder: '#E3ECE7',
  mintFill: 'rgba(53, 183, 121, 0.1)',
  mintSoft: '#EEF8F2',
  mintHero: '#EAF8F0',
  mintSection: '#F0FAF4',
  positive: '#35B779',
  negative: '#C9847A',
  amber: '#D2A04B',
  mutedGreen: '#6EA98A',
  chartGrid: '#EDF1EF',
  shadowColor: '#24563F',
  heatmapEmpty: '#EEF2EF',
  heatmapZero: '#E5F5EC',
  heatmapLow: '#C3E8D2',
  heatmapMid: '#7BC59B',
  heatmapHigh: '#35B779',
  heatmapPeak: '#237550',
} as const;

export type InsightsPalette = {
  [K in keyof typeof INSIGHTS_THEME]: string;
} & {
  overlay: string;
  isDark: boolean;
};

const LIGHT_OVERLAY = 'rgba(32, 37, 34, 0.35)';
const DARK_OVERLAY = 'rgba(0, 0, 0, 0.55)';

/** ThemeContext 기반 인사이트 팔레트. 라이트는 기존 민트 디자인을 유지한다. */
export function useInsightsPalette(): InsightsPalette {
  const { colors, isDark } = useTheme();
  return useMemo(() => {
    if (!isDark) {
      return { ...INSIGHTS_THEME, overlay: LIGHT_OVERLAY, isDark: false };
    }
    return {
      bg: colors.bg,
      surface: colors.surface,
      primary: colors.primary,
      primaryDeep: colors.accentBlue,
      heroNumber: colors.accentBlue,
      text: colors.text,
      textSecondary: colors.textSec,
      textMuted: colors.textMuted,
      link: colors.accentBlue,
      border: colors.border,
      heroBorder: colors.border,
      mintFill: colors.choiceActiveBg,
      mintSoft: colors.choiceActiveBg,
      mintHero: colors.choiceActiveBg,
      mintSection: colors.bg,
      positive: INSIGHTS_THEME.positive,
      negative: INSIGHTS_THEME.negative,
      amber: INSIGHTS_THEME.amber,
      mutedGreen: colors.textSec,
      chartGrid: colors.border,
      shadowColor: '#000000',
      heatmapEmpty: colors.surfaceMuted,
      heatmapZero: colors.choiceActiveBg,
      heatmapLow: INSIGHTS_THEME.heatmapLow,
      heatmapMid: INSIGHTS_THEME.heatmapMid,
      heatmapHigh: INSIGHTS_THEME.heatmapHigh,
      heatmapPeak: INSIGHTS_THEME.heatmapPeak,
      overlay: DARK_OVERLAY,
      isDark: true,
    };
  }, [colors, isDark]);
}

export function insightsCardShadow(isDark = false) {
  return {
    shadowColor: isDark ? '#000000' : INSIGHTS_THEME.shadowColor,
    shadowOffset: { width: 0, height: 4 } as const,
    shadowOpacity: isDark ? 0.28 : 0.05,
    shadowRadius: 12,
    elevation: 2,
  };
}
