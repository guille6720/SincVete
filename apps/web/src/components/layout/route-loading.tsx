/** Shared route skeletons for App Router `loading.tsx` files. */

export function RouteLoading({
  label = 'Cargando',
  variant = 'page',
}: {
  label?: string;
  variant?: 'page' | 'list' | 'detail' | 'board';
}) {
  if (variant === 'list') {
    return (
      <div className="space-y-4 animate-pulse" aria-busy="true" aria-label={label}>
        <div className="h-8 w-40 rounded-md bg-muted" />
        <div className="h-10 max-w-md rounded-md bg-muted/80" />
        <div className="overflow-hidden rounded-lg border">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 border-b px-4 py-3 last:border-0">
              <div className="h-9 w-9 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-1/3 rounded bg-muted" />
                <div className="h-3 w-1/4 rounded bg-muted/70" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === 'detail') {
    return (
      <div className="space-y-4 animate-pulse" aria-busy="true" aria-label={label}>
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-md bg-muted" />
          <div className="h-8 w-48 rounded-md bg-muted" />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="h-40 rounded-lg border bg-muted/40" />
          <div className="h-40 rounded-lg border bg-muted/40" />
        </div>
        <div className="h-32 rounded-lg border bg-muted/30" />
      </div>
    );
  }

  if (variant === 'board') {
    return (
      <div className="space-y-4 animate-pulse" aria-busy="true" aria-label={label}>
        <div className="flex items-center justify-between">
          <div className="h-8 w-40 rounded-md bg-muted" />
          <div className="h-9 w-28 rounded-md bg-muted/80" />
        </div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 rounded-lg border bg-muted/40" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-1 animate-pulse" aria-busy="true" aria-label={label}>
      <div className="h-8 w-48 rounded-md bg-muted" />
      <div className="h-4 w-72 rounded-md bg-muted/80" />
      <div className="mt-6 space-y-3">
        <div className="h-24 rounded-lg bg-muted/70" />
        <div className="h-24 rounded-lg bg-muted/60" />
        <div className="h-24 rounded-lg bg-muted/50" />
      </div>
    </div>
  );
}
