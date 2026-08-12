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
    <div className="space-y-6">
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
