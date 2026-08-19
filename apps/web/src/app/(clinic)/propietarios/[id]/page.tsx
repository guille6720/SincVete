import { notFound, redirect } from 'next/navigation';
import { getOwner, canReadOwners, canManageOwners } from '@/actions/owners';
import { getOwnerPortalStatus } from '@/actions/portal';
import { canSendWhatsApp } from '@/actions/whatsapp';
import { OwnerDetail } from '@/components/owners/owner-detail';
import { FEATURES, canUseFeature } from '@/lib/entitlements';
import { getSessionContext } from '@/lib/session';

interface OwnerPageProps {
  params: Promise<{ id: string }>;
}

export default async function PropietarioDetailPage({ params }: OwnerPageProps) {
  const canRead = await canReadOwners();
  if (!canRead) redirect('/dashboard');

  const { id } = await params;
  const session = await getSessionContext();
  const [owner, canWrite, portalStatus, canWhatsApp, portalEnabled] = await Promise.all([
    getOwner(id),
    canManageOwners(),
    getOwnerPortalStatus(id),
    canSendWhatsApp(),
    session
      ? canUseFeature({ organizationId: session.organizationId, featureKey: FEATURES.OWNER_PORTAL })
      : Promise.resolve(false),
  ]);

  if (!owner) notFound();

  return (
    <OwnerDetail
      owner={owner}
      canWrite={canWrite}
      canSendWhatsApp={canWhatsApp}
      portalEnabled={portalEnabled}
      portalStatus={portalStatus}
    />
  );
}
