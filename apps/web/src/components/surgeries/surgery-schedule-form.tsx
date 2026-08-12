'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { scheduleSurgery } from '@/actions/surgeries';
import { PatientPicker } from '@/components/appointments/patient-picker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  SURGERY_ANESTHESIA_LABELS,
  SURGERY_ANESTHESIA_TYPES,
  SURGERY_ASA_GRADES,
  SURGERY_ASA_LABELS,
  SURGERY_PROCEDURE_PRESETS,
  toLocalDateTimeInput,
} from '@sincvete/shared';

interface SurgeryScheduleFormProps {
  branches: Array<{ id: string; name: string }>;
  defaultBranchId?: string | null;
  defaultPatientId?: string;
  defaultPatientName?: string;
  defaultOwnerId?: string;
  defaultOwnerName?: string;
  defaultConsultationId?: string;
  defaultAppointmentId?: string;
}

export function SurgeryScheduleForm({
  branches,
  defaultBranchId,
  defaultPatientId,
  defaultPatientName,
  defaultOwnerId,
  defaultOwnerName,
  defaultConsultationId,
  defaultAppointmentId,
}: SurgeryScheduleFormProps) {
  const [state, formAction, pending] = useActionState(scheduleSurgery, null);
  const [preset, setPreset] = useState<string>(SURGERY_PROCEDURE_PRESETS[0]);
  const [procedureName, setProcedureName] = useState<string>(SURGERY_PROCEDURE_PRESETS[0]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Programar cirugía</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid max-w-2xl gap-4">
          {defaultConsultationId && (
            <input type="hidden" name="consultationId" value={defaultConsultationId} />
          )}
          {defaultAppointmentId && (
            <input type="hidden" name="appointmentId" value={defaultAppointmentId} />
          )}
          <input type="hidden" name="procedureName" value={procedureName} />

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

          <div className="space-y-2">
            <Label htmlFor="preset">Procedimiento *</Label>
            <Select
              id="preset"
              value={preset}
              onChange={(e) => {
                const value = e.target.value;
                setPreset(value);
                setProcedureName(value === 'Otra' ? '' : value);
              }}
            >
              {SURGERY_PROCEDURE_PRESETS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </Select>
          </div>

          {preset === 'Otra' && (
            <div className="space-y-2">
              <Label htmlFor="customProcedure">Nombre del procedimiento *</Label>
              <Input
                id="customProcedure"
                value={procedureName}
                onChange={(e) => setProcedureName(e.target.value)}
                required
              />
            </div>
          )}
          {state?.fieldErrors?.procedureName?.[0] && (
            <p className="text-sm text-destructive">{state.fieldErrors.procedureName[0]}</p>
          )}

          <div className="space-y-2">
            <Label htmlFor="scheduledAt">Fecha y hora *</Label>
            <Input
              id="scheduledAt"
              name="scheduledAt"
              type="datetime-local"
              required
              defaultValue={toLocalDateTimeInput(new Date().toISOString())}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="anesthesia">Anestesia</Label>
              <Select id="anesthesia" name="anesthesia" defaultValue="">
                <option value="">—</option>
                {SURGERY_ANESTHESIA_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {SURGERY_ANESTHESIA_LABELS[type]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="asa">ASA</Label>
              <Select id="asa" name="asa" defaultValue="">
                <option value="">—</option>
                {SURGERY_ASA_GRADES.map((grade) => (
                  <option key={grade} value={grade}>
                    {SURGERY_ASA_LABELS[grade]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="diagnosis">Diagnóstico</Label>
            <Textarea id="diagnosis" name="diagnosis" rows={2} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="preopNotes">Notas prequirúrgicas</Label>
            <Textarea id="preopNotes" name="preopNotes" rows={3} />
          </div>

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? 'Programando...' : 'Programar'}
            </Button>
            <Button variant="outline" asChild>
              <Link href="/cirugias">Cancelar</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
