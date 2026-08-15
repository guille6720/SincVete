export default function ClinicLoading() {
  return (
    <div className="space-y-4 p-1 animate-pulse" aria-busy="true" aria-label="Cargando">
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
