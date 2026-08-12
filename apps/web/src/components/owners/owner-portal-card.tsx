'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { inviteOwnerToPortal, revokeOwnerPortalAccess } from '@/actions/portal';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  PORTAL_ACCESS_STATUS_LABELS,
  PORTAL_ACCESS_STATUS_VARIANT,
  buildPortalActivatePath,
  formatDashboardDateTime,
  type OwnerPortalStatus,
} from '@sincvete/shared';

interface OwnerPortalCardProps {
  ownerId: string;
  ownerEmail: string | null;
  canWrite: boolean;
  status: OwnerPortalStatus | null;
}

export function OwnerPortalCard({ ownerId, ownerEmail, canWrite, status }: OwnerPortalCardProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const access = status?.status ?? 'inactive';

  const handleInvite = async () => {
    setPending(true);
    setError(null);
    const result = await inviteOwnerToPortal(ownerId);
    setPending(false);
    if (!result.success || !result.data) {
      setError(result.error ?? 'No se pudo invitar');
      return;
    }
    const path = buildPortalActivatePath(result.data.token);
    setInviteUrl(`${window.location.origin}${path}`);
    router.refresh();
  };

  const handleCopy = async () => {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
  };

  const handleRevoke = async () => {
    if (!confirm('¿Revocar el acceso al portal de este propietario?')) return;
    setPending(true);
    setError(null);
    const result = await revokeOwnerPortalAccess(ownerId);
    setPending(false);
    if (!result.success) {
      setError(result.error ?? 'No se pudo revocar');
      return;
    }
    setInviteUrl(null);
    router.refresh();
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2">
          <CardTitle className="text-lg">Portal del tutor</CardTitle>
          <Badge variant={PORTAL_ACCESS_STATUS_VARIANT[access]}>
            {PORTAL_ACCESS_STATUS_LABELS[access]}
          </Badge>
        </div>
        <CardDescription>
          El propietario puede ver mascotas, turnos, vacunas y facturas emitidas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          Email: {ownerEmail || 'Cargá un email en la ficha para invitar'}
        </p>
        {status?.status === 'invited' && status.expiresAt && (
          <p className="text-sm text-muted-foreground">
            Invitación válida hasta {formatDashboardDateTime(status.expiresAt)}
          </p>
        )}
        {inviteUrl && (
          <div className="space-y-2 rounded-md border bg-muted/40 p-3">
            <p className="text-xs font-medium text-muted-foreground">Enlace de activación</p>
            <p className="break-all text-sm">{inviteUrl}</p>
            <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
              Copiar enlace
            </Button>
          </div>
        )}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {canWrite && (
          <div className="flex flex-wrap gap-2">
            {access !== 'active' && (
              <Button type="button" size="sm" onClick={handleInvite} disabled={pending || !ownerEmail}>
                {access === 'invited' ? 'Reenviar invitación' : 'Invitar al portal'}
              </Button>
            )}
            {access !== 'inactive' && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleRevoke}
                disabled={pending}
              >
                Revocar acceso
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
