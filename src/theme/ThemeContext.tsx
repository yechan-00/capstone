import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY_DARK   = '@rw_dark_mode2';
const STORAGE_KEY_ACCENT = '@rw_accent_color';
const STORAGE_KEY_CUSTOM_PRESETS = '@rw_custom_presets';

export type ThemeColors = {
  bg: string; surface: string; surfaceMuted: string;
  text: string; textSec: string; textMuted: string;
  border: string; borderInput: string;
  primary: string; primaryDark: string; onPrimary: string;
  tabActive: string; tabInactive: string; tabBarBg: string; tabBarBorder: string;
  headerBg: string; headerGradientStart: string; headerGradientEnd: string; headerTint: string;
  chipInactiveBg: string; chipActiveBg: string; chipInactiveBorder: string;
  chipActiveBorder: string; chipTextInactive: string; chipTextActive: string;
  catPill: string; gridActiveBg: string; gridActiveBorder: string; gridTextActive: string;
  pillBg: string; pillActiveBg: string; pillActiveBorder: string; pillText: string; pillTextActive: string;
  choiceBg: string; choiceActiveBg: string; choiceActiveBorder: string; choiceTextActive: string;
  accentBlue: string; accentCta: string; keyFindingBg: string;
  offlineBg: string; offlineBorder: string; offlineText: string;
  logoutBorder: string; logoutText: string; errorText: string;
  inputBg: string; placeholder: string; addTabLabel: string; emptyIcon: string;
  starColor: string; categoryLabelBg: string; success: string;
};

export type AccentPreset = { key: string; label: string; color: string };

/** 기본 내장 프리셋 (라이트 전용) */
export const DEFAULT_PRESETS: AccentPreset[] = [];

/** 네이비 기본값 */
export const NAVY_PRESET: AccentPreset = { key: 'navy', label: '네이비', color: '#1a2d4a' };

export function isCustomHex(key: string): boolean {
  return key.startsWith('#');
}

// ── 다크 고정 팔레트 ──────────────────────────────────
const darkBase: ThemeColors = {
  bg: '#0F1419', surface: '#1A2332', surfaceMuted: '#232f42',
  text: '#E2E8F0', textSec: '#94A3B8', textMuted: '#64748B',
  border: '#2A3548', borderInput: '#334155',
  primary: '#3B82F6', primaryDark: '#2563EB', onPrimary: '#FFFFFF',
  tabActive: '#3B82F6', tabInactive: '#64748B',
  tabBarBg: '#1A2332', tabBarBorder: '#2A3548',
  headerBg: '#1A2F4A', headerGradientStart: '#0F1F35', headerGradientEnd: '#1A2F4A',
  headerTint: '#E2E8F0',
  chipInactiveBg: '#232f42', chipActiveBg: '#3B82F6',
  chipInactiveBorder: '#334155', chipActiveBorder: '#3B82F6',
  chipTextInactive: '#E2E8F0', chipTextActive: '#FFFFFF',
  catPill: '#232f42', gridActiveBg: '#1e3a5f', gridActiveBorder: '#3B82F6', gridTextActive: '#93C5FD',
  pillBg: '#232f42', pillActiveBg: '#1e3a5f', pillActiveBorder: '#3B82F6',
  pillText: '#94A3B8', pillTextActive: '#93C5FD',
  choiceBg: '#232f42', choiceActiveBg: '#1e3a5f', choiceActiveBorder: '#3B82F6', choiceTextActive: '#93C5FD',
  accentBlue: '#60A5FA', accentCta: '#3B82F6', keyFindingBg: '#4F46E5',
  offlineBg: '#422006', offlineBorder: '#78350f', offlineText: '#fcd34d',
  logoutBorder: '#7f1d1d', logoutText: '#fca5a5', errorText: '#f87171',
  inputBg: '#151c28', placeholder: '#64748B', addTabLabel: '#94A3B8', emptyIcon: '#64748B',
  starColor: '#fbbf24', categoryLabelBg: '#232f42', success: '#4ade80',
};

// ── 라이트 기본 팔레트 ────────────────────────────────
const lightBase: ThemeColors = {
  bg: '#f5f6f8', surface: '#ffffff', surfaceMuted: '#eef1f6',
  text: '#1c2434', textSec: '#5c6578', textMuted: '#8b94a7',
  border: '#e4e8f0', borderInput: '#d8dde8',
  primary: '#1a2d4a', primaryDark: '#132238', onPrimary: '#ffffff',
  tabActive: '#1a2d4a', tabInactive: '#9aa3b2',
  tabBarBg: '#ffffff', tabBarBorder: '#e8ecf4',
  headerBg: '#f5f6f8', headerGradientStart: '#1a2d4a', headerGradientEnd: '#1a2d4a',
  headerTint: '#1c2434',
  chipInactiveBg: '#f3f5f9', chipActiveBg: '#1a2d4a',
  chipInactiveBorder: '#e4e8f0', chipActiveBorder: '#1a2d4a',
  chipTextInactive: '#1c2434', chipTextActive: '#ffffff',
  catPill: '#e8ecf4', gridActiveBg: '#e8edf5', gridActiveBorder: '#1a2d4a', gridTextActive: '#1a2d4a',
  pillBg: '#eef1f6', pillActiveBg: '#e8edf5', pillActiveBorder: '#c5d0e6',
  pillText: '#5c6578', pillTextActive: '#1a2d4a',
  choiceBg: '#ffffff', choiceActiveBg: '#e8edf5', choiceActiveBorder: '#1a2d4a', choiceTextActive: '#1a2d4a',
  accentBlue: '#3d5a80', accentCta: '#1a2d4a', keyFindingBg: '#4F46E5',
  offlineBg: '#FFF3CD', offlineBorder: '#FFE69C', offlineText: '#856404',
  logoutBorder: '#FCA5A5', logoutText: '#B91C1C', errorText: '#FF6B6B',
  inputBg: '#f8f9fc', placeholder: '#98a2b3', addTabLabel: '#5c6578', emptyIcon: '#b4bcc9',
  starColor: '#CA8A04', categoryLabelBg: '#eef1f6', success: '#2E7D32',
};

function darken(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, ((n >> 16) & 0xff) - 30);
  const g = Math.max(0, ((n >> 8)  & 0xff) - 30);
  const b = Math.max(0, ( n        & 0xff) - 30);
  return `#${[r,g,b].map(v => v.toString(16).padStart(2,'0')).join('')}`;
}

function applyAccent(accent: string): ThemeColors {
  const alphaBg = `${accent}18`;
  return {
    ...lightBase,
    primary: accent, primaryDark: darken(accent),
    tabActive: accent,
    headerGradientStart: accent, headerGradientEnd: accent,
    chipActiveBg: accent, chipActiveBorder: accent,
    gridActiveBg: alphaBg, gridActiveBorder: accent, gridTextActive: darken(accent),
    pillActiveBg: alphaBg, pillActiveBorder: `${accent}66`, pillTextActive: darken(accent),
    choiceActiveBg: alphaBg, choiceActiveBorder: accent, choiceTextActive: darken(accent),
    accentCta: accent,
  };
}

type ThemeContextValue = {
  isDark: boolean;
  colors: ThemeColors;
  setDarkMode: (v: boolean) => void;
  toggleDarkMode: () => void;
  hydrated: boolean;
  accentKey: string;
  setAccentKey: (key: string) => void;
  customPresets: AccentPreset[];
  addCustomPreset: (preset: AccentPreset) => void;
  removeCustomPreset: (key: string) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDarkState]         = useState(false);
  const [hydrated, setHydrated]          = useState(false);
  const [accentKey, setAccentKeyState]   = useState('#1a2d4a');
  const [customPresets, setCustomPresets] = useState<AccentPreset[]>([NAVY_PRESET]);

  // AsyncStorage 초기 로드
  useEffect(() => {
    let mounted = true;
    Promise.all([
      AsyncStorage.getItem(STORAGE_KEY_DARK),
      AsyncStorage.getItem(STORAGE_KEY_ACCENT),
      AsyncStorage.getItem(STORAGE_KEY_CUSTOM_PRESETS),
    ]).then(([darkVal, accentVal, presetsVal]) => {
      if (!mounted) return;
      setIsDarkState(darkVal === '1');
      if (accentVal) setAccentKeyState(accentVal);
      if (presetsVal) {
        try {
          const parsed: AccentPreset[] = JSON.parse(presetsVal);
          // 네이비가 없으면 맨 앞에 추가
          const hasNavy = parsed.some(p => p.key === 'navy');
          setCustomPresets(hasNavy ? parsed : [NAVY_PRESET, ...parsed]);
        } catch {
          setCustomPresets([NAVY_PRESET]);
        }
      }
      setHydrated(true);
    });
    return () => { mounted = false; };
  }, []);

  const setDarkMode = useCallback((value: boolean) => {
    setIsDarkState(value);
    AsyncStorage.setItem(STORAGE_KEY_DARK, value ? '1' : '0').catch(() => {});
  }, []);

  const toggleDarkMode = useCallback(() => setDarkMode(!isDark), [isDark, setDarkMode]);

  const setAccentKey = useCallback((key: string) => {
    setAccentKeyState(key);
    AsyncStorage.setItem(STORAGE_KEY_ACCENT, key).catch(() => {});
  }, []);

  const addCustomPreset = useCallback((preset: AccentPreset) => {
    setCustomPresets(prev => {
      const next = [...prev, preset];
      AsyncStorage.setItem(STORAGE_KEY_CUSTOM_PRESETS, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const removeCustomPreset = useCallback((key: string) => {
    setCustomPresets(prev => {
      const next = prev.filter(p => p.key !== key);
      AsyncStorage.setItem(STORAGE_KEY_CUSTOM_PRESETS, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  // ★ 다크모드면 무조건 darkBase 고정, 라이트모드만 accent 적용
  const colors = useMemo(() => {
    if (isDark) return darkBase;
    // 라이트: accentKey가 hex면 그대로, 아니면 프리셋에서 찾기
    const accentHex = isCustomHex(accentKey)
      ? accentKey
      : (customPresets.find(p => p.key === accentKey)?.color ?? NAVY_PRESET.color);
    return applyAccent(accentHex);
  }, [isDark, accentKey, customPresets]);

  const value = useMemo(() => ({
    isDark, colors, setDarkMode, toggleDarkMode, hydrated,
    accentKey, setAccentKey,
    customPresets, addCustomPreset, removeCustomPreset,
  }), [isDark, colors, setDarkMode, toggleDarkMode, hydrated,
       accentKey, setAccentKey, customPresets, addCustomPreset, removeCustomPreset]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
