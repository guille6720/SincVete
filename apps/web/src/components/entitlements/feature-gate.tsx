import type { ReactNode } from 'react';
import Link from 'next/link';
import type { FeatureKey, OrganizationEntitlements } from '@sincvete/shared';
import { canUseResolvedFeature } from '@sincvete/shared';

/**
 * FeatureGate is UX only.
 * It is NOT a security boundary — always enforce canUseFeature/requireFeature on the server.
 */
export function FeatureGate({
  feature,
  entitlements,
  children,
  fallback = null,
}: {
  feature: FeatureKey;
  /** Preloaded org entitlements from the server (never trust client-only flags). */
  entitlements: OrganizationEntitlements;
  children: ReactNode;
  fallback?: ReactNode;
}) {
  if (!canUseResolvedFeature(entitlements, feature)) {
    return <>{fallback}</>;
  }
  return <>{children}</>;
}

export function FeatureUnavailableNotice({
  title = 'Función no disponible',
  description = 'Esta función no está incluida en el plan actual de tu clínica.',
}: {
  title?: string;
  description?: string;
}) {
  return (
    <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-50">
      <p className="font-medium">{title}</p>
      <p className="mt-1 opacity-90">{description}</p>
      <Link
        href="/configuracion?tab=plan"
        className="mt-3 inline-flex font-medium underline underline-offset-4"
      >
        Ver planes
      </Link>
    </div>
  );
}
