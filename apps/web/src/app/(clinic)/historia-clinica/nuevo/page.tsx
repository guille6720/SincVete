import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { canManageClinical } from '@/actions/clinical-entries';
import { getSessionContext } from '@/actions/auth';
import { getOwner } from '@/actions/owners';
import { getPatient } from '@/actions/patients';
import { getUserBranches } from '@/actions/settings';
import { ClinicalEntryForm } from '@/components/clinical/clinical-entry-form';
import { Button } from '@/components/ui/button';

interface NuevaEntradaPageProps {
  searchParams: Promise<{ patientId?: string; date?: string }>;
}

export default async function NuevaEntradaClinicaPage({ searchParams }: NuevaEntradaPageProps) {
  const canWrite = await canManageClinical();
  if (!canWrite) redirect('/historia-clinica');

  const params = await searchParams;
  const session = await getSessionContext();

  let patient = null;
  let owner = null;
  if (params.patientId) {
    patient = await getPatient(params.patientId);
    if (patient) owner = await getOwner(patient.owner_id);
  }

  const branches = await getUserBranches();
  const defaultEntryDate = params.date ? `${params.date}T09:00` : undefined;

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href={patient ? `/pacientes/${patient.id}/historia` : '/historia-clinica'}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver
        </Link>
      </Button>
      <ClinicalEntryForm
        branches={branches}
        defaultBranchId={session?.branchId}
        defaultPatientId={patient?.id}
        defaultPatientName={patient?.name}
        defaultOwnerId={patient?.owner_id}
        defaultOwnerName={owner?.full_name}
        defaultEntryDate={defaultEntryDate}
      />
    </div>
  );
}
