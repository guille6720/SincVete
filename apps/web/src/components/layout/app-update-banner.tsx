'use client';

import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

const BUILD_ID = process.env.NEXT_PUBLIC_BUILD_ID || 'local';
const POLL_MS = 45_000;

export function AppUpdateBanner() {
  const [updateAvailable, setUpdateAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function checkVersion() {
      try {
        const res = await fetch(`/api/version?t=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as { version?: string };
        if (!cancelled && data.version && data.version !== BUILD_ID && BUILD_ID !== 'local') {
          setUpdateAvailable(true);
        }
      } catch {
        // ignore network errors
      }
    }

    void checkVersion();
    const id = window.setInterval(checkVersion, POLL_MS);
    const onFocus = () => void checkVersion();
    window.addEventListener('focus', onFocus);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener('focus', onFocus);
    };
  }, []);

  if (!updateAvailable) return null;

  return (
    <div className="fixed inset-x-0 top-0 z-[70] flex justify-center p-3 pointer-events-none">
      <div className="pointer-events-auto flex max-w-lg items-center gap-3 rounded-xl border border-[color-mix(in_oklab,var(--clinic)_30%,transparent)] bg-card px-4 py-3 text-sm shadow-lg">
        <p className="text-foreground">
          Hay una <span className="font-semibold">actualización</span> de SincVete disponible.
        </p>
        <button
          type="button"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md px-3 py-1.5 text-white"
          style={{ backgroundColor: 'var(--clinic)' }}
          onClick={() => window.location.reload()}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Actualizar
        </button>
      </div>
    </div>
  );
}
