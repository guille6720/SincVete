import { FEATURES } from '@sincvete/shared';
import { FeatureModuleLayout } from '@/components/entitlements/feature-module-layout';

export default function LaboratorioLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureModuleLayout feature={FEATURES.LABORATORY} title="Laboratorio">
      {children}
    </FeatureModuleLayout>
  );
}
