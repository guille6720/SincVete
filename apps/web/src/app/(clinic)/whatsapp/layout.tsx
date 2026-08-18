import { FEATURES } from '@sincvete/shared';
import { FeatureModuleLayout } from '@/components/entitlements/feature-module-layout';

export default function WhatsappLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureModuleLayout feature={FEATURES.WHATSAPP} title="WhatsApp">
      {children}
    </FeatureModuleLayout>
  );
}
