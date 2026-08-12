import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  VACCINATION_DUE_STATUS_LABELS,
  VACCINATION_DUE_STATUS_VARIANT,
  formatVaccinationDate,
  type VaccinationDueRow,
} from '@sincvete/shared';

interface PatientVaccineStatusProps {
  patientId: string;
  items: VaccinationDueRow[];
  canWrite: boolean;
  isDeceased: boolean;
}

export function PatientVaccineStatus({
  patientId,
  items,
  canWrite,
  isDeceased,
}: PatientVaccineStatusProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>Vacunación</CardTitle>
        {canWrite && !isDeceased && (
          <Button variant="outline" size="sm" asChild>
            <Link href={`/vacunacion/nueva?patientId=${patientId}`}>Registrar vacuna</Link>
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin vacunas registradas.</p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <Link
                key={item.id}
                href={`/vacunacion/${item.id}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3 hover:bg-muted/20"
              >
                <div>
                  <p className="text-sm font-medium">{item.vaccine_name}</p>
                  <p className="text-xs text-muted-foreground">
                    Aplicada {formatVaccinationDate(item.administered_at)}
                    {item.next_due_at
                      ? ` · Refuerzo ${formatVaccinationDate(item.next_due_at)}`
                      : ''}
                  </p>
                </div>
                <Badge variant={VACCINATION_DUE_STATUS_VARIANT[item.due_status]}>
                  {VACCINATION_DUE_STATUS_LABELS[item.due_status]}
                </Badge>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
