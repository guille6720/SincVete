import { redirect } from 'next/navigation';
import {
  getSuperadminCommercialSummary,
  listSuperadminAddonsEndingSoon,
  listSuperadminOpenCheckoutIntents,
  listSuperadminOrganizationsRecommended,
  listSuperadminOrgsOverSeats,
  listSuperadminPlansEndingSoon,
  listSuperadminUnappliedBillingEvents,
  listSuperadminUpgradeQueue,
  listSuperadminRecommendationFollowUps,
  getSuperadminRecommendationSettings,
} from '@/actions/superadmin';
import { SuperadminOrgList, RecommendationSummaryCards } from '@/components/superadmin/org-list';
import { SuperadminCommercialOps } from '@/components/superadmin/commercial-ops';
import { SuperadminCommercialQueues } from '@/components/superadmin/commercial-queues';
import { SuperadminUpgradeQueue } from '@/components/superadmin/upgrade-queue';
import { SuperadminFollowUpQueue } from '@/components/superadmin/follow-up-queue';
import { SuperadminRecommendationSettingsCard } from '@/components/superadmin/recommendation-settings';
import { getSessionContext } from '@/lib/session';

interface PageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    plan?: string;
    status?: string;
    recommended?: string;
    upgrade?: string;
    sort?: string;
  }>;
}

export default async function SuperadminOrganizationsPage({ searchParams }: PageProps) {
  const [session, params] = await Promise.all([getSessionContext(), searchParams]);
  if (!session?.isPlatformAdmin) redirect('/dashboard');

  const page = Math.max(1, Number(params.page) || 1);
  const search = params.search?.trim() ?? '';
  const planKey = params.plan?.trim() ?? '';
  const status = params.status?.trim() ?? '';
  const recommendedPlan = params.recommended?.trim() ?? '';
  const upgradeFilter = params.upgrade?.trim() ?? '';
  const sort = params.sort?.trim() ?? '';

  try {
    const [
      recommended,
      summary,
      checkoutIntents,
      pendingEvents,
      plansEndingSoon,
      addonsEndingSoon,
      orgsOverSeats,
      upgradeQueue,
      followUps,
      recommendationSettings,
    ] = await Promise.all([
      listSuperadminOrganizationsRecommended({
        page,
        pageSize: 25,
        search: search || undefined,
        planKey: planKey || undefined,
        status: status || undefined,
        recommendedPlan: recommendedPlan || undefined,
        upgradeFilter: upgradeFilter || undefined,
        sort: sort || undefined,
      }),
      getSuperadminCommercialSummary(),
      listSuperadminOpenCheckoutIntents(),
      listSuperadminUnappliedBillingEvents(),
      listSuperadminPlansEndingSoon(),
      listSuperadminAddonsEndingSoon(),
      listSuperadminOrgsOverSeats(),
      listSuperadminUpgradeQueue(12).catch(() => ({ rows: [], total: 0 })),
      listSuperadminRecommendationFollowUps(25).catch(() => []),
      getSuperadminRecommendationSettings().catch(() => null),
    ]);

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Organizaciones</h1>
          <p className="text-muted-foreground">
            Plan, uso, recomendaciones y pagos. Las recomendaciones no cambian el plan solas.
          </p>
        </div>
        <SuperadminCommercialOps summary={summary} />
        <SuperadminRecommendationSettingsCard settings={recommendationSettings} />
        <RecommendationSummaryCards summary={recommended.summary} />
        <SuperadminUpgradeQueue rows={upgradeQueue.rows} total={upgradeQueue.total} />
        <SuperadminFollowUpQueue rows={followUps} />
        <SuperadminCommercialQueues
          checkoutIntents={checkoutIntents}
          pendingEvents={pendingEvents}
          plansEndingSoon={plansEndingSoon}
          addonsEndingSoon={addonsEndingSoon}
          orgsOverSeats={orgsOverSeats}
        />
        <SuperadminOrgList
          rows={recommended.rows}
          total={recommended.total}
          page={recommended.page}
          pageSize={recommended.pageSize}
          initialSearch={search}
          initialPlanKey={planKey}
          initialStatus={status}
          initialRecommendedPlan={recommendedPlan}
          initialUpgradeFilter={upgradeFilter}
          initialSort={sort}
        />
      </div>
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado';
    return (
      <div className="mx-auto max-w-xl space-y-4 rounded-xl border bg-card p-6">
        <h1 className="text-xl font-semibold">Superadmin no pudo cargar los datos</h1>
        <p className="text-sm text-muted-foreground">
          Tu sesión sí es Superadmin. Falta configuración de Vercel o migraciones en Supabase
          (incluí phase 31–37 de recomendaciones).
        </p>
        <p className="rounded-md bg-muted p-3 font-mono text-xs">{message}</p>
        <ol className="list-decimal space-y-2 pl-5 text-sm">
          <li>
            En Vercel → Environment Variables, agregá <code>SUPABASE_SERVICE_ROLE_KEY</code> y
            redesplegá.
          </li>
          <li>
            En Supabase → SQL Editor, aplicá phase 31–37 (
            <code>20260818360000</code> … <code>20260818420000</code>).
          </li>
          <li>Recargá esta página.</li>
        </ol>
      </div>
    );
  }
}
