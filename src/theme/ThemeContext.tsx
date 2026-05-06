import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = '@regret_wallet_dark_mode2';

export type ThemeColors = {
  bg: string;
  surface: string;
  surfaceMuted: string;
  text: string;
  textSec: string;
  textMuted: string;
  border: string;
  borderInput: string;
  primary: string;
  primaryDark: string;
  onPrimary: string;
  tabActive: string;
  tabInactive: string;
  tabBarBg: string;
  tabBarBorder: string;
  headerBg: string;
  headerTint: string;
  chipInactiveBg: string;
  chipActiveBg: string;
  chipInactiveBorder: string;
  chipActiveBorder: string;
  chipTextInactive: string;
  chipTextActive: string;
  catPill: string;
  gridActiveBg: string;
  gridActiveBorder: string;
  gridTextActive: string;
  pillBg: string;
  pillActiveBg: string;
  pillActiveBorder: string;
  pillText: string;
  pillTextActive: string;
  choiceBg: string;
  choiceActiveBg: string;
  choiceActiveBorder: string;
  choiceTextActive: string;
  accentBlue: string;
  accentCta: string;
  keyFindingBg: string;
  offlineBg: string;
  offlineBorder: string;
  offlineText: string;
  logoutBorder: string;
  logoutText: string;
  errorText: string;
  inputBg: string;
  placeholder: string;
  addTabLabel: string;
  emptyIcon: string;
  starColor: string;
  categoryLabelBg: string;
  success: string;
};

/** Light palette: #4A90E2 primary, #F2F4F5 bg, #DDDAED lavender, #0422C9 royal, #6604C9 purple */
const light: ThemeColors = {
  bg: '#F2F4F5',
  surface: '#ffffff',
  surfaceMuted: '#EDEAF4',
  text: '#111827',
  textSec: '#6B7280',
  textMuted: '#9CA3AF',
  border: '#E0DCEA',
  borderInput: '#D4D0DE',
  primary: '#4A90E2',
  primaryDark: '#0422C9',
  onPrimary: '#ffffff',
  tabActive: '#4A90E2',
  tabInactive: '#999999',
  tabBarBg: '#ffffff',
  tabBarBorder: '#E0DCEA',
  headerBg: '#ffffff',
  headerTint: '#111827',
  chipInactiveBg: '#ffffff',
  chipActiveBg: '#0422C9',
  chipInactiveBorder: '#E0DCEA',
  chipActiveBorder: '#0422C9',
  chipTextInactive: '#111827',
  chipTextActive: '#ffffff',
  catPill: '#DDDAED',
  gridActiveBg: '#E4E1F5',
  gridActiveBorder: '#4A90E2',
  gridTextActive: '#0422C9',
  pillBg: '#EDEAF4',
  pillActiveBg: '#E4E1F5',
  pillActiveBorder: '#C4B8E8',
  pillText: '#6B7280',
  pillTextActive: '#0422C9',
  choiceBg: '#ffffff',
  choiceActiveBg: '#E4E1F5',
  choiceActiveBorder: '#4A90E2',
  choiceTextActive: '#0422C9',
  accentBlue: '#6B94E8',
  accentCta: '#0422C9',
  keyFindingBg: '#6604C9',
  offlineBg: '#FFF3CD',
  offlineBorder: '#FFE69C',
  offlineText: '#856404',
  logoutBorder: '#FCA5A5',
  logoutText: '#B91C1C',
  errorText: '#FF6B6B',
  inputBg: '#ffffff',
  placeholder: '#9CA3AF',
  addTabLabel: '#0422C9',
  emptyIcon: '#B8B4C4',
  starColor: '#CA8A04',
  categoryLabelBg: '#DDDAED',
  success: '#2E7D32',
};

/** Dark: same family — sky blue primary, royal + purple accents on slate */
const dark: ThemeColors = {
  bg: '#0c1220',
  surface: '#1a2235',
  surfaceMuted: '#252d45',
  text: '#f1f5f9',
  textSec: '#94a3b8',
  textMuted: '#64748b',
  border: '#2e3650',
  borderInput: '#3d4666',
  primary: '#5B9FEB',
  primaryDark: '#3b7DDB',
  onPrimary: '#0c1220',
  tabActive: '#5B9FEB',
  tabInactive: '#64748b',
  tabBarBg: '#1a2235',
  tabBarBorder: '#2e3650',
  headerBg: '#1a2235',
  headerTint: '#f1f5f9',
  chipInactiveBg: '#2e3650',
  chipActiveBg: '#1e3BC7',
  chipInactiveBorder: '#3d4666',
  chipActiveBorder: '#3d6AE8',
  chipTextInactive: '#f1f5f9',
  chipTextActive: '#ffffff',
  catPill: '#2f2650',
  gridActiveBg: '#1e2848',
  gridActiveBorder: '#4A90E2',
  gridTextActive: '#93c5fd',
  pillBg: '#252d45',
  pillActiveBg: '#1e2848',
  pillActiveBorder: '#5B7FD6',
  pillText: '#94a3b8',
  pillTextActive: '#93c5fd',
  choiceBg: '#252d45',
  choiceActiveBg: '#1e2848',
  choiceActiveBorder: '#4A90E2',
  choiceTextActive: '#93c5fd',
  accentBlue: '#5c6ec4',
  accentCta: '#3d6AE8',
  keyFindingBg: '#5B21B6',
  offlineBg: '#422006',
  offlineBorder: '#78350f',
  offlineText: '#fcd34d',
  logoutBorder: '#7f1d1d',
  logoutText: '#fca5a5',
  errorText: '#f87171',
  inputBg: '#252d45',
  placeholder: '#64748b',
  addTabLabel: '#7CB0F5',
  emptyIcon: '#5c6078',
  starColor: '#fbbf24',
  categoryLabelBg: '#2f2650',
  success: '#4ade80',
};

type ThemeContextValue = {
  isDark: boolean;
  colors: ThemeColors;
  setDarkMode: (value: boolean) => void;
  toggleDarkMode: () => void;
  hydrated: boolean;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDarkState] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let mounted = true;
    AsyncStorage.getItem(STORAGE_KEY).then((v) => {
      if (!mounted) return;
      setIsDarkState(v === '1');
      setHydrated(true);
    });
    return () => {
      mounted = false;
    };
  }, []);

  const setDarkMode = useCallback((value: boolean) => {
    setIsDarkState(value);
    AsyncStorage.setItem(STORAGE_KEY, value ? '1' : '0').catch(() => undefined);
  }, []);

  const toggleDarkMode = useCallback(() => {
    setDarkMode(!isDark);
  }, [isDark, setDarkMode]);

  const colors = useMemo(() => (isDark ? dark : light), [isDark]);

  const value = useMemo(
    () => ({
      isDark,
      colors,
      setDarkMode,
      toggleDarkMode,
      hydrated,
    }),
    [isDark, colors, setDarkMode, toggleDarkMode, hydrated]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
