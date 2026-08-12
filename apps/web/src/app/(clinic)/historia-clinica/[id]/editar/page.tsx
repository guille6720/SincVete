import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getClinicalEntry, canManageClinical } from '@/actions/clinical-entries';
import { getUserBranches } from '@/actions/settings';
import { ClinicalEntryForm } from '@/components/clinical/clinical-entry-form';
import { Button } from '@/components/ui/button';

interface EditarEntradaPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditarEntradaClinicaPage({ params }: EditarEntradaPageProps) {
  const canWrite = await canManageClinical();
  if (!canWrite) redirect('/historia-clinica');

  const { id } = await params;
  const [entry, branches] = await Promise.all([getClinicalEntry(id), getUserBranches()]);

  if (!entry) notFound();

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/historia-clinica/${id}`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver a la entrada
        </Link>
      </Button>
      <ClinicalEntryForm entry={entry} branches={branches} />
    </div>
  );
}
