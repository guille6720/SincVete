import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import {
  listClinicalEntries,
  canManageClinical,
  canReadClinical,
  countPatientClinicalEntries,
} from '@/actions/clinical-entries';
import { getPatient } from '@/actions/patients';
import { ClinicalEntriesList } from '@/components/clinical/clinical-entries-list';
import { Button } from '@/components/ui/button';
import { SPECIES_EMOJI } from '@sincvete/shared';
import { Suspense } from 'react';

interface PatientHistoriaPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string; search?: string }>;
}

export default async function PatientHistoriaPage({
  params,
  searchParams,
}: PatientHistoriaPageProps) {
  const canRead = await canReadClinical();
  if (!canRead) redirect('/dashboard');

  const { id } = await params;
  const query = await searchParams;
  const page = Math.max(1, Number(query.page) || 1);
  const search = query.search?.trim() ?? '';

  const patient = await getPatient(id);
  if (!patient) notFound();

  const [data, canWrite, totalEntries] = await Promise.all([
    listClinicalEntries({
      page,
      pageSize: 25,
      search: search || undefined,
      patientId: id,
    }),
    canManageClinical(),
    countPatientClinicalEntries(id),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Button variant="ghost" size="sm" asChild className="-ml-2 mb-2">
            <Link href={`/pacientes/${id}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Volver al paciente
            </Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">
            {SPECIES_EMOJI[patient.species]} {patient.name}
          </h1>
          <p className="text-muted-foreground">
            Historia clínica · {totalEntries} entrada{totalEntries !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" asChild>
            <Link href={`/imagenes?patientId=${id}`}>Imágenes</Link>
          </Button>
          {canWrite && (
            <Button asChild>
              <Link href={`/historia-clinica/nuevo?patientId=${id}`}>Nueva entrada</Link>
            </Button>
          )}
        </div>
      </div>

      <Suspense fallback={<div className="text-sm text-muted-foreground">Cargando...</div>}>
        <ClinicalEntriesList
          data={data}
          canWrite={canWrite}
          initialSearch={search}
          patientId={id}
          patientName={patient.name}
        />
      </Suspense>
    </div>
  );
}
