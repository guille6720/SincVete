'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { admitHospitalization } from '@/actions/hospitalizations';
import { PatientPicker } from '@/components/appointments/patient-picker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { HOSPITALIZATION_ACTIVE_STATUSES, HOSPITALIZATION_STATUS_LABELS } from '@sincvete/shared';

interface HospitalizationAdmitFormProps {
  branches: Array<{ id: string; name: string }>;
  defaultBranchId?: string | null;
  defaultPatientId?: string;
  defaultPatientName?: string;
  defaultOwnerId?: string;
  defaultOwnerName?: string;
  defaultConsultationId?: string;
}

export function HospitalizationAdmitForm({
  branches,
  defaultBranchId,
  defaultPatientId,
  defaultPatientName,
  defaultOwnerId,
  defaultOwnerName,
  defaultConsultationId,
}: HospitalizationAdmitFormProps) {
  const [state, formAction, pending] = useActionState(admitHospitalization, null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Admitir internación</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid max-w-2xl gap-4">
          {defaultConsultationId && (
            <input type="hidden" name="consultationId" value={defaultConsultationId} />
          )}

          <PatientPicker
            defaultPatientId={defaultPatientId}
            defaultPatientName={defaultPatientName}
            defaultOwnerId={defaultOwnerId}
            defaultOwnerName={defaultOwnerName}
            error={state?.fieldErrors?.patientId?.[0] ?? state?.fieldErrors?.ownerId?.[0]}
          />

          {branches.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="branchId">Sucursal *</Label>
              <Select id="branchId" name="branchId" required defaultValue={defaultBranchId ?? ''}>
                <option value="">—</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="status">Estado *</Label>
              <Select id="status" name="status" defaultValue="internado">
                {HOSPITALIZATION_ACTIVE_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {HOSPITALIZATION_STATUS_LABELS[status]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="cage">Jaula / box</Label>
              <Input id="cage" name="cage" placeholder="Box 3, jaula A..." maxLength={50} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="reason">Motivo *</Label>
            <Input
              id="reason"
              name="reason"
              required
              placeholder="Vómitos, postquirúrgico, observación..."
            />
            {state?.fieldErrors?.reason?.[0] && (
              <p className="text-sm text-destructive">{state.fieldErrors.reason[0]}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="diagnosis">Diagnóstico presuntivo</Label>
            <Textarea id="diagnosis" name="diagnosis" rows={3} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="treatmentPlan">Plan de tratamiento</Label>
            <Textarea id="treatmentPlan" name="treatmentPlan" rows={3} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" name="notes" rows={2} />
          </div>

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? 'Admitiendo...' : 'Admitir'}
            </Button>
            <Button variant="outline" asChild>
              <Link href="/internacion">Cancelar</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
