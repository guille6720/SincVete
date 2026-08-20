'use client';

import Link from 'next/link';
import type { RecommendationFollowUpRow } from '@/lib/plan-recommendations';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

function isOverdue(iso: string) {
  return new Date(iso).getTime() < Date.now();
}

export function SuperadminFollowUpQueue({ rows }: { rows: RecommendationFollowUpRow[] }) {
  if (rows.length === 0) return null;

  return (
    <Card id="seguimientos-comerciales">
      <CardHeader>
        <CardTitle>Seguimientos comerciales</CardTitle>
        <CardDescription>
          Fechas de follow-up cargadas por Superadmin. No cambian el plan.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        {rows.map((row) => {
          const overdue = isOverdue(row.followUpAt);
          return (
            <div
              key={row.organizationId}
              className="flex flex-wrap items-center justify-between gap-2 border-b py-2 last:border-0"
            >
              <div>
                <Link
                  href={`/superadmin/organizaciones/${row.organizationId}`}
                  className="font-medium hover:underline"
                >
                  {row.organizationName}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {row.currentPlanKey ?? 'sin plan'}
                  {row.recommendedPlanKey ? ` → ${row.recommendedPlanKey}` : ''}
                  {row.commercialNote ? ` · ${row.commercialNote.slice(0, 60)}` : ''}
                </p>
              </div>
              <Badge variant={overdue ? 'destructive' : 'warning'}>
                {overdue ? 'Vencido · ' : ''}
                {new Date(row.followUpAt).toLocaleString('es-AR')}
              </Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
