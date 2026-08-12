import { notFound, redirect } from 'next/navigation';
import {
  getClinicalEntry,
  canReadClinical,
  canManageClinical,
} from '@/actions/clinical-entries';
import { ClinicalEntryDetail } from '@/components/clinical/clinical-entry-detail';

interface EntradaClinicaPageProps {
  params: Promise<{ id: string }>;
}

export default async function EntradaClinicaDetailPage({ params }: EntradaClinicaPageProps) {
  const canRead = await canReadClinical();
  if (!canRead) redirect('/dashboard');

  const { id } = await params;
  const [entry, canWrite] = await Promise.all([
    getClinicalEntry(id),
    canManageClinical(),
  ]);

  if (!entry) notFound();

  return <ClinicalEntryDetail entry={entry} canWrite={canWrite} />;
}
