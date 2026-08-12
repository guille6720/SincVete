'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { startWalkInConsultation } from '@/actions/consultations';
import { PatientPicker } from '@/components/appointments/patient-picker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';

interface ConsultationStartFormProps {
  branches: Array<{ id: string; name: string }>;
  defaultBranchId?: string | null;
  defaultPatientId?: string;
  defaultPatientName?: string;
  defaultOwnerId?: string;
  defaultOwnerName?: string;
}

export function ConsultationStartForm({
  branches,
  defaultBranchId,
  defaultPatientId,
  defaultPatientName,
  defaultOwnerId,
  defaultOwnerName,
}: ConsultationStartFormProps) {
  const [state, formAction, pending] = useActionState(startWalkInConsultation, null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nueva consulta walk-in</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid max-w-2xl gap-4">
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
              <Select
                id="branchId"
                name="branchId"
                required
                defaultValue={defaultBranchId ?? ''}
              >
                <option value="">—</option>
                {branches.map((branch) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">Motivo</Label>
            <Input id="title" name="title" placeholder="Control, emergencia, vacunación..." />
          </div>

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? 'Iniciando...' : 'Iniciar consulta'}
            </Button>
            <Button variant="outline" asChild>
              <Link href="/consultas">Cancelar</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
