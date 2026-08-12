import { previewPortalInvite } from '@/actions/portal';
import { getSessionContext } from '@/actions/auth';
import { PortalActivateForm } from '@/components/portal/portal-activate-form';

interface PortalActivatePageProps {
  searchParams: Promise<{ token?: string }>;
}

export default async function PortalActivatePage({ searchParams }: PortalActivatePageProps) {
  const { token } = await searchParams;
  const inviteToken = token?.trim() ?? '';
  const [preview, session] = await Promise.all([
    inviteToken ? previewPortalInvite(inviteToken) : Promise.resolve(null),
    getSessionContext(),
  ]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <PortalActivateForm
        token={inviteToken}
        preview={preview}
        isLoggedIn={Boolean(session)}
        isStaff={session?.kind === 'staff'}
      />
    </div>
  );
}
