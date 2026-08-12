import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { canManagePatients } from '@/actions/patients';
import { getUserBranches } from '@/actions/settings';
import { getSessionContext } from '@/actions/auth';
import { PatientForm } from '@/components/patients/patient-form';
import { Button } from '@/components/ui/button';

interface NuevoPacientePageProps {
  searchParams: Promise<{ ownerId?: string }>;
}

export default async function NuevoPacientePage({ searchParams }: NuevoPacientePageProps) {
  const canWrite = await canManagePatients();
  if (!canWrite) redirect('/pacientes');

  const params = await searchParams;
  const session = await getSessionContext();
  const branches = await getUserBranches();

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href="/pacientes">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a pacientes
        </Link>
      </Button>
      <PatientForm
        branches={branches}
        defaultBranchId={session?.branchId}
        defaultOwnerId={params.ownerId}
      />
    </div>
  );
}
