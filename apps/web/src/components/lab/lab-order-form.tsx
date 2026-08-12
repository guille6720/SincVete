'use client';

import { useActionState, useMemo, useState } from 'react';
import Link from 'next/link';
import { createLabOrder } from '@/actions/lab';
import { PatientPicker } from '@/components/appointments/patient-picker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  LAB_PRIORITIES,
  LAB_PRIORITY_LABELS,
  LAB_SAMPLE_TYPES,
  LAB_SAMPLE_TYPE_LABELS,
  LAB_TEST_PRESETS,
} from '@sincvete/shared';

interface LabOrderFormProps {
  branches: Array<{ id: string; name: string }>;
  defaultBranchId?: string | null;
  defaultPatientId?: string;
  defaultPatientName?: string;
  defaultOwnerId?: string;
  defaultOwnerName?: string;
  defaultConsultationId?: string;
}

export function LabOrderForm({
  branches,
  defaultBranchId,
  defaultPatientId,
  defaultPatientName,
  defaultOwnerId,
  defaultOwnerName,
  defaultConsultationId,
}: LabOrderFormProps) {
  const [state, formAction, pending] = useActionState(createLabOrder, null);
  const [presetId, setPresetId] = useState<string>(LAB_TEST_PRESETS[0].id);
  const preset = useMemo(
    () => LAB_TEST_PRESETS.find((item) => item.id === presetId) ?? LAB_TEST_PRESETS[0],
    [presetId]
  );
  const [title, setTitle] = useState<string>(preset.title);
  const [sampleType, setSampleType] = useState<string>(preset.sampleType);
  const [selectedTests, setSelectedTests] = useState<string[]>([...preset.tests]);

  const applyPreset = (id: string) => {
    const next = LAB_TEST_PRESETS.find((item) => item.id === id) ?? LAB_TEST_PRESETS[0];
    setPresetId(next.id);
    setTitle(next.title);
    setSampleType(next.sampleType);
    setSelectedTests([...next.tests]);
  };

  const toggleTest = (test: string) => {
    setSelectedTests((current) =>
      current.includes(test) ? current.filter((item) => item !== test) : [...current, test]
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Nueva orden de laboratorio</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid max-w-2xl gap-4">
          {defaultConsultationId && (
            <input type="hidden" name="consultationId" value={defaultConsultationId} />
          )}
          <input type="hidden" name="title" value={title} />
          {selectedTests.map((test) => (
            <input key={test} type="hidden" name="tests" value={test} />
          ))}

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
            <Label htmlFor="preset">Plantilla *</Label>
            <Select id="preset" value={presetId} onChange={(e) => applyPreset(e.target.value)}>
              {LAB_TEST_PRESETS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title}
                </option>
              ))}
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="titleInput">Título *</Label>
            <Input
              id="titleInput"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
            {state?.fieldErrors?.title?.[0] && (
              <p className="text-sm text-destructive">{state.fieldErrors.title[0]}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="priority">Prioridad *</Label>
              <Select id="priority" name="priority" defaultValue="rutina">
                {LAB_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {LAB_PRIORITY_LABELS[priority]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sampleType">Muestra</Label>
              <Select
                id="sampleType"
                name="sampleType"
                value={sampleType}
                onChange={(e) => setSampleType(e.target.value)}
              >
                <option value="">—</option>
                {LAB_SAMPLE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {LAB_SAMPLE_TYPE_LABELS[type]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {preset.tests.length > 0 && (
            <div className="space-y-2">
              <Label>Estudios de la plantilla</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {preset.tests.map((test) => (
                  <label key={test} className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selectedTests.includes(test)}
                      onChange={() => toggleTest(test)}
                    />
                    {test}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="customTests">Estudios adicionales (uno por línea)</Label>
            <Textarea
              id="customTests"
              name="customTests"
              rows={3}
              placeholder={preset.tests.length === 0 ? 'Ej. Cortisol basal' : undefined}
            />
            {state?.fieldErrors?.tests?.[0] && (
              <p className="text-sm text-destructive">{state.fieldErrors.tests[0]}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" name="notes" rows={2} />
          </div>

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? 'Creando...' : 'Crear orden'}
            </Button>
            <Button variant="outline" asChild>
              <Link href="/laboratorio">Cancelar</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
