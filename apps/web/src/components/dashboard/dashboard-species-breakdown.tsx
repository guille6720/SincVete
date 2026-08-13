import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { SPECIES_EMOJI, type DashboardSummary } from '@sincvete/shared';

interface DashboardSpeciesBreakdownProps {
  summary: DashboardSummary;
}

export function DashboardSpeciesBreakdown({ summary }: DashboardSpeciesBreakdownProps) {
  const total = summary.speciesCounts.reduce((acc, item) => acc + item.count, 0);

  const barColors = [
    'bg-teal-500',
    'bg-sky-500',
    'bg-amber-500',
    'bg-rose-500',
    'bg-emerald-500',
    'bg-indigo-500',
  ];

  return (
    <Card className="border-teal-200/70 bg-white/90 shadow-sm backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="text-lg">Pacientes por especie</CardTitle>
        <CardDescription>Distribución de pacientes activos</CardDescription>
      </CardHeader>
      <CardContent>
        {summary.speciesCounts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay pacientes registrados.</p>
        ) : (
          <ul className="space-y-3">
            {summary.speciesCounts.map((item, index) => {
              const pct = total > 0 ? Math.round((item.count / total) * 100) : 0;
              return (
                <li key={item.species} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <Link
                      href={`/pacientes?species=${encodeURIComponent(item.species)}`}
                      className="font-medium hover:text-teal-700 hover:underline"
                    >
                      {SPECIES_EMOJI[item.species]} {item.species}
                    </Link>
                    <span className="text-muted-foreground">
                      {item.count} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-full bg-teal-50">
                    <div
                      className={`h-full rounded-full ${barColors[index % barColors.length]}`}
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
