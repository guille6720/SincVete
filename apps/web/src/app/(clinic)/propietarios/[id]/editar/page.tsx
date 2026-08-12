import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { getOwner, canManageOwners } from '@/actions/owners';
import { getUserBranches } from '@/actions/settings';
import { OwnerForm } from '@/components/owners/owner-form';
import { Button } from '@/components/ui/button';

interface EditOwnerPageProps {
  params: Promise<{ id: string }>;
}

export default async function EditarPropietarioPage({ params }: EditOwnerPageProps) {
  const canWrite = await canManageOwners();
  if (!canWrite) redirect('/propietarios');

  const { id } = await params;
  const [owner, branches] = await Promise.all([getOwner(id), getUserBranches()]);

  if (!owner) notFound();

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/propietarios/${id}`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver al propietario
        </Link>
      </Button>
      <OwnerForm owner={owner} branches={branches} />
    </div>
  );
}
