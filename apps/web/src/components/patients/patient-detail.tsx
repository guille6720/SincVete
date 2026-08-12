'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  BedDouble,
  ClipboardList,
  FlaskConical,
  MessageCircle,
  Pencil,
  Pill,
  Receipt,
  Scissors,
  Syringe,
  Sparkles,
  Trash2,
  Images,
} from 'lucide-react';
import { deletePatient } from '@/actions/patients';
import { PatientVaccineStatus } from '@/components/vaccinations/patient-vaccine-status';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  HOSPITALIZATION_STATUS_LABELS,
  SPECIES_EMOJI,
  buildClinicalAiPath,
  buildWhatsAppComposePath,
  type HospitalizationStatus,
  type Owner,
  type Patient,
  type SurgeryStatus,
  type VaccinationDueRow,
} from '@sincvete/shared';

interface PatientDetailProps {
  patient: Patient;
  owner: Owner | null;
  canWrite: boolean;
  canReadClinical?: boolean;
  canWriteClinical?: boolean;
  canWriteBilling?: boolean;
  canSendWhatsApp?: boolean;
  clinicalEntryCount?: number;
  activeHospitalization?: { id: string; status: HospitalizationStatus } | null;
  activeSurgery?: { id: string; status: SurgeryStatus } | null;
  vaccineStatus?: VaccinationDueRow[];
}

function formatAge(birthDate: string | null): string | null {
  if (!birthDate) return null;
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;

  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    years -= 1;
  }

  if (years >= 1) return `${years} año${years !== 1 ? 's' : ''}`;
  const months = Math.max(
    0,
    (now.getFullYear() - birth.getFullYear()) * 12 + now.getMonth() - birth.getMonth()
  );
  return months > 0 ? `${months} mes${months !== 1 ? 'es' : ''}` : 'Menos de 1 mes';
}

export function PatientDetail({
  patient,
  owner,
  canWrite,
  canReadClinical = false,
  canWriteClinical = false,
  canWriteBilling = false,
  canSendWhatsApp = false,
  clinicalEntryCount = 0,
  activeHospitalization = null,
  activeSurgery = null,
  vaccineStatus = [],
}: PatientDetailProps) {
  const router = useRouter();
  const age = formatAge(patient.birth_date);

  const handleDelete = async () => {
    if (!confirm('¿Eliminar este paciente? Esta acción no se puede deshacer.')) return;
    const result = await deletePatient(patient.id);
    if (result.success) {
      router.push('/pacientes');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/pacientes">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Link>
        </Button>
        {(canWrite || canReadClinical || canWriteClinical || canSendWhatsApp) && (
          <div className="flex flex-wrap gap-2">
            {canReadClinical && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/pacientes/${patient.id}/historia`}>
                  <ClipboardList className="mr-2 h-4 w-4" />
                  Historia clínica{clinicalEntryCount > 0 ? ` (${clinicalEntryCount})` : ''}
                </Link>
              </Button>
            )}
            {activeHospitalization && canReadClinical ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/internacion/${activeHospitalization.id}`}>
                  <BedDouble className="mr-2 h-4 w-4" />
                  Ver internación
                </Link>
              </Button>
            ) : (
              canWriteClinical &&
              !patient.is_deceased && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/internacion/nueva?patientId=${patient.id}`}>
                    <BedDouble className="mr-2 h-4 w-4" />
                    Internar
                  </Link>
                </Button>
              )
            )}
            {canWriteClinical && !patient.is_deceased && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/vacunacion/nueva?patientId=${patient.id}`}>
                  <Syringe className="mr-2 h-4 w-4" />
                  Vacunar
                </Link>
              </Button>
            )}
            {activeSurgery && canReadClinical ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/cirugias/${activeSurgery.id}`}>
                  <Scissors className="mr-2 h-4 w-4" />
                  Ver cirugía
                </Link>
              </Button>
            ) : (
              canWriteClinical &&
              !patient.is_deceased && (
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/cirugias/nueva?patientId=${patient.id}`}>
                    <Scissors className="mr-2 h-4 w-4" />
                    Cirugía
                  </Link>
                </Button>
              )
            )}
            {canWriteClinical && !patient.is_deceased && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/laboratorio/nueva?patientId=${patient.id}`}>
                  <FlaskConical className="mr-2 h-4 w-4" />
                  Laboratorio
                </Link>
              </Button>
            )}
            {canWriteClinical && !patient.is_deceased && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/farmacia/nueva?patientId=${patient.id}`}>
                  <Pill className="mr-2 h-4 w-4" />
                  Recetar
                </Link>
              </Button>
            )}
            {canReadClinical && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/imagenes?patientId=${patient.id}`}>
                  <Images className="mr-2 h-4 w-4" />
                  Imágenes
                </Link>
              </Button>
            )}
            {canWriteClinical && !patient.is_deceased && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/imagenes/nueva?patientId=${patient.id}`}>
                  <Images className="mr-2 h-4 w-4" />
                  Subir imagen
                </Link>
              </Button>
            )}
            {canWriteBilling && (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/facturacion/nueva?patientId=${patient.id}`}>
                  <Receipt className="mr-2 h-4 w-4" />
                  Facturar
                </Link>
              </Button>
            )}
            {canReadClinical && (
              <Button variant="outline" size="sm" asChild>
                <Link
                  href={buildClinicalAiPath({
                    patientId: patient.id,
                    kind: 'patient_summary',
                  })}
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  IA clínica
                </Link>
              </Button>
            )}
            {canSendWhatsApp && (
              <Button variant="outline" size="sm" asChild>
                <Link
                  href={buildWhatsAppComposePath({
                    ownerId: patient.owner_id,
                    patientId: patient.id,
                  })}
                >
                  <MessageCircle className="mr-2 h-4 w-4" />
                  WhatsApp
                </Link>
              </Button>
            )}
            {canWrite && (
              <>
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/pacientes/${patient.id}/editar`}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar
                  </Link>
                </Button>
                <Button variant="destructive" size="sm" onClick={handleDelete}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Eliminar
                </Button>
              </>
            )}
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle>
              {SPECIES_EMOJI[patient.species]} {patient.name}
            </CardTitle>
            {patient.is_deceased ? (
              <Badge variant="destructive">Fallecido</Badge>
            ) : (
              <Badge variant={patient.is_active ? 'success' : 'destructive'}>
                {patient.is_active ? 'Activo' : 'Inactivo'}
              </Badge>
            )}
            {activeHospitalization && (
              <Badge variant="warning">
                {HOSPITALIZATION_STATUS_LABELS[activeHospitalization.status]}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <DetailField
            label="Propietario"
            value={
              owner ? (
                <Link
                  href={`/propietarios/${owner.id}`}
                  className="text-primary hover:underline"
                >
                  {owner.full_name}
                </Link>
              ) : (
                '—'
              )
            }
          />
          <DetailField label="Especie" value={patient.species} />
          <DetailField label="Raza" value={patient.breed} />
          <DetailField label="Sexo" value={patient.sex} />
          <DetailField
            label="Fecha de nacimiento"
            value={
              patient.birth_date
                ? `${patient.birth_date}${age ? ` (${age})` : ''}`
                : null
            }
          />
          <DetailField label="Color" value={patient.color} />
          <DetailField label="Microchip" value={patient.microchip} />
          <DetailField
            label="Castrado / esterilizado"
            value={patient.is_neutered ? 'Sí' : 'No'}
          />
          {patient.is_deceased && (
            <DetailField label="Fecha de fallecimiento" value={patient.deceased_at} />
          )}
          {patient.notes && (
            <div className="sm:col-span-2">
              <DetailField label="Notas" value={patient.notes} />
            </div>
          )}
        </CardContent>
      </Card>

      {canReadClinical && (
        <PatientVaccineStatus
          patientId={patient.id}
          items={vaccineStatus}
          canWrite={canWriteClinical}
          isDeceased={patient.is_deceased}
        />
      )}
    </div>
  );
}

function DetailField({
  label,
  value,
  className,
}: {
  label: string;
  value: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-0.5 text-sm">{value || '—'}</div>
    </div>
  );
}
