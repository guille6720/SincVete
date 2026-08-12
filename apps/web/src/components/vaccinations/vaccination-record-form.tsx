'use client';

import { useActionState, useMemo, useState } from 'react';
import Link from 'next/link';
import { recordVaccinationAction } from '@/actions/vaccinations';
import { PatientPicker } from '@/components/appointments/patient-picker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  VACCINATION_ROUTES,
  VACCINATION_ROUTE_LABELS,
  VACCINE_PRESETS,
  addCalendarMonths,
  todayInAppTimezone,
  type PatientSpecies,
} from '@sincvete/shared';

interface VaccinationRecordFormProps {
  branches: Array<{ id: string; name: string }>;
  defaultBranchId?: string | null;
  defaultPatientId?: string;
  defaultPatientName?: string;
  defaultOwnerId?: string;
  defaultOwnerName?: string;
  defaultConsultationId?: string;
  defaultSpecies?: PatientSpecies;
}

export function VaccinationRecordForm({
  branches,
  defaultBranchId,
  defaultPatientId,
  defaultPatientName,
  defaultOwnerId,
  defaultOwnerName,
  defaultConsultationId,
  defaultSpecies,
}: VaccinationRecordFormProps) {
  const [state, formAction, pending] = useActionState(recordVaccinationAction, null);
  const today = todayInAppTimezone();
  const [preset, setPreset] = useState<string>(VACCINE_PRESETS[0].name);
  const [vaccineName, setVaccineName] = useState<string>(VACCINE_PRESETS[0].name);
  const [administeredAt, setAdministeredAt] = useState(today);
  const [nextDueAt, setNextDueAt] = useState(
    addCalendarMonths(today, VACCINE_PRESETS[0].intervalMonths)
  );

  const presets = useMemo(() => {
    if (!defaultSpecies) return VACCINE_PRESETS;
    return VACCINE_PRESETS.filter(
      (item) => item.species.length === 0 || (item.species as readonly string[]).includes(defaultSpecies)
    );
  }, [defaultSpecies]);

  const applyPreset = (name: string, administered: string) => {
    const selected = VACCINE_PRESETS.find((item) => item.name === name);
    setPreset(name);
    if (name === 'Otra') {
      setVaccineName('');
    } else {
      setVaccineName(name);
    }
    if (selected) {
      setNextDueAt(addCalendarMonths(administered, selected.intervalMonths));
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Registrar vacunación</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid max-w-2xl gap-4">
          {defaultConsultationId && (
            <input type="hidden" name="consultationId" value={defaultConsultationId} />
          )}
          <input type="hidden" name="vaccineName" value={vaccineName} />

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
            <Label htmlFor="preset">Vacuna *</Label>
            <Select
              id="preset"
              value={preset}
              onChange={(e) => applyPreset(e.target.value, administeredAt)}
            >
              {presets.map((item) => (
                <option key={item.name} value={item.name}>
                  {item.name}
                </option>
              ))}
            </Select>
          </div>

          {preset === 'Otra' && (
            <div className="space-y-2">
              <Label htmlFor="customVaccineName">Nombre de la vacuna *</Label>
              <Input
                id="customVaccineName"
                value={vaccineName}
                onChange={(e) => setVaccineName(e.target.value)}
                placeholder="Nombre comercial o protocolo"
                required
              />
            </div>
          )}
          {state?.fieldErrors?.vaccineName?.[0] && (
            <p className="text-sm text-destructive">{state.fieldErrors.vaccineName[0]}</p>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="administeredAt">Fecha de aplicación *</Label>
              <Input
                id="administeredAt"
                name="administeredAt"
                type="date"
                required
                value={administeredAt}
                onChange={(e) => {
                  const value = e.target.value;
                  setAdministeredAt(value);
                  const selected = VACCINE_PRESETS.find((item) => item.name === preset);
                  if (selected) {
                    setNextDueAt(addCalendarMonths(value, selected.intervalMonths));
                  }
                }}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="nextDueAt">Próximo refuerzo</Label>
              <Input
                id="nextDueAt"
                name="nextDueAt"
                type="date"
                value={nextDueAt}
                onChange={(e) => setNextDueAt(e.target.value)}
              />
              {state?.fieldErrors?.nextDueAt?.[0] && (
                <p className="text-sm text-destructive">{state.fieldErrors.nextDueAt[0]}</p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="manufacturer">Laboratorio</Label>
              <Input id="manufacturer" name="manufacturer" maxLength={120} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="lotNumber">Lote</Label>
              <Input id="lotNumber" name="lotNumber" maxLength={80} />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="route">Vía</Label>
            <Select id="route" name="route" defaultValue="">
              <option value="">—</option>
              {VACCINATION_ROUTES.map((route) => (
                <option key={route} value={route}>
                  {VACCINATION_ROUTE_LABELS[route]}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" name="notes" rows={2} />
          </div>

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? 'Registrando...' : 'Registrar vacuna'}
            </Button>
            <Button variant="outline" asChild>
              <Link href="/vacunacion">Cancelar</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
