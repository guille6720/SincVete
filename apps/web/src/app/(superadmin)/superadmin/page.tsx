import { redirect } from 'next/navigation';
import { listSuperadminOrganizations } from '@/actions/superadmin';
import { SuperadminOrgList } from '@/components/superadmin/org-list';
import { getSessionContext } from '@/lib/session';

interface PageProps {
  searchParams: Promise<{ page?: string; search?: string }>;
}

export default async function SuperadminOrganizationsPage({ searchParams }: PageProps) {
  const [session, params] = await Promise.all([getSessionContext(), searchParams]);
  if (!session?.isPlatformAdmin) redirect('/dashboard');

  const page = Math.max(1, Number(params.page) || 1);
  const search = params.search?.trim() ?? '';
  const data = await listSuperadminOrganizations({ page, pageSize: 25, search: search || undefined });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Organizaciones</h1>
        <p className="text-muted-foreground">
          Plan, trial, overrides y usage. Los cambios quedan auditados. No hay pagos en esta fase.
        </p>
      </div>
      <SuperadminOrgList data={data} initialSearch={search} />
    </div>
  );
}
