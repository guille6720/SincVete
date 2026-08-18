import { FEATURES } from '@sincvete/shared';
import { FeatureModuleLayout } from '@/components/entitlements/feature-module-layout';

export default function AuditoriaLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureModuleLayout feature={FEATURES.AUDIT} title="Auditoría">
      {children}
    </FeatureModuleLayout>
  );
}
