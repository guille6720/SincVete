import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getPatient, canManagePatients } from '@/actions/patients';
import { getOwner } from '@/actions/owners';
import { getUserBranches } from '@/actions/settings';
import { PatientForm } from '@/components/patients/patient-form';
import { Button } from '@/components/ui/button';

interface EditPatientPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditarPacientePage({ params }: EditPatientPageProps) {
  const canWrite = await canManagePatients();
  if (!canWrite) redirect('/pacientes');

  const { id } = await params;
  const patient = await getPatient(id);
  if (!patient) notFound();

  const [branches, owner] = await Promise.all([
    getUserBranches(),
    getOwner(patient.owner_id),
  ]);

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/pacientes/${id}`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver al paciente
        </Link>
      </Button>
      <PatientForm
        patient={patient}
        ownerName={owner?.full_name}
        branches={branches}
      />
    </div>
  );
}
