export default function PacientesLoading() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Cargando pacientes">
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
