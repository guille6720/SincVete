import {
  getPermissionsForRole,
  hasPermission,
  type Permission,
  type Role,
  type SessionContext,
} from '@sincvete/shared';
import { getSessionContext } from '@/lib/session';
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
