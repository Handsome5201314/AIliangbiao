'use client';

import { Palette, Sun } from 'lucide-react';
import { useTheme, type ThemeName } from '@/contexts/ThemeContext';

const ICON_MAP: Record<ThemeName, typeof Sun> = {
  modern: Sun,
  warm: Palette,
};

export default function ThemeSwitcher({ className }: { className?: string }) {
  const { theme, setTheme, themes } = useTheme();

  return (
    <div
      className={`inline-flex items-center gap-1 rounded-full border border-border bg-card p-1 shadow-sm ${className ?? ''}`}
      role="radiogroup"
      aria-label="主题切换"
    >
      {themes.map((t) => {
        const Icon = ICON_MAP[t.name];
        const isActive = theme === t.name;
        return (
          <button
            key={t.name}
            type="button"
            role="radio"
            aria-checked={isActive}
            aria-label={t.label}
            title={t.description}
            onClick={() => setTheme(t.name)}
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-all ${
              isActive
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        );
      })}
    </div>
  );
}
