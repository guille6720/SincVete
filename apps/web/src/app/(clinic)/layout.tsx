import { redirect } from 'next/navigation';
import { getSessionContext } from '@/lib/session';
import { countUnreadNotifications } from '@/actions/notifications';
import { getUserBranches } from '@/actions/settings';
import { AppShell } from '@/components/layout/app-shell';
import { createServerClient } from '@/lib/supabase/server';

export default async function ClinicLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionContext();

  if (!session) {
    redirect('/login');
  }

  const staffRole = session.role;
  if (session.kind !== 'staff' || !staffRole) {
    redirect(session.kind === 'portal' ? '/portal' : '/login');
  }

  const [branches, unreadNotifications] = await Promise.all([
    getUserBranches(),
    countUnreadNotifications(),
  ]);

  let branchName = branches.find((b) => b.id === session.branchId)?.name;
  if (!branchName && session.branchId) {
    const supabase = await createServerClient();
    const { data } = await supabase.from('branches').select('name').eq('id', session.branchId).single();
    branchName = data?.name;
  }
  branchName ??= branches.find((b) => b.is_main)?.name ?? branches[0]?.name;

  return (
    <AppShell
      userName={session.profile.full_name}
      role={staffRole}
      branchName={branchName}
      branches={branches}
      activeBranchId={session.branchId}
      unreadNotifications={unreadNotifications}
    >
      {children}
    </AppShell>
  );
}
