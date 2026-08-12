import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import {
  listClinicalEntries,
  canManageClinical,
  canReadClinical,
} from '@/actions/clinical-entries';
import { ClinicalEntriesList } from '@/components/clinical/clinical-entries-list';
import { CLINICAL_ENTRY_TYPES, type ClinicalEntryType } from '@sincvete/shared';

interface HistoriaClinicaPageProps {
  searchParams: Promise<{ page?: string; search?: string; type?: string }>;
}

export default async function HistoriaClinicaPage({ searchParams }: HistoriaClinicaPageProps) {
  const canRead = await canReadClinical();
  if (!canRead) redirect('/dashboard');

  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const search = params.search?.trim() ?? '';
  const typeParam = params.type?.trim() ?? '';
  const entryType = CLINICAL_ENTRY_TYPES.includes(typeParam as ClinicalEntryType)
    ? (typeParam as ClinicalEntryType)
    : undefined;

  const [data, canWrite] = await Promise.all([
    listClinicalEntries({ page, pageSize: 25, search: search || undefined, entryType }),
    canManageClinical(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Historia clínica</h1>
        <p className="text-muted-foreground">Registro longitudinal de atenciones y evolución</p>
      </div>

      <Suspense fallback={<div className="text-sm text-muted-foreground">Cargando...</div>}>
        <ClinicalEntriesList
          data={data}
          canWrite={canWrite}
          initialSearch={search}
          initialEntryType={entryType ?? ''}
        />
      </Suspense>
    </div>
  );
}
