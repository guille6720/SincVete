import { FEATURES } from '@sincvete/shared';
import { FeatureModuleLayout } from '@/components/entitlements/feature-module-layout';

export default function ImagenesLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureModuleLayout feature={FEATURES.CLINICAL_IMAGES} title="Imágenes clínicas">
      {children}
    </FeatureModuleLayout>
  );
}
