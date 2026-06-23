'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

export type ThemeName = 'modern' | 'warm';

export type ThemeInfo = {
  name: ThemeName;
  label: string;
  description: string;
};

const THEMES: ThemeInfo[] = [
  { name: 'modern', label: '现代产品', description: '冷调靛蓝，清晰高效' },
  { name: 'warm', label: '温暖医疗', description: '暖调青绿，柔和亲和' },
];

const STORAGE_KEY = 'app-theme';

type ThemeContextValue = {
  theme: ThemeName;
  setTheme: (theme: ThemeName) => void;
  themes: ThemeInfo[];
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function applyTheme(theme: ThemeName) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  if (theme === 'modern') {
    root.removeAttribute('data-theme');
  } else {
    root.setAttribute('data-theme', theme);
  }
}

function readStoredTheme(): ThemeName {
  if (typeof window === 'undefined') return 'modern';
  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored === 'warm') return stored;
  if (stored !== null && stored !== 'modern') {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  return 'modern';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeName>('modern');

  useEffect(() => {
    const stored = readStoredTheme();
    setThemeState(stored);
    applyTheme(stored);
  }, []);

  const setTheme = useCallback((next: ThemeName) => {
    setThemeState(next);
    applyTheme(next);
    if (typeof window !== 'undefined') {
      if (next === 'warm') {
        window.localStorage.setItem(STORAGE_KEY, next);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, themes: THEMES }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return ctx;
}
