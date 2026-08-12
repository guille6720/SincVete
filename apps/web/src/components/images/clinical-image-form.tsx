'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { uploadClinicalImage } from '@/actions/images';
import { PatientPicker } from '@/components/appointments/patient-picker';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  CLINICAL_IMAGE_ACCEPT,
  CLINICAL_IMAGE_KINDS,
  CLINICAL_IMAGE_KIND_LABELS,
} from '@sincvete/shared';

interface ClinicalImageFormProps {
  branches: Array<{ id: string; name: string }>;
  defaultBranchId?: string | null;
  defaultPatientId?: string;
  defaultPatientName?: string;
  defaultOwnerId?: string;
  defaultOwnerName?: string;
  defaultConsultationId?: string;
  defaultClinicalEntryId?: string;
}

export function ClinicalImageForm({
  branches,
  defaultBranchId,
  defaultPatientId,
  defaultPatientName,
  defaultOwnerId,
  defaultOwnerName,
  defaultConsultationId,
  defaultClinicalEntryId,
}: ClinicalImageFormProps) {
  const [state, formAction, pending] = useActionState(uploadClinicalImage, null);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Subir imagen o documento</CardTitle>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="grid max-w-2xl gap-4">
          {defaultConsultationId && (
            <input type="hidden" name="consultationId" value={defaultConsultationId} />
          )}
          {defaultClinicalEntryId && (
            <input type="hidden" name="clinicalEntryId" value={defaultClinicalEntryId} />
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
              <Label htmlFor="branchId">Sucursal</Label>
              <Select id="branchId" name="branchId" defaultValue={defaultBranchId ?? ''}>
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
              <Label htmlFor="kind">Tipo *</Label>
              <Select id="kind" name="kind" defaultValue="foto">
                {CLINICAL_IMAGE_KINDS.map((kind) => (
                  <option key={kind} value={kind}>
                    {CLINICAL_IMAGE_KIND_LABELS[kind]}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="takenAt">Fecha del estudio</Label>
              <Input id="takenAt" name="takenAt" type="date" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="file">Archivo * (JPG, PNG, WebP, GIF o PDF · máx. 10 MB)</Label>
            <Input id="file" name="file" type="file" accept={CLINICAL_IMAGE_ACCEPT} required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">Título</Label>
            <Input id="title" name="title" placeholder="Ej. Tórax laterolateral" />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea id="notes" name="notes" rows={2} />
          </div>

          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}

          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>
              {pending ? 'Subiendo...' : 'Subir'}
            </Button>
            <Button variant="outline" asChild>
              <Link href="/imagenes">Cancelar</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
