import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { listPatients, canManagePatients, canReadPatients } from '@/actions/patients';
import { PatientsList } from '@/components/patients/patients-list';
import { PATIENT_SPECIES } from '@sincvete/shared';

interface PacientesPageProps {
  searchParams: Promise<{ page?: string; search?: string; species?: string }>;
}

export default async function PacientesPage({ searchParams }: PacientesPageProps) {
  const canRead = await canReadPatients();
  if (!canRead) redirect('/dashboard');

  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const search = params.search?.trim() ?? '';
  const speciesParam = params.species?.trim() ?? '';
  const species = PATIENT_SPECIES.includes(speciesParam as (typeof PATIENT_SPECIES)[number])
    ? (speciesParam as (typeof PATIENT_SPECIES)[number])
    : undefined;

  const [data, canWrite] = await Promise.all([
    listPatients({ page, pageSize: 25, search: search || undefined, species }),
    canManagePatients(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pacientes</h1>
        <p className="text-muted-foreground">Mascotas y animales de la clínica</p>
      </div>

      <Suspense fallback={<div className="text-sm text-muted-foreground">Cargando...</div>}>
        <PatientsList
          data={data}
          canWrite={canWrite}
          initialSearch={search}
          initialSpecies={species ?? ''}
        />
      </Suspense>
    </div>
  );
}
