import type { Metadata } from 'next';
import { SyncVeteHomeLanding } from '@/components/landing/syncvete-home-landing';
import { APP_NAME } from '@sincvete/shared';

export const metadata: Metadata = {
  title: `${APP_NAME} — Gestión veterinaria para clínicas argentinas`,
  description: `Suscribite a ${APP_NAME}: agenda, historia clínica, farmacia, caja y portal del tutor. 10 días gratis.`,
};

export default function LandingPage() {
  return <SyncVeteHomeLanding />;
}
