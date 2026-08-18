import { FEATURES } from '@sincvete/shared';
import { FeatureModuleLayout } from '@/components/entitlements/feature-module-layout';

export default function RecordatoriosLayout({ children }: { children: React.ReactNode }) {
  return (
    <FeatureModuleLayout feature={FEATURES.WHATSAPP_REMINDERS} title="Recordatorios">
      {children}
    </FeatureModuleLayout>
  );
}
