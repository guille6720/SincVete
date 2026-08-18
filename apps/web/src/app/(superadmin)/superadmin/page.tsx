import { redirect } from 'next/navigation';
import { getSuperadminCommercialSummary, listSuperadminOrganizations } from '@/actions/superadmin';
import { SuperadminOrgList } from '@/components/superadmin/org-list';
import { SuperadminCommercialOps } from '@/components/superadmin/commercial-ops';
import { getSessionContext } from '@/lib/session';

interface PageProps {
  searchParams: Promise<{ page?: string; search?: string; plan?: string; status?: string }>;
}

export default async function SuperadminOrganizationsPage({ searchParams }: PageProps) {
  const [session, params] = await Promise.all([getSessionContext(), searchParams]);
  if (!session?.isPlatformAdmin) redirect('/dashboard');

  const page = Math.max(1, Number(params.page) || 1);
  const search = params.search?.trim() ?? '';
  const planKey = params.plan?.trim() ?? '';
  const status = params.status?.trim() ?? '';
  const [data, summary] = await Promise.all([
    listSuperadminOrganizations({
      page,
      pageSize: 25,
      search: search || undefined,
      planKey: planKey || undefined,
      status: status || undefined,
    }),
    getSuperadminCommercialSummary(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Organizaciones</h1>
        <p className="text-muted-foreground">
          Plan, trial, pagos y usage. Los cambios quedan auditados. Superadmin puede vencer planes
          sin esperar al cron.
        </p>
      </div>
      <SuperadminCommercialOps summary={summary} />
      <SuperadminOrgList
        data={data}
        initialSearch={search}
        initialPlanKey={planKey}
        initialStatus={status}
      />
    </div>
  );
}
