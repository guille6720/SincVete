import { redirect } from 'next/navigation';
import { getSessionContext, signOut } from '@/actions/auth';
import { PortalShell } from '@/components/portal/portal-shell';

export default async function PortalSessionLayout({ children }: { children: React.ReactNode }) {
  const session = await getSessionContext();

  if (!session) {
    redirect('/login');
  }

  if (session.kind !== 'portal') {
    redirect('/dashboard');
  }

  return (
    <PortalShell userName={session.profile.full_name} signOutAction={signOut}>
      {children}
    </PortalShell>
  );
}
