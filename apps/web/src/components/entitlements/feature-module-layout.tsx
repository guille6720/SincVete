import type { ReactNode } from 'react';
import type { FeatureKey } from '@sincvete/shared';
import { getSessionContext } from '@/lib/session';
import { canUseFeature } from '@/lib/entitlements';
import { FeatureUnavailableNotice } from '@/components/entitlements/feature-gate';

export async function FeatureModuleLayout({
  feature,
  title,
  children,
}: {
  feature: FeatureKey;
  title: string;
  children: ReactNode;
}) {
  const session = await getSessionContext();
  if (!session) {
    return children;
  }
  const allowed = await canUseFeature({
    organizationId: session.organizationId,
    featureKey: feature,
  });
  if (!allowed) {
    return (
      <FeatureUnavailableNotice
        title={`${title} no está en tu plan`}
        description="Este módulo pertenece a un plan superior. Podés seguir usando el resto de la clínica."
      />
    );
  }
  return <>{children}</>;
}
