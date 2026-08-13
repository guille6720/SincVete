import { getDashboardData } from '@/actions/dashboard';
import { DashboardActivityFeed } from '@/components/dashboard/dashboard-activity-feed';
import { DashboardHeader } from '@/components/dashboard/dashboard-header';
import { DashboardQuickActions } from '@/components/dashboard/dashboard-quick-actions';
import { DashboardRecentLists } from '@/components/dashboard/dashboard-recent-lists';
import { DashboardSpeciesBreakdown } from '@/components/dashboard/dashboard-species-breakdown';
import { DashboardStatCards } from '@/components/dashboard/dashboard-stat-cards';

export async function DashboardView() {
  const { context, summary, activity, session } = await getDashboardData();

  if (!session) return null;

  return (
    <div className="relative space-y-6">
      <div
        className="pointer-events-none absolute -inset-x-4 -top-4 bottom-0 -z-10 opacity-[0.55] md:-inset-x-6"
        style={{
          backgroundImage:
            "radial-gradient(ellipse 80% 50% at 10% 0%, rgba(45,212,191,0.18), transparent 55%), radial-gradient(ellipse 60% 40% at 90% 10%, rgba(56,189,248,0.14), transparent 50%), url('/dashboard/paw-pattern.svg')",
          backgroundSize: 'auto, auto, 160px 160px',
        }}
        aria-hidden
      />
      <DashboardHeader session={session} context={context} />
      <DashboardStatCards summary={summary} />
      <DashboardQuickActions canWritePatients={context?.canWritePatients ?? false} />
      <div className="grid gap-4 xl:grid-cols-3">
        <DashboardSpeciesBreakdown summary={summary} />
        <div className="xl:col-span-2">
          {context?.canViewActivity ? (
            <DashboardActivityFeed activity={activity} />
          ) : (
            <DashboardRecentLists
              recentPatients={summary.recentPatients}
              recentOwners={summary.recentOwners}
            />
          )}
        </div>
      </div>
      {context?.canViewActivity && (
        <DashboardRecentLists
          recentPatients={summary.recentPatients}
          recentOwners={summary.recentOwners}
        />
      )}
    </div>
  );
}
