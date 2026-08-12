'use client';

import { useActionState } from 'react';
import { dischargeHospitalizationAction } from '@/actions/hospitalizations';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { HOSPITALIZATION_OUTCOMES, HOSPITALIZATION_OUTCOME_LABELS } from '@sincvete/shared';

interface HospitalizationDischargeFormProps {
  hospitalizationId: string;
}

export function HospitalizationDischargeForm({
  hospitalizationId,
}: HospitalizationDischargeFormProps) {
  const action = dischargeHospitalizationAction.bind(null, hospitalizationId);
  const [state, formAction, pending] = useActionState(action, null);

  return (
    <form action={formAction} className="grid gap-4">
      <div className="space-y-2">
        <Label htmlFor="outcome">Resultado *</Label>
        <Select id="outcome" name="outcome" required defaultValue="alta">
          {HOSPITALIZATION_OUTCOMES.map((outcome) => (
            <option key={outcome} value={outcome}>
              {HOSPITALIZATION_OUTCOME_LABELS[outcome]}
            </option>
          ))}
        </Select>
      </div>

      <div className="space-y-2">
        <Label htmlFor="summary">Resumen de alta</Label>
        <Textarea
          id="summary"
          name="summary"
          rows={4}
          placeholder="Evolución, indicaciones al alta, pronóstico..."
        />
      </div>

      {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

      <div>
        <Button type="submit" variant="destructive" disabled={pending}>
          {pending ? 'Cerrando...' : 'Cerrar internación'}
        </Button>
      </div>
    </form>
  );
}
