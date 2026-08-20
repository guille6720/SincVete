'use client';

import Link from 'next/link';
import { useState } from 'react';
import { exportSuperadminFollowUpsCsv } from '@/actions/superadmin';
import type { RecommendationFollowUpRow } from '@/lib/plan-recommendations';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { usePendingAction } from '@/lib/hooks/use-pending-action';

function isOverdue(iso: string) {
  return new Date(iso).getTime() < Date.now();
}

export function SuperadminFollowUpQueue({ rows }: { rows: RecommendationFollowUpRow[] }) {
  const [pending, run] = usePendingAction();
  const [message, setMessage] = useState<string | null>(null);

  if (rows.length === 0) return null;

  async function downloadCsv() {
    setMessage(null);
    const result = await run(() => exportSuperadminFollowUpsCsv());
    if (!result) return;
    if (!result.success || !result.data?.csv) {
      setMessage(result.error ?? 'No se pudo exportar');
      return;
    }
    const blob = new Blob([result.data.csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `syncvete-followups-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage(`${result.data.rowCount} seguimientos exportados`);
  }

  return (
    <Card id="seguimientos-comerciales">
      <CardHeader>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <CardTitle>Seguimientos comerciales</CardTitle>
            <CardDescription>
              Fechas de follow-up cargadas por Superadmin. No cambian el plan.
            </CardDescription>
          </div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => void downloadCsv()}
          >
            Exportar CSV
          </Button>
        </div>
        {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}
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
