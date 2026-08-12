export const PORTAL_INVITE_DAYS = 7;

export const PORTAL_ACCESS_STATUSES = ['inactive', 'invited', 'active'] as const;

export type PortalAccessStatus = (typeof PORTAL_ACCESS_STATUSES)[number];

export const PORTAL_ACCESS_STATUS_LABELS: Record<PortalAccessStatus, string> = {
  inactive: 'Sin acceso',
  invited: 'Invitación pendiente',
  active: 'Portal activo',
};

export const PORTAL_ACCESS_STATUS_VARIANT: Record<
  PortalAccessStatus,
  'default' | 'success' | 'warning' | 'destructive'
> = {
  inactive: 'default',
  invited: 'warning',
  active: 'success',
};

export function buildPortalActivatePath(token: string): string {
  return `/portal/activar?token=${encodeURIComponent(token)}`;
}
