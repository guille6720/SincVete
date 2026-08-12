import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { canManageSurgeries } from '@/actions/surgeries';
import { getSessionContext } from '@/actions/auth';
import { getOwner } from '@/actions/owners';
import { getPatient } from '@/actions/patients';
import { getUserBranches } from '@/actions/settings';
import { SurgeryScheduleForm } from '@/components/surgeries/surgery-schedule-form';
import { Button } from '@/components/ui/button';

interface NuevaCirugiaPageProps {
  searchParams: Promise<{ patientId?: string; consultationId?: string; appointmentId?: string }>;
}

export default async function NuevaCirugiaPage({ searchParams }: NuevaCirugiaPageProps) {
  const canWrite = await canManageSurgeries();
  if (!canWrite) redirect('/cirugias');

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
        <Link href="/cirugias">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a cirugías
        </Link>
      </Button>
      <SurgeryScheduleForm
        branches={branches}
        defaultBranchId={session?.branchId}
        defaultPatientId={patient?.id}
        defaultPatientName={patient?.name}
        defaultOwnerId={patient?.owner_id}
        defaultOwnerName={owner?.full_name}
        defaultConsultationId={params.consultationId}
        defaultAppointmentId={params.appointmentId}
      />
    </div>
  );
}
