import { notFound, redirect } from 'next/navigation';
import { getVaccination, canReadVaccinations, canManageVaccinations } from '@/actions/vaccinations';
import { VaccinationDetail } from '@/components/vaccinations/vaccination-detail';

interface VacunacionDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function VacunacionDetailPage({ params }: VacunacionDetailPageProps) {
  const canRead = await canReadVaccinations();
  if (!canRead) redirect('/dashboard');

  const { id } = await params;
  const [vaccination, canWrite] = await Promise.all([
    getVaccination(id),
    canManageVaccinations(),
  ]);

  if (!vaccination) notFound();

  return <VaccinationDetail vaccination={vaccination} canWrite={canWrite} />;
}
