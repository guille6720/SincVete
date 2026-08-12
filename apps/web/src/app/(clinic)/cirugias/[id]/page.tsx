import { notFound, redirect } from 'next/navigation';
import { getSurgery, canReadSurgeries, canManageSurgeries } from '@/actions/surgeries';
import { SurgeryStay } from '@/components/surgeries/surgery-stay';

interface CirugiaDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CirugiaDetailPage({ params }: CirugiaDetailPageProps) {
  const canRead = await canReadSurgeries();
  if (!canRead) redirect('/dashboard');

  const { id } = await params;
  const [surgery, canWrite] = await Promise.all([getSurgery(id), canManageSurgeries()]);

  if (!surgery) notFound();

  return <SurgeryStay surgery={surgery} canWrite={canWrite} />;
}
