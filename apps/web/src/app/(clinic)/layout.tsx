import { redirect } from 'next/navigation';
import { getSessionContext } from '@/lib/session';
import { countUnreadNotifications } from '@/actions/notifications';
import { getUserBranches } from '@/actions/settings';
import { AppShell } from '@/components/layout/app-shell';

export default async function ClinicLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionContext();

  if (!session) {
    redirect('/login');
  }

  const staffRole = session.role;
  if (session.kind !== 'staff' || !staffRole) {
    redirect(session.kind === 'portal' ? '/portal' : '/login');
  }

  // Both loaders are React.cache'd — reuse across nested pages in this request.
  const [branches, unreadNotifications] = await Promise.all([
    getUserBranches(),
    countUnreadNotifications(),
  ]);

  const branchName =
    branches.find((b) => b.id === session.branchId)?.name ??
    branches.find((b) => b.is_main)?.name ??
    branches[0]?.name;

  return (
    <AppShell
      userName={session.profile.full_name}
      role={staffRole}
      branchName={branchName}
      branches={branches}
      activeBranchId={session.branchId}
      unreadNotifications={unreadNotifications}
      isPlatformAdmin={session.isPlatformAdmin}
    >
      {children}
    </AppShell>
  );
}
