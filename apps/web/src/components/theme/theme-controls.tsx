'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { Moon, Palette, Settings, Sun } from 'lucide-react';
import { useTheme } from '@/components/theme/theme-provider';
import { COLOR_PRESETS } from '@/lib/theme';
import { cn } from '@/lib/utils';

const controlClass =
  'inline-flex h-9 items-center gap-1.5 rounded-md border border-[color-mix(in_oklab,var(--clinic)_22%,transparent)] bg-background px-2.5 text-sm font-medium text-foreground shadow-sm transition hover:bg-[var(--clinic-soft)] hover:text-[var(--clinic)]';

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
    <div className="flex shrink-0 items-center gap-1.5">
      <Link href="/configuracion" className={controlClass} title="Configuración">
        <Settings className="h-4 w-4" />
        <span className="hidden sm:inline">Config</span>
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
            style={{ backgroundColor: COLOR_PRESETS.find((p) => p.id === accent)?.swatch }}
          />
          <span className="hidden sm:inline">Color</span>
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
                      setAccent(preset.id);
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
        onClick={toggleMode}
      >
        {mode === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        <span className="hidden sm:inline">{mode === 'dark' ? 'Claro' : 'Oscuro'}</span>
      </button>
    </div>
  );
}
