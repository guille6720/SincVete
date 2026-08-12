import { notFound, redirect } from 'next/navigation';
import { getPrescription, canReadPharmacy, canManagePharmacy } from '@/actions/pharmacy';
import { PrescriptionDetail } from '@/components/pharmacy/prescription-detail';

interface FarmaciaDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function FarmaciaDetailPage({ params }: FarmaciaDetailPageProps) {
  const canRead = await canReadPharmacy();
  if (!canRead) redirect('/dashboard');

  const { id } = await params;
  const [data, canWrite] = await Promise.all([getPrescription(id), canManagePharmacy()]);

  if (!data) notFound();

  return (
    <PrescriptionDetail
      prescription={data.prescription}
      items={data.items}
      canWrite={canWrite}
    />
  );
}
