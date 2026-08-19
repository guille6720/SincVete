'use client';

import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { isClinicPathEntitled } from '@sincvete/shared';
import { FeatureUnavailableNotice } from '@/components/entitlements/feature-gate';

export function EntitlementRouteGate({
  entitledHrefs,
  children,
}: {
  entitledHrefs: string[] | null;
  children: ReactNode;
}) {
  const pathname = usePathname();
  if (isClinicPathEntitled(pathname, entitledHrefs)) {
    return <>{children}</>;
  }

  return (
    <FeatureUnavailableNotice
      title="Este módulo no está en tu plan"
      description="Podés seguir usando el resto de la clínica. Para habilitarlo, actualizá el plan."
    />
  );
}
