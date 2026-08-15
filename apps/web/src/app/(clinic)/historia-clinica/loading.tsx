export default function HistoriaClinicaLoading() {
  return (
    <div className="space-y-4 animate-pulse" aria-busy="true" aria-label="Cargando historia clínica">
      <div className="h-8 w-48 rounded-md bg-muted" />
      <div className="h-10 max-w-md rounded-md bg-muted/80" />
      <div className="space-y-2 pt-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 rounded-lg border bg-muted/40" />
        ))}
      </div>
    </div>
  );
}
