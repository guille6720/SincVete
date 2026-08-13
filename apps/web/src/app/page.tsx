import type { Metadata } from 'next';
import { SincVeteHomeLanding } from '@/components/landing/sincvete-home-landing';
import { APP_NAME } from '@sincvete/shared';

export const metadata: Metadata = {
  title: `${APP_NAME} — Gestión veterinaria para clínicas argentinas`,
  description:
    'Suscribite a SincVete: agenda, historia clínica, farmacia, caja y portal del tutor. 10 días gratis.',
};

export default function LandingPage() {
  return <SincVeteHomeLanding />;
}
