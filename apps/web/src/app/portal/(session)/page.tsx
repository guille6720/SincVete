import { redirect } from 'next/navigation';
import { getOwnerPortalHome } from '@/actions/portal';
import { PortalHome } from '@/components/portal/portal-home';

export default async function PortalPage() {
  const home = await getOwnerPortalHome();
  if (!home) redirect('/login');
  return <PortalHome home={home} />;
}
