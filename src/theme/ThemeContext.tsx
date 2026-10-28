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
const STORAGE_KEY_ANIM = '@rw_animations_enabled';

export type ThemeColors = {
  bg: string; surface: string; surfaceMuted: string;
  text: string; textSec: string; textMuted: string;
  border: string; borderInput: string;
  /** 고정 헤더가 스크롤된 뒤에만 보이는 하단 구분선 */
  headerDivider: string;
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

/** 브랜드 그린 (기본) */
export const GREEN_PRESET: AccentPreset = { key: 'green', label: '그린', color: '#34785F' };

export const BRAND_GREEN = '#34785F';
export const BRAND_GREEN_DARK = '#28624D';
export const BRAND_GREEN_LIGHT = '#EAF5EE';
export const BRAND_GREEN_SURFACE = '#F2F8F4';
const LEGACY_DEFAULT_GREENS = new Set(['#34C36F', '#2AAD5C', '#34c36f', '#2aad5c']);

export function isCustomHex(key: string): boolean {
  return key.startsWith('#');
}

// ── 다크 고정 팔레트 ──────────────────────────────────
const darkBase: ThemeColors = {
  bg: '#0B0F0E', surface: '#151A19', surfaceMuted: '#1E2624',
  text: '#F1F5F4', textSec: '#A8B5B0', textMuted: '#6B7A74',
  border: '#2A3430', borderInput: '#33403C', headerDivider: '#2A3430',
  primary: BRAND_GREEN, primaryDark: BRAND_GREEN_DARK, onPrimary: '#0B0F0E',
  tabActive: BRAND_GREEN, tabInactive: '#6B7A74',
  tabBarBg: '#151A19', tabBarBorder: '#2A3430',
  headerBg: '#151A19', headerGradientStart: '#0B0F0E', headerGradientEnd: '#151A19',
  headerTint: '#F1F5F4',
  chipInactiveBg: '#1E2624', chipActiveBg: BRAND_GREEN,
  chipInactiveBorder: '#33403C', chipActiveBorder: BRAND_GREEN,
  chipTextInactive: '#F1F5F4', chipTextActive: '#0B0F0E',
  catPill: '#1E2624', gridActiveBg: '#1A2E24', gridActiveBorder: BRAND_GREEN, gridTextActive: '#BFFF00',
  pillBg: '#1E2624', pillActiveBg: '#1A2E24', pillActiveBorder: BRAND_GREEN,
  pillText: '#A8B5B0', pillTextActive: '#BFFF00',
  choiceBg: '#1E2624', choiceActiveBg: '#1A2E24', choiceActiveBorder: BRAND_GREEN, choiceTextActive: '#BFFF00',
  accentBlue: '#7DD3A8', accentCta: BRAND_GREEN, keyFindingBg: '#1A2E24',
  offlineBg: '#422006', offlineBorder: '#78350f', offlineText: '#fcd34d',
  logoutBorder: '#7f1d1d', logoutText: '#fca5a5', errorText: '#f87171',
  inputBg: '#111614', placeholder: '#6B7A74', addTabLabel: '#A8B5B0', emptyIcon: '#6B7A74',
  starColor: '#fbbf24', categoryLabelBg: '#1E2624', success: '#4ade80',
};

// ── 라이트 기본 팔레트 ────────────────────────────────
const lightBase: ThemeColors = {
  bg: '#F7F9F7', surface: '#ffffff', surfaceMuted: '#F1F4F2',
  text: '#20352B', textSec: '#60736A', textMuted: '#82918A',
  border: '#E5EBE7', borderInput: '#D9E2DC', headerDivider: '#E8ECE8',
  primary: BRAND_GREEN, primaryDark: BRAND_GREEN_DARK, onPrimary: '#ffffff',
  tabActive: BRAND_GREEN, tabInactive: '#82918A',
  tabBarBg: '#ffffff', tabBarBorder: '#E5EBE7',
  headerBg: '#F7F9F7', headerGradientStart: '#ffffff', headerGradientEnd: '#ffffff',
  headerTint: '#20352B',
  chipInactiveBg: '#F1F4F2', chipActiveBg: BRAND_GREEN,
  chipInactiveBorder: '#E5EBE7', chipActiveBorder: BRAND_GREEN,
  chipTextInactive: '#20352B', chipTextActive: '#ffffff',
  catPill: '#EAF5EE', gridActiveBg: BRAND_GREEN_LIGHT, gridActiveBorder: BRAND_GREEN, gridTextActive: BRAND_GREEN_DARK,
  pillBg: '#F1F4F2', pillActiveBg: BRAND_GREEN_LIGHT, pillActiveBorder: '#C5DDD0',
  pillText: '#60736A', pillTextActive: BRAND_GREEN_DARK,
  choiceBg: '#ffffff', choiceActiveBg: BRAND_GREEN_LIGHT, choiceActiveBorder: BRAND_GREEN, choiceTextActive: BRAND_GREEN_DARK,
  accentBlue: BRAND_GREEN, accentCta: BRAND_GREEN, keyFindingBg: '#1A2E24',
  offlineBg: '#FFF3CD', offlineBorder: '#FFE69C', offlineText: '#856404',
  logoutBorder: '#FCA5A5', logoutText: '#B91C1C', errorText: '#FF6B6B',
  inputBg: BRAND_GREEN_SURFACE, placeholder: '#82918A', addTabLabel: '#60736A', emptyIcon: '#B4C0BA',
  starColor: BRAND_GREEN, categoryLabelBg: '#F1F4F2', success: BRAND_GREEN,
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
  /** 동작 애니메이션 on/off (기기 로컬 설정) */
  animationsEnabled: boolean;
  setAnimationsEnabled: (v: boolean) => void;
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [isDark, setIsDarkState]         = useState(false);
  const [hydrated, setHydrated]          = useState(false);
  const [accentKey, setAccentKeyState]   = useState(BRAND_GREEN);
  const [customPresets, setCustomPresets] = useState<AccentPreset[]>([GREEN_PRESET, NAVY_PRESET]);
  const [animationsEnabled, setAnimationsEnabledState] = useState(true);

  // AsyncStorage 초기 로드
  useEffect(() => {
    let mounted = true;
    Promise.all([
      AsyncStorage.getItem(STORAGE_KEY_DARK),
      AsyncStorage.getItem(STORAGE_KEY_ACCENT),
      AsyncStorage.getItem(STORAGE_KEY_CUSTOM_PRESETS),
      AsyncStorage.getItem(STORAGE_KEY_ANIM),
    ]).then(([darkVal, accentVal, presetsVal, animVal]) => {
      if (!mounted) return;
      setIsDarkState(darkVal === '1');
      if (accentVal) {
        setAccentKeyState(LEGACY_DEFAULT_GREENS.has(accentVal) ? BRAND_GREEN : accentVal);
      }
      // 기본값 true, 명시적으로 '0'일 때만 끔
      setAnimationsEnabledState(animVal !== '0');
      if (presetsVal) {
        try {
          const parsed: AccentPreset[] = JSON.parse(presetsVal);
          const hasGreen = parsed.some(p => p.key === 'green');
          const hasNavy = parsed.some(p => p.key === 'navy');
          let presets = parsed.map((p) => (p.key === 'green' ? GREEN_PRESET : p));
          if (!hasGreen) presets = [GREEN_PRESET, ...presets];
          if (!hasNavy) presets = [...presets, NAVY_PRESET];
          setCustomPresets(presets);
        } catch {
          setCustomPresets([GREEN_PRESET, NAVY_PRESET]);
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

  const setAnimationsEnabled = useCallback((value: boolean) => {
    setAnimationsEnabledState(value);
    AsyncStorage.setItem(STORAGE_KEY_ANIM, value ? '1' : '0').catch(() => {});
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
    animationsEnabled, setAnimationsEnabled,
  }), [isDark, colors, setDarkMode, toggleDarkMode, hydrated,
       accentKey, setAccentKey, customPresets, addCustomPreset, removeCustomPreset,
       animationsEnabled, setAnimationsEnabled]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
