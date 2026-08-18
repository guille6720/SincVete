import { redirect } from 'next/navigation';
import { canReadReports, canUseBasicReports, getClinicReport } from '@/actions/reports';
import { getOrganization } from '@/actions/settings';
import { ReportsView } from '@/components/reports/reports-view';
import { FeatureUnavailableNotice } from '@/components/entitlements/feature-gate';
import {
  getReportPeriod,
  isValidReportRange,
  parseOrganizationSettings,
} from '@sincvete/shared';

interface ReportesPageProps {
  searchParams: Promise<{ from?: string; to?: string }>;
}

export default async function ReportesPage({ searchParams }: ReportesPageProps) {
  const canRead = await canReadReports();
  if (!canRead) redirect('/dashboard');

  const entitled = await canUseBasicReports();
  if (!entitled) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold tracking-tight">Reportes</h1>
        <FeatureUnavailableNotice
          title="Reportes no incluidos"
          description="Los reportes de operación forman parte de planes superiores."
        />
      </div>
    );
  }

  const params = await searchParams;
  const fallback = getReportPeriod('month');
  const from = params.from?.trim() || fallback.from;
  const to = params.to?.trim() || fallback.to;
  const range = isValidReportRange(from, to) ? { from, to } : fallback;

  const [report, organization] = await Promise.all([
    getClinicReport(range),
    getOrganization(),
  ]);
  const currency = parseOrganizationSettings(organization?.settings).currency ?? 'ARS';

  return <ReportsView report={report} currency={currency} />;
}
