'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { completeConsultationAction, saveConsultationDraft } from '@/actions/consultations';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  CLINICAL_FIELD_LABELS,
  CONSULTATION_STATUS_LABELS,
  CONSULTATION_STATUS_VARIANT,
  SPECIES_EMOJI,
  formatClinicalEntryDateTime,
  type ConsultationListRow,
} from '@sincvete/shared';

interface ConsultationSoapFormProps {
  consultation: ConsultationListRow;
  canWriteBilling?: boolean;
}

export function ConsultationSoapForm({
  consultation,
  canWriteBilling = false,
}: ConsultationSoapFormProps) {
  const saveAction = saveConsultationDraft.bind(null, consultation.id);
  const completeAction = completeConsultationAction.bind(null, consultation.id);
  const [saveState, saveFormAction, savePending] = useActionState(saveAction, null);
  const [completeState, completeFormAction, completePending] = useActionState(completeAction, null);

  const pending = savePending || completePending;
  const state = completeState ?? saveState;

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle>
            {SPECIES_EMOJI[consultation.patient_species]} {consultation.patient_name}
          </CardTitle>
          <Badge variant={CONSULTATION_STATUS_VARIANT[consultation.status]}>
            {CONSULTATION_STATUS_LABELS[consultation.status]}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {formatClinicalEntryDateTime(consultation.started_at)} · {consultation.owner_full_name}
          {consultation.veterinarian_name ? ` · ${consultation.veterinarian_name}` : ''}
        </p>
      </CardHeader>
      <CardContent>
        <form className="grid max-w-3xl gap-4">
          <div className="space-y-2">
            <Label htmlFor="title">Motivo</Label>
            <Input id="title" name="title" defaultValue={consultation.title ?? ''} />
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
                defaultValue={consultation.weight_kg ?? ''}
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
                defaultValue={consultation.temperature_c ?? ''}
              />
            </div>
          </div>

          <SoapField
            id="anamnesis"
            name="anamnesis"
            label={CLINICAL_FIELD_LABELS.anamnesis}
            defaultValue={consultation.anamnesis ?? ''}
          />
          <SoapField
            id="physicalExam"
            name="physicalExam"
            label={CLINICAL_FIELD_LABELS.physicalExam}
            defaultValue={consultation.physical_exam ?? ''}
          />
          <SoapField
            id="diagnosis"
            name="diagnosis"
            label={CLINICAL_FIELD_LABELS.diagnosis}
            defaultValue={consultation.diagnosis ?? ''}
          />
          <SoapField
            id="treatment"
            name="treatment"
            label={CLINICAL_FIELD_LABELS.treatment}
            defaultValue={consultation.treatment ?? ''}
          />
          <SoapField
            id="plan"
            name="plan"
            label={CLINICAL_FIELD_LABELS.plan}
            defaultValue={consultation.plan ?? ''}
          />
          <SoapField
            id="notes"
            name="notes"
            label="Notas adicionales"
            defaultValue={consultation.notes ?? ''}
            rows={2}
          />

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          {saveState?.success && !completeState?.success && (
            <p className="text-sm text-emerald-600">Borrador guardado</p>
          )}
          {completeState?.success && (
            <p className="text-sm text-emerald-600">Consulta completada e historia actualizada</p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button formAction={saveFormAction} variant="outline" disabled={pending}>
              {savePending ? 'Guardando...' : 'Guardar borrador'}
            </Button>
            <Button formAction={completeFormAction} disabled={pending}>
              {completePending ? 'Completando...' : 'Completar consulta'}
            </Button>
            <Button variant="ghost" asChild>
              <Link href="/consultas">Volver a la cola</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link
                href={`/internacion/nueva?patientId=${consultation.patient_id}&consultationId=${consultation.id}`}
              >
                Internar
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link
                href={`/vacunacion/nueva?patientId=${consultation.patient_id}&consultationId=${consultation.id}`}
              >
                Vacunar
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link
                href={`/cirugias/nueva?patientId=${consultation.patient_id}&consultationId=${consultation.id}`}
              >
                Cirugía
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link
                href={`/laboratorio/nueva?patientId=${consultation.patient_id}&consultationId=${consultation.id}`}
              >
                Laboratorio
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link
                href={`/farmacia/nueva?patientId=${consultation.patient_id}&consultationId=${consultation.id}`}
              >
                Recetar
              </Link>
            </Button>
            <Button variant="outline" asChild>
              <Link
                href={`/imagenes/nueva?patientId=${consultation.patient_id}&consultationId=${consultation.id}`}
              >
                Imagen
              </Link>
            </Button>
            {canWriteBilling && (
              <Button variant="outline" asChild>
                <Link
                  href={`/facturacion/nueva?patientId=${consultation.patient_id}&consultationId=${consultation.id}`}
                >
                  Facturar
                </Link>
              </Button>
            )}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function SoapField({
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
