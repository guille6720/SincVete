import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { canManageHospitalizations } from '@/actions/hospitalizations';
import { getSessionContext } from '@/actions/auth';
import { getOwner } from '@/actions/owners';
import { getPatient } from '@/actions/patients';
import { getUserBranches } from '@/actions/settings';
import { HospitalizationAdmitForm } from '@/components/hospitalizations/hospitalization-admit-form';
import { Button } from '@/components/ui/button';

interface NuevaInternacionPageProps {
  searchParams: Promise<{ patientId?: string; consultationId?: string }>;
}

export default async function NuevaInternacionPage({ searchParams }: NuevaInternacionPageProps) {
  const canWrite = await canManageHospitalizations();
  if (!canWrite) redirect('/internacion');

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
        <Link href="/internacion">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a internación
        </Link>
      </Button>
      <HospitalizationAdmitForm
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
