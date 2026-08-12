import { notFound, redirect } from 'next/navigation';
import { getOwner, canReadOwners, canManageOwners } from '@/actions/owners';
import { getOwnerPortalStatus } from '@/actions/portal';
import { canSendWhatsApp } from '@/actions/whatsapp';
import { OwnerDetail } from '@/components/owners/owner-detail';

interface OwnerPageProps {
  params: Promise<{ id: string }>;
}

export default async function PropietarioDetailPage({ params }: OwnerPageProps) {
  const canRead = await canReadOwners();
  if (!canRead) redirect('/dashboard');

  const { id } = await params;
  const [owner, canWrite, portalStatus, canWhatsApp] = await Promise.all([
    getOwner(id),
    canManageOwners(),
    getOwnerPortalStatus(id),
    canSendWhatsApp(),
  ]);

  if (!owner) notFound();

  return (
    <OwnerDetail
      owner={owner}
      canWrite={canWrite}
      canSendWhatsApp={canWhatsApp}
      portalStatus={portalStatus}
    />
  );
}
