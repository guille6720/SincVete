'use client';

import { useActionState } from 'react';
import { updateHospitalization } from '@/actions/hospitalizations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  HOSPITALIZATION_ACTIVE_STATUSES,
  HOSPITALIZATION_STATUS_LABELS,
  type HospitalizationListRow,
} from '@sincvete/shared';

interface HospitalizationUpdateFormProps {
  stay: HospitalizationListRow;
}

export function HospitalizationUpdateForm({ stay }: HospitalizationUpdateFormProps) {
  const action = updateHospitalization.bind(null, stay.id);
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="status">Estado</Label>
          <Select id="status" name="status" defaultValue={stay.status}>
            {HOSPITALIZATION_ACTIVE_STATUSES.map((status) => (
              <option key={status} value={status}>
                {HOSPITALIZATION_STATUS_LABELS[status]}
              </option>
            ))}
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="cage">Jaula / box</Label>
          <Input id="cage" name="cage" defaultValue={stay.cage ?? ''} maxLength={50} />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="reason">Motivo *</Label>
        <Input id="reason" name="reason" required defaultValue={stay.reason} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="diagnosis">Diagnóstico</Label>
        <Textarea id="diagnosis" name="diagnosis" rows={3} defaultValue={stay.diagnosis ?? ''} />
      </div>

      <div className="space-y-2">
        <Label htmlFor="treatmentPlan">Plan de tratamiento</Label>
        <Textarea
          id="treatmentPlan"
          name="treatmentPlan"
          rows={3}
          defaultValue={stay.treatment_plan ?? ''}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notas</Label>
        <Textarea id="notes" name="notes" rows={2} defaultValue={stay.notes ?? ''} />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
      {state?.success && <p className="text-sm text-muted-foreground">Cambios guardados.</p>}

      <div>
        <Button type="submit" disabled={pending}>
          {pending ? 'Guardando...' : 'Guardar plan'}
        </Button>
      </div>
    </form>
  );
}
