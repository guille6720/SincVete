'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  applyThemePreferences,
  DEFAULT_THEME,
  parseThemePreferences,
  readStoredThemeRaw,
  writeStoredTheme,
  type ColorPresetId,
  type ThemeMode,
  type ThemePreferences,
} from '@/lib/theme';

interface ThemeContextValue {
  mode: ThemeMode;
  accent: ColorPresetId;
  setMode: (mode: ThemeMode) => void;
  toggleMode: () => void;
  setAccent: (accent: ColorPresetId) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function persistTheme(next: ThemePreferences) {
  applyThemePreferences(next);
  writeStoredTheme(next);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<ThemePreferences>(DEFAULT_THEME);

  useEffect(() => {
    const stored = parseThemePreferences(readStoredThemeRaw());
    setPrefs(stored);
    applyThemePreferences(stored);
  }, []);

  const setMode = useCallback((mode: ThemeMode) => {
    setPrefs((prev) => {
      const next = { ...prev, mode };
      persistTheme(next);
      return next;
    });
  }, []);

  const toggleMode = useCallback(() => {
    setPrefs((prev) => {
      const next = { ...prev, mode: prev.mode === 'dark' ? ('light' as const) : ('dark' as const) };
      persistTheme(next);
      return next;
    });
  }, []);

  const setAccent = useCallback((accent: ColorPresetId) => {
    setPrefs((prev) => {
      const next = { ...prev, accent };
      persistTheme(next);
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({
      mode: prefs.mode,
      accent: prefs.accent,
      setMode,
      toggleMode,
      setAccent,
    }),
    [prefs.mode, prefs.accent, setMode, toggleMode, setAccent]
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
