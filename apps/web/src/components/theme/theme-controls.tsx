'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { BookOpen, Moon, Palette, Settings, Sun } from 'lucide-react';
import { MANUAL_DOWNLOAD_HREF, MANUAL_FILENAME } from '@/components/manual/manual-constants';
import {
  COLOR_PRESETS,
  DEFAULT_THEME,
  applyThemePreferences,
  parseThemePreferences,
  THEME_STORAGE_KEY,
  type ColorPresetId,
  type ThemeMode,
  type ThemePreferences,
} from '@/lib/theme';
import { cn } from '@/lib/utils';

const controlClass =
  'inline-flex h-9 items-center gap-1.5 rounded-md border border-teal-700/30 bg-white px-2.5 text-sm font-semibold text-teal-900 shadow-sm transition hover:bg-teal-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800';

function readPrefs(): ThemePreferences {
  if (typeof window === 'undefined') return DEFAULT_THEME;
  return parseThemePreferences(localStorage.getItem(THEME_STORAGE_KEY));
}

function writePrefs(next: ThemePreferences) {
  applyThemePreferences(next);
  localStorage.setItem(THEME_STORAGE_KEY, JSON.stringify(next));
}

/**
 * Header theme controls — self-contained (localStorage) so they still render
 * even if ThemeProvider context fails to wire across chunks.
 */
export function ThemeControls() {
  const [mode, setMode] = useState<ThemeMode>(DEFAULT_THEME.mode);
  const [accent, setAccentState] = useState<ColorPresetId>(DEFAULT_THEME.accent);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const paletteRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefs = readPrefs();
    setMode(prefs.mode);
    setAccentState(prefs.accent);
    applyThemePreferences(prefs);
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!paletteOpen) return;

    function onPointerDown(event: MouseEvent) {
      if (!paletteRef.current?.contains(event.target as Node)) {
        setPaletteOpen(false);
      }
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setPaletteOpen(false);
    }

    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [paletteOpen]);

  function persist(next: ThemePreferences) {
    setMode(next.mode);
    setAccentState(next.accent);
    writePrefs(next);
  }

  return (
    <div
      className="flex shrink-0 items-center gap-1.5 rounded-lg bg-teal-600/10 p-1 dark:bg-teal-400/10"
      data-testid="theme-controls"
      aria-label="Manual, tema y configuración"
    >
      <Link href="/configuracion" className={controlClass} title="Configuración">
        <Settings className="h-4 w-4" />
        <span>Config</span>
      </Link>

      <div className="relative" ref={paletteRef}>
        <button
          type="button"
          className={controlClass}
          aria-label="Paleta de colores"
          aria-expanded={paletteOpen}
          aria-haspopup="dialog"
          title="Paleta de colores"
          onClick={() => setPaletteOpen((open) => !open)}
        >
          <Palette className="h-4 w-4" />
          <span
            className="h-3.5 w-3.5 rounded-full border border-black/10"
            style={{
              backgroundColor: COLOR_PRESETS.find((p) => p.id === accent)?.swatch,
            }}
          />
          <span>Color</span>
        </button>

        {paletteOpen ? (
          <div
            role="dialog"
            aria-label="Elegir color de acento"
            className="absolute left-0 top-full z-50 mt-2 w-56 rounded-xl border border-border bg-card p-3 shadow-lg"
          >
            <p className="mb-2 text-xs font-medium text-muted-foreground">Color de acento</p>
            <div className="grid grid-cols-4 gap-2">
              {COLOR_PRESETS.map((preset) => {
                const selected = accent === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    title={preset.label}
                    aria-label={preset.label}
                    aria-pressed={selected}
                    onClick={() => {
                      persist({ mode, accent: preset.id });
                      setPaletteOpen(false);
                    }}
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-full border-2 transition',
                      selected
                        ? 'scale-105 border-foreground'
                        : 'border-transparent hover:scale-105'
                    )}
                  >
                    <span
                      className="h-6 w-6 rounded-full shadow-sm"
                      style={{ backgroundColor: preset.swatch }}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <button
        type="button"
        className={controlClass}
        aria-label={mode === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        title={mode === 'dark' ? 'Modo claro' : 'Modo oscuro'}
        onClick={() => persist({ mode: mode === 'dark' ? 'light' : 'dark', accent })}
      >
        {mounted && mode === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        <span>{mounted && mode === 'dark' ? 'Claro' : 'Oscuro'}</span>
      </button>

      <a
        href={MANUAL_DOWNLOAD_HREF}
        download={MANUAL_FILENAME}
        className={controlClass}
        aria-label="Descargar manual de uso"
        title="Descargar manual de uso"
      >
        <BookOpen className="h-4 w-4" />
        <span>Manual</span>
      </a>
    </div>
  );
}
