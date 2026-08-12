import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { canManagePharmacy } from '@/actions/pharmacy';
import { getSessionContext } from '@/actions/auth';
import { getOwner } from '@/actions/owners';
import { getPatient } from '@/actions/patients';
import { getUserBranches } from '@/actions/settings';
import { PrescriptionForm } from '@/components/pharmacy/prescription-form';
import { Button } from '@/components/ui/button';

interface NuevaRecetaPageProps {
  searchParams: Promise<{ patientId?: string; consultationId?: string }>;
}

export default async function NuevaRecetaPage({ searchParams }: NuevaRecetaPageProps) {
  const canWrite = await canManagePharmacy();
  if (!canWrite) redirect('/farmacia');

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
        <Link href="/farmacia">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a farmacia
        </Link>
      </Button>
      <PrescriptionForm
        branches={branches}
        defaultBranchId={session?.branchId}
        defaultPatientId={patient?.id}
        defaultPatientName={patient?.name}
        defaultOwnerId={patient?.owner_id}
        defaultOwnerName={owner?.full_name}
        defaultConsultationId={params.consultationId}
      />
    </div>
  );
}
