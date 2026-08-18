import { notFound, redirect } from 'next/navigation';
import { getSuperadminOrgCommercial } from '@/actions/superadmin';
import { SuperadminOrgDetail } from '@/components/superadmin/org-detail';
import { getSessionContext } from '@/lib/session';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SuperadminOrganizationPage({ params }: PageProps) {
  const [session, { id }] = await Promise.all([getSessionContext(), params]);
  if (!session?.isPlatformAdmin) redirect('/dashboard');

  try {
    const data = await getSuperadminOrgCommercial(id);
    return <SuperadminOrgDetail data={data} />;
  } catch {
    notFound();
  }
}
