'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { createClinicalEntry, updateClinicalEntry } from '@/actions/clinical-entries';
import { PatientPicker } from '@/components/appointments/patient-picker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  CLINICAL_ENTRY_TYPES,
  CLINICAL_ENTRY_TYPE_LABELS,
  CLINICAL_FIELD_LABELS,
  toLocalDateTimeInput,
  type ClinicalEntryListRow,
} from '@sincvete/shared';

interface ClinicalEntryFormProps {
  entry?: ClinicalEntryListRow;
  branches: Array<{ id: string; name: string }>;
  defaultBranchId?: string | null;
  defaultPatientId?: string;
  defaultPatientName?: string;
  defaultOwnerId?: string;
  defaultOwnerName?: string;
  defaultEntryDate?: string;
}

export function ClinicalEntryForm({
  entry,
  branches,
  defaultBranchId,
  defaultPatientId,
  defaultPatientName,
  defaultOwnerId,
  defaultOwnerName,
  defaultEntryDate,
}: ClinicalEntryFormProps) {
  const action = entry
    ? updateClinicalEntry.bind(null, entry.id)
    : createClinicalEntry;
  const [state, formAction, pending] = useActionState(action, null);

  const entryDateDefault = entry?.entry_date
    ? toLocalDateTimeInput(entry.entry_date)
    : defaultEntryDate ?? toLocalDateTimeInput(new Date().toISOString());

  return (
    <Card>
      <CardHeader>
        <CardTitle>{entry ? 'Editar entrada clínica' : 'Nueva entrada clínica'}</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid max-w-3xl gap-4">
          <PatientPicker
            defaultPatientId={entry?.patient_id ?? defaultPatientId}
            defaultPatientName={entry?.patient_name ?? defaultPatientName}
            defaultOwnerId={entry?.owner_id ?? defaultOwnerId}
            defaultOwnerName={entry?.owner_full_name ?? defaultOwnerName}
            error={state?.fieldErrors?.patientId?.[0] ?? state?.fieldErrors?.ownerId?.[0]}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="entryDate">Fecha y hora *</Label>
              <Input
                id="entryDate"
                name="entryDate"
                type="datetime-local"
                required
                defaultValue={entryDateDefault}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="entryType">Tipo de entrada</Label>
              <Select
                id="entryType"
                name="entryType"
                defaultValue={entry?.entry_type ?? 'consulta'}
              >
                {CLINICAL_ENTRY_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {CLINICAL_ENTRY_TYPE_LABELS[type]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {branches.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="branchId">Sucursal *</Label>
              <Select
                id="branchId"
                name="branchId"
                required
                defaultValue={entry?.branch_id ?? defaultBranchId ?? ''}
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
            <Label htmlFor="title">Motivo / título</Label>
            <Input id="title" name="title" defaultValue={entry?.title ?? ''} />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="weightKg">{CLINICAL_FIELD_LABELS.weightKg}</Label>
              <Input
                id="weightKg"
                name="weightKg"
                type="number"
                step="0.01"
                min="0"
                defaultValue={entry?.weight_kg ?? ''}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="temperatureC">{CLINICAL_FIELD_LABELS.temperatureC}</Label>
              <Input
                id="temperatureC"
                name="temperatureC"
                type="number"
                step="0.1"
                min="30"
                max="45"
                defaultValue={entry?.temperature_c ?? ''}
              />
            </div>
          </div>

          <ClinicalTextField
            id="anamnesis"
            name="anamnesis"
            label={CLINICAL_FIELD_LABELS.anamnesis}
            defaultValue={entry?.anamnesis ?? ''}
          />
          <ClinicalTextField
            id="physicalExam"
            name="physicalExam"
            label={CLINICAL_FIELD_LABELS.physicalExam}
            defaultValue={entry?.physical_exam ?? ''}
          />
          <ClinicalTextField
            id="diagnosis"
            name="diagnosis"
            label={CLINICAL_FIELD_LABELS.diagnosis}
            defaultValue={entry?.diagnosis ?? ''}
          />
          <ClinicalTextField
            id="treatment"
            name="treatment"
            label={CLINICAL_FIELD_LABELS.treatment}
            defaultValue={entry?.treatment ?? ''}
          />
          <ClinicalTextField
            id="plan"
            name="plan"
            label={CLINICAL_FIELD_LABELS.plan}
            defaultValue={entry?.plan ?? ''}
          />
          <ClinicalTextField
            id="notes"
            name="notes"
            label="Notas adicionales"
            defaultValue={entry?.notes ?? ''}
            rows={2}
          />

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          {state?.success && entry && (
            <p className="text-sm text-emerald-600">Entrada actualizada correctamente</p>
          )}

          <div className="flex gap-2">
            <Button type="submit" isPending={pending}>
              {pending ? 'Guardando...' : entry ? 'Guardar cambios' : 'Registrar entrada'}
            </Button>
            <Button variant="outline" asChild>
              <Link href={entry ? `/historia-clinica/${entry.id}` : '/historia-clinica'}>
                Cancelar
              </Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function ClinicalTextField({
  id,
  name,
  label,
  defaultValue,
  rows = 3,
}: {
  id: string;
  name: string;
  label: string;
  defaultValue: string;
  rows?: number;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Textarea id={id} name={name} defaultValue={defaultValue} rows={rows} />
    </div>
  );
}
