import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import {
  listActivePrescriptions,
  listPrescriptions,
  canManagePharmacy,
  canReadPharmacy,
} from '@/actions/pharmacy';
import { PrescriptionsBoard } from '@/components/pharmacy/prescriptions-board';
import { PrescriptionsHistory } from '@/components/pharmacy/prescriptions-history';
import { PRESCRIPTION_STATUSES, type PrescriptionStatus } from '@sincvete/shared';

interface FarmaciaPageProps {
  searchParams: Promise<{ page?: string; search?: string; status?: string }>;
}

export default async function FarmaciaPage({ searchParams }: FarmaciaPageProps) {
  const canRead = await canReadPharmacy();
  if (!canRead) redirect('/dashboard');

  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const search = params.search?.trim() ?? '';
  const statusParam = params.status?.trim() ?? '';
  const status = PRESCRIPTION_STATUSES.includes(statusParam as PrescriptionStatus)
    ? (statusParam as PrescriptionStatus)
    : undefined;

  const [queue, history, canWrite] = await Promise.all([
    listActivePrescriptions(),
    listPrescriptions({
      page,
      pageSize: 25,
      search: search || undefined,
      status,
    }),
    canManagePharmacy(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Farmacia</h1>
        <p className="text-muted-foreground">Recetas, dispensación y descuento de stock</p>
      </div>

      <PrescriptionsBoard items={queue} canWrite={canWrite} />

      <Suspense fallback={<div className="text-sm text-muted-foreground">Cargando historial...</div>}>
        <PrescriptionsHistory data={history} initialSearch={search} initialStatus={status ?? ''} />
      </Suspense>
    </div>
  );
}
