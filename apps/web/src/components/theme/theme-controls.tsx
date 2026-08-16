'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Moon, Palette, Settings, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/components/theme/theme-provider';
import { COLOR_PRESETS } from '@/lib/theme';
import { cn } from '@/lib/utils';

export function ThemeControls() {
  const { mode, accent, toggleMode, setAccent } = useTheme();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const paletteRef = useRef<HTMLDivElement>(null);

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

  return (
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="icon"
        className="h-9 w-9 text-slate-600 hover:bg-teal-50 hover:text-teal-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
        asChild
      >
        <Link href="/configuracion" aria-label="Configuración" title="Configuración">
          <Settings className="h-4 w-4" />
        </Link>
      </Button>

      <div className="relative" ref={paletteRef}>
        <Button
          variant="ghost"
          size="icon"
          type="button"
          className="h-9 w-9 text-slate-600 hover:bg-teal-50 hover:text-teal-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          aria-label="Paleta de colores"
          aria-expanded={paletteOpen}
          aria-haspopup="dialog"
          title="Paleta de colores"
          onClick={() => setPaletteOpen((open) => !open)}
        >
          <Palette className="h-4 w-4" />
        </Button>

        {paletteOpen ? (
          <div
            role="dialog"
            aria-label="Elegir color de acento"
            className="absolute left-0 top-full z-50 mt-2 w-56 rounded-xl border border-teal-900/10 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900"
          >
            <p className="mb-2 text-xs font-medium text-slate-500 dark:text-slate-400">
              Color de acento
            </p>
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
                      setAccent(preset.id);
                      setPaletteOpen(false);
                    }}
                    className={cn(
                      'flex h-9 w-9 items-center justify-center rounded-full border-2 transition',
                      selected
                        ? 'border-slate-900 scale-105 dark:border-white'
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

      <Button
        variant="ghost"
        size="icon"
        type="button"
        className="h-9 w-9 text-slate-600 hover:bg-teal-50 hover:text-teal-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
        aria-label={mode === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
        title={mode === 'dark' ? 'Modo claro' : 'Modo oscuro'}
        onClick={toggleMode}
      >
        {mode === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      </Button>
    </div>
  );
}
