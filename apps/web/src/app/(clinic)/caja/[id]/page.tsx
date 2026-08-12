import { notFound, redirect } from 'next/navigation';
import { getCashSession, canReadCash } from '@/actions/cash';
import { getOrganization } from '@/actions/settings';
import { CashSessionDetail } from '@/components/cash/cash-session-detail';
import { parseOrganizationSettings } from '@sincvete/shared';

interface CajaDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function CajaDetailPage({ params }: CajaDetailPageProps) {
  const canRead = await canReadCash();
  if (!canRead) redirect('/dashboard');

  const { id } = await params;
  const [data, organization] = await Promise.all([getCashSession(id), getOrganization()]);

  if (!data) notFound();

  const currency = parseOrganizationSettings(organization?.settings).currency ?? 'ARS';

  return (
    <CashSessionDetail
      session={data.session}
      movements={data.movements}
      currency={currency}
    />
  );
}
