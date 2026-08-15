export default function HistoriaLoading() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Cargando historia">
      <div className="h-8 w-56 rounded-md bg-muted" />
      <div className="h-4 w-72 rounded-md bg-muted/80" />
      <div className="space-y-2 pt-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-20 rounded-lg border bg-muted/40" />
        ))}
      </div>
    </div>
  );
}
