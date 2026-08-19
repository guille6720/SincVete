import { FEATURES } from '@sincvete/shared';
import { FeatureModuleLayout } from '@/components/entitlements/feature-module-layout';

export default function InternacionLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureModuleLayout feature={FEATURES.HOSPITALIZATION} title="Internación">
      {children}
    </FeatureModuleLayout>
  );
}
