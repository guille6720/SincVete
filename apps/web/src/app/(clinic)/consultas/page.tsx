import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import {
  listConsultationQueue,
  listConsultations,
  canManageConsultations,
  canReadConsultations,
  canReadConsultationHistory,
} from '@/actions/consultations';
import { ConsultationsQueue } from '@/components/consultations/consultations-queue';
import { ConsultationsHistory } from '@/components/consultations/consultations-history';
import { CONSULTATION_STATUSES, type ConsultationStatus } from '@sincvete/shared';

interface ConsultasPageProps {
  searchParams: Promise<{ page?: string; search?: string; status?: string }>;
}

export default async function ConsultasPage({ searchParams }: ConsultasPageProps) {
  const canRead = await canReadConsultations();
  if (!canRead) redirect('/dashboard');

  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const search = params.search?.trim() ?? '';
  const statusParam = params.status?.trim() ?? '';
  const status = CONSULTATION_STATUSES.includes(statusParam as ConsultationStatus)
    ? (statusParam as ConsultationStatus)
    : undefined;

  const [queue, canWrite, canHistory] = await Promise.all([
    listConsultationQueue(),
    canManageConsultations(),
    canReadConsultationHistory(),
  ]);

  const history = canHistory
    ? await listConsultations({
        page,
        pageSize: 25,
        search: search || undefined,
        status,
      })
    : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Consultas</h1>
        <p className="text-muted-foreground">Cola de atención y registro clínico del día</p>
      </div>

      <ConsultationsQueue items={queue} canWrite={canWrite} canReadHistory={canHistory} />

      {history && (
        <Suspense fallback={<div className="text-sm text-muted-foreground">Cargando historial...</div>}>
          <ConsultationsHistory
            data={history}
            initialSearch={search}
            initialStatus={status ?? ''}
          />
        </Suspense>
      )}
    </div>
  );
}
