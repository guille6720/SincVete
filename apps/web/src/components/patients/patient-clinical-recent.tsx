'use client';

import Link from 'next/link';
import { ClipboardList, ChevronRight } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  CLINICAL_ENTRY_TYPE_LABELS,
  CLINICAL_ENTRY_TYPE_VARIANT,
  formatClinicalEntryDateTime,
  type ClinicalEntryListRow,
} from '@sincvete/shared';

interface PatientClinicalRecentProps {
  patientId: string;
  entries: ClinicalEntryListRow[];
  total: number;
  canWrite: boolean;
}

export function PatientClinicalRecent({
  patientId,
  entries,
  total,
  canWrite,
}: PatientClinicalRecentProps) {
  const historiaHref = `/pacientes/${patientId}/historia`;
  const remaining = Math.max(0, total - entries.length);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base">Últimas evoluciones</CardTitle>
          <p className="text-sm text-muted-foreground">
            {total === 0
              ? 'Sin entradas clínicas'
              : `${total} entrada${total !== 1 ? 's' : ''} en total`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canWrite && (
            <Button size="sm" asChild>
              <Link href={`/historia-clinica/nuevo?patientId=${patientId}`}>Nueva entrada</Link>
            </Button>
          )}
          <Button variant="outline" size="sm" asChild>
            <Link href={historiaHref}>
              <ClipboardList className="mr-2 h-4 w-4" />
              Ver historia
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Todavía no hay evoluciones registradas para este paciente.
          </p>
        ) : (
          <>
            {entries.map((entry) => (
              <Link
                key={entry.id}
                href={`/historia-clinica/${entry.id}`}
                className="flex items-start justify-between gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/20"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={CLINICAL_ENTRY_TYPE_VARIANT[entry.entry_type]}>
                      {CLINICAL_ENTRY_TYPE_LABELS[entry.entry_type]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatClinicalEntryDateTime(entry.entry_date)}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm font-medium">
                    {entry.title || entry.diagnosis || CLINICAL_ENTRY_TYPE_LABELS[entry.entry_type]}
                  </p>
                  {entry.diagnosis && entry.title && (
                    <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
                      {entry.diagnosis}
                    </p>
                  )}
                </div>
                <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
            {remaining > 0 && (
              <Button variant="outline" className="w-full" asChild>
                <Link href={historiaHref}>
                  Ver anteriores ({remaining} más)
                </Link>
              </Button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
