/** 인사이트 화면 — Green + White 시스템 */
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

export function insightsCardShadow() {
  return {
    shadowColor: INSIGHTS_THEME.shadowColor,
    shadowOffset: { width: 0, height: 4 } as const,
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  };
}
