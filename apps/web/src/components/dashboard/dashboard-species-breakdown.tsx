import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SPECIES_EMOJI, type DashboardSummary } from '@sincvete/shared';

interface DashboardSpeciesBreakdownProps {
  summary: DashboardSummary;
}

export function DashboardSpeciesBreakdown({ summary }: DashboardSpeciesBreakdownProps) {
  const total = summary.speciesCounts.reduce((acc, item) => acc + item.count, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Pacientes por especie</CardTitle>
        <CardDescription>Distribución de pacientes activos</CardDescription>
      </CardHeader>
      <CardContent>
        {summary.speciesCounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay pacientes registrados.</p>
        ) : (
          <ul className="space-y-3">
            {summary.speciesCounts.map((item) => {
              const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
              return (
                <li key={item.species} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <Link
                      href={`/pacientes?species=${encodeURIComponent(item.species)}`}
                      className="font-medium hover:text-primary hover:underline"
                    >
                      {SPECIES_EMOJI[item.species]} {item.species}
                    </Link>
                    <span className="text-muted-foreground">
                      {item.count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary/70"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
