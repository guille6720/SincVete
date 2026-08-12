import { redirect } from 'next/navigation';
import { canReadReports, getClinicReport } from '@/actions/reports';
import { getOrganization } from '@/actions/settings';
import { ReportsView } from '@/components/reports/reports-view';
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
