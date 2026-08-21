'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { SuperadminMigrationOpsQueue } from '@/actions/data-migration';
import {
  forceCancelDataExportJobAction,
  forceCancelDataImportBatchAction,
} from '@/actions/data-migration';
import { usePendingAction } from '@/lib/hooks/use-pending-action';

export function SuperadminDataMigrationOpsQueue({
  queue,
}: {
  queue: SuperadminMigrationOpsQueue | null;
}) {
  const router = useRouter();
  const [pending, run] = usePendingAction();

  async function forceCancelImport(batchId: string) {
    const form = new FormData();
    form.set('batchId', batchId);
    await run(() => forceCancelDataImportBatchAction(form));
    router.refresh();
  }

  async function forceCancelExport(jobId: string) {
    const form = new FormData();
    form.set('jobId', jobId);
    await run(() => forceCancelDataExportJobAction(form));
    router.refresh();
  }

  if (!queue) {
    return (
      <Card id="data-migration-ops">
        <CardHeader>
          <CardTitle>Cola Import / Export</CardTitle>
          <CardDescription>Sin datos de migración o RPC no aplicada aún.</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card id="data-migration-ops">
      <CardHeader>
        <CardTitle>Cola Import / Export</CardTitle>
        <CardDescription>
          Jobs fallidos / en cola / en curso. Superadmin puede forzar cancelación.
          {queue.generatedAt ? ` · ${queue.generatedAt}` : ''}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 text-sm md:grid-cols-2">
        <div className="space-y-2">
          <p className="font-medium">Imports</p>
          {queue.imports.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin pendientes.</p>
          ) : (
            <ul className="space-y-1">
              {queue.imports.slice(0, 12).map((row) => (
                <li key={String(row.id)} className="border-b py-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      className="font-medium underline-offset-2 hover:underline"
                      href={`/superadmin/organizaciones/${String(row.organization_id)}#data-migration`}
                    >
                      {String(row.organization_name ?? row.organization_id)}
                    </Link>
                    <Badge variant="default">{String(row.status)}</Badge>
                    {['queued', 'importing'].includes(String(row.status)) ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => void forceCancelImport(String(row.id))}
                      >
                        Forzar cancel
                      </Button>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {String(row.import_type)} · fallidos {String(row.failed_records ?? 0)}
                    {row.error_message ? ` · ${String(row.error_message)}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div className="space-y-2">
          <p className="font-medium">Exports</p>
          {queue.exports.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin pendientes.</p>
          ) : (
            <ul className="space-y-1">
              {queue.exports.slice(0, 12).map((row) => (
                <li key={String(row.id)} className="border-b py-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      className="font-medium underline-offset-2 hover:underline"
                      href={`/superadmin/organizaciones/${String(row.organization_id)}#data-migration`}
                    >
                      {String(row.organization_name ?? row.organization_id)}
                    </Link>
                    <Badge variant="default">{String(row.status)}</Badge>
                    {['queued', 'running'].includes(String(row.status)) ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => void forceCancelExport(String(row.id))}
                      >
                        Forzar cancel
                      </Button>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {String(row.export_type)} · {String(row.format)}
                    {row.error_message ? ` · ${String(row.error_message)}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
