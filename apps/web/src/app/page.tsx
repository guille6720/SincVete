import type { Metadata } from 'next';
import { SyncVeteHomeLanding } from '@/components/landing/syncvete-home-landing';
import { APP_NAME } from '@sincvete/shared';
import { listPublicPlansCatalog } from '@/lib/billing/catalog';

export const metadata: Metadata = {
  title: `${APP_NAME} — Gestión veterinaria para clínicas argentinas`,
  description: `Suscribite a ${APP_NAME}: agenda, historia clínica, farmacia, caja y portal del tutor. Trial al registrar tu clínica.`,
};

export default async function LandingPage() {
  const plans = await listPublicPlansCatalog();
  return <SyncVeteHomeLanding plans={plans} />;
}
