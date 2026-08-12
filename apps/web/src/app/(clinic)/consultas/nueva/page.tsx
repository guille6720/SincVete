import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { canManageConsultations } from '@/actions/consultations';
import { getSessionContext } from '@/actions/auth';
import { getOwner } from '@/actions/owners';
import { getPatient } from '@/actions/patients';
import { getUserBranches } from '@/actions/settings';
import { ConsultationStartForm } from '@/components/consultations/consultation-start-form';
import { Button } from '@/components/ui/button';

interface NuevaConsultaPageProps {
  searchParams: Promise<{ patientId?: string }>;
}

export default async function NuevaConsultaPage({ searchParams }: NuevaConsultaPageProps) {
  const canWrite = await canManageConsultations();
  if (!canWrite) redirect('/consultas');

  const params = await searchParams;
  const session = await getSessionContext();

  let patient = null;
  let owner = null;
  if (params.patientId) {
    patient = await getPatient(params.patientId);
    if (patient) owner = await getOwner(patient.owner_id);
  }

  const branches = await getUserBranches();

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/consultas">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a consultas
        </Link>
      </Button>
      <ConsultationStartForm
        branches={branches}
        defaultBranchId={session?.branchId}
        defaultPatientId={patient?.id}
        defaultPatientName={patient?.name}
        defaultOwnerId={patient?.owner_id}
        defaultOwnerName={owner?.full_name}
      />
    </div>
  );
}
