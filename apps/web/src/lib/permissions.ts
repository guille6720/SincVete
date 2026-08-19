import {
  getPermissionsForRole,
  hasPermission,
  type FeatureKey,
  type Permission,
  type Role,
  type SessionContext,
} from '@sincvete/shared';
import { getSessionContext } from '@/lib/session';
import { createServerClient } from '@/lib/supabase/server';
import { ensurePlatformAdminRegistration } from '@/lib/superadmin';
import { canUseFeature, requireFeature } from '@/lib/entitlements';

export class PermissionError extends Error {
  constructor(message = 'No tenés permisos para esta acción') {
    super(message);
    this.name = 'PermissionError';
  }
}

export async function requireSession(): Promise<SessionContext> {
  const session = await getSessionContext();
  if (!session) {
    throw new PermissionError('Sesión no válida');
  }
  return session;
}

export async function requirePortalSession(): Promise<SessionContext> {
  const session = await requireSession();
  if (session.kind !== 'portal' || !session.ownerId) {
    throw new PermissionError('Esta cuenta no tiene acceso al portal');
  }
  return session;
}

export async function requirePermission(
  permission: Permission | Permission[]
): Promise<SessionContext> {
  const session = await requireSession();
  if (!hasPermission(session.permissions, permission)) {
    throw new PermissionError();
  }
  return session;
}

export async function requirePermissionAndFeature(
  permission: Permission | Permission[],
  featureKey: FeatureKey
): Promise<SessionContext> {
  const session = await requirePermission(permission);
  await requireFeature(session.organizationId, featureKey);
  return session;
}

export async function requirePermissionIfFeature(
  permission: Permission | Permission[],
  featureKey: FeatureKey
): Promise<SessionContext | null> {
  const session = await requirePermission(permission);
  const allowed = await canUseFeature({
    organizationId: session.organizationId,
    featureKey,
  });
  return allowed ? session : null;
}

export async function canPermissionAndFeature(
  permission: Permission,
  featureKey: FeatureKey
): Promise<boolean> {
  const session = await getSessionContext();
  if (!session || !hasPermission(session.permissions, permission)) return false;
  return canUseFeature({
    organizationId: session.organizationId,
    featureKey,
  });
}

export async function requireSuperadmin(): Promise<SessionContext> {
  const session = await requireSession();
  if (!session.isPlatformAdmin) {
    throw new PermissionError('No tenés acceso de Superadmin');
  }
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  await ensurePlatformAdminRegistration(session.userId, user?.email ?? null);
  return session;
}

export function resolveMembershipForBranch(
  memberships: Array<{ branch_id: string; role: Role; permissions: Permission[] | null }>,
  preferredBranchId: string | null | undefined
) {
  if (preferredBranchId) {
    const match = memberships.find((m) => m.branch_id === preferredBranchId);
    if (match) return match;
  }
  return memberships[0] ?? null;
}

export function membershipPermissions(role: Role, custom: Permission[] | null) {
  return getPermissionsForRole(role, custom);
}
