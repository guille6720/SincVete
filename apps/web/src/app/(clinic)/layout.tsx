import { redirect } from 'next/navigation';
import { getSessionContext } from '@/actions/auth';
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

  const branches = await getUserBranches();
  const activeBranchId = session.branchId;
  const unreadNotifications = await countUnreadNotifications();

  let branchName = branches.find((b) => b.id === activeBranchId)?.name;
  if (!branchName && activeBranchId) {
    const supabase = await createServerClient();
    const { data } = await supabase.from('branches').select('name').eq('id', activeBranchId).single();
    branchName = data?.name;
  }
  branchName ??= branches.find((b) => b.is_main)?.name ?? branches[0]?.name;

  return (
    <AppShell
      userName={session.profile.full_name}
      role={staffRole}
      branchName={branchName}
      branches={branches}
      activeBranchId={activeBranchId}
      unreadNotifications={unreadNotifications}
    >
      {children}
    </AppShell>
  );
}
