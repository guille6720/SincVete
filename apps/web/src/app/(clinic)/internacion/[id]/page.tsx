import { notFound, redirect } from 'next/navigation';
import { getHospitalization, canReadHospitalizations, canManageHospitalizations } from '@/actions/hospitalizations';
import { HospitalizationStay } from '@/components/hospitalizations/hospitalization-stay';

interface InternacionDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function InternacionDetailPage({ params }: InternacionDetailPageProps) {
  const canRead = await canReadHospitalizations();
  if (!canRead) redirect('/dashboard');

  const { id } = await params;
  const [result, canWrite] = await Promise.all([
    getHospitalization(id),
    canManageHospitalizations(),
  ]);

  if (!result) notFound();

  return <HospitalizationStay stay={result.stay} notes={result.notes} canWrite={canWrite} />;
}
