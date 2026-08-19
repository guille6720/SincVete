import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { listClinicalEntries } from '@/actions/clinical-entries';
import { ClinicalEntriesList } from '@/components/clinical/clinical-entries-list';
import { getSessionContext } from '@/lib/session';
import { CLINICAL_ENTRY_TYPES, CLINICAL_HISTORY_PAGE_SIZE, type ClinicalEntryType } from '@sincvete/shared';

interface HistoriaClinicaPageProps {
  searchParams: Promise<{ page?: string; search?: string; type?: string }>;
}

export default async function HistoriaClinicaPage({ searchParams }: HistoriaClinicaPageProps) {
  const [session, params] = await Promise.all([getSessionContext(), searchParams]);
  if (!session?.permissions.includes('clinical:read')) redirect('/dashboard');

  const page = Math.max(1, Number(params.page) || 1);
  const search = params.search?.trim() ?? '';
  const typeParam = params.type?.trim() ?? '';
  const entryType = CLINICAL_ENTRY_TYPES.includes(typeParam as ClinicalEntryType)
    ? (typeParam as ClinicalEntryType)
    : undefined;

  const data = await listClinicalEntries({
    page,
    pageSize: CLINICAL_HISTORY_PAGE_SIZE,
    search: search || undefined,
    entryType,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Historia clínica</h1>
        <p className="text-muted-foreground">Registro longitudinal de atenciones y evolución</p>
      </div>

      <Suspense fallback={<div className="text-sm text-muted-foreground">Cargando...</div>}>
        <ClinicalEntriesList
          data={data}
          canWrite={session.permissions.includes('clinical:write')}
          initialSearch={search}
          initialEntryType={entryType ?? ''}
        />
      </Suspense>
    </div>
  );
}
