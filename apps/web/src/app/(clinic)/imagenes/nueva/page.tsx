import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { canManageImages } from '@/actions/images';
import { getSessionContext } from '@/actions/auth';
import { getOwner } from '@/actions/owners';
import { getPatient } from '@/actions/patients';
import { getUserBranches } from '@/actions/settings';
import { ClinicalImageForm } from '@/components/images/clinical-image-form';
import { Button } from '@/components/ui/button';

interface NuevaImagenPageProps {
  searchParams: Promise<{
    patientId?: string;
    consultationId?: string;
    clinicalEntryId?: string;
  }>;
}

export default async function NuevaImagenPage({ searchParams }: NuevaImagenPageProps) {
  const canWrite = await canManageImages();
  if (!canWrite) redirect('/imagenes');

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
        <Link href="/imagenes">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a imágenes
        </Link>
      </Button>
      <ClinicalImageForm
        branches={branches}
        defaultBranchId={session?.branchId}
        defaultPatientId={patient?.id}
        defaultPatientName={patient?.name}
        defaultOwnerId={patient?.owner_id}
        defaultOwnerName={owner?.full_name}
        defaultConsultationId={params.consultationId}
        defaultClinicalEntryId={params.clinicalEntryId}
      />
    </div>
  );
}
