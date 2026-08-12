import { notFound } from 'next/navigation';
import { getOwnerPortalPatient } from '@/actions/portal';
import { PortalPatientView } from '@/components/portal/portal-patient-view';

interface PortalPatientPageProps {
  params: Promise<{ id: string }>;
}

export default async function PortalPatientPage({ params }: PortalPatientPageProps) {
  const { id } = await params;
  const detail = await getOwnerPortalPatient(id);
  if (!detail) notFound();
  return <PortalPatientView detail={detail} />;
}
