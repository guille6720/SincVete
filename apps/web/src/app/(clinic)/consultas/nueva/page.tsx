import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getOwner } from '@/actions/owners';
import { getPatient } from '@/actions/patients';
import { getUserBranches } from '@/actions/settings';
import { ConsultationStartForm } from '@/components/consultations/consultation-start-form';
import { Button } from '@/components/ui/button';
import { getSessionContext } from '@/lib/session';

interface NuevaConsultaPageProps {
  searchParams: Promise<{ patientId?: string }>;
}

export default async function NuevaConsultaPage({ searchParams }: NuevaConsultaPageProps) {
  const [session, params] = await Promise.all([getSessionContext(), searchParams]);
  if (!session?.permissions.includes('clinical:write')) redirect('/consultas');

  const [branches, patient] = await Promise.all([
    getUserBranches(),
    params.patientId ? getPatient(params.patientId) : Promise.resolve(null),
  ]);

  const owner = patient ? await getOwner(patient.owner_id) : null;

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
        defaultBranchId={session.branchId}
        defaultPatientId={patient?.id}
        defaultPatientName={patient?.name}
        defaultOwnerId={patient?.owner_id}
        defaultOwnerName={owner?.full_name}
      />
    </div>
  );
}
