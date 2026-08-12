import { notFound, redirect } from 'next/navigation';
import { canReadAudit, getAuditLog } from '@/actions/audit';
import { AuditLogDetailView } from '@/components/audit/audit-log-detail';

interface AuditoriaDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function AuditoriaDetailPage({ params }: AuditoriaDetailPageProps) {
  const canRead = await canReadAudit();
  if (!canRead) redirect('/dashboard');

  const { id } = await params;
  const log = await getAuditLog(id);
  if (!log) notFound();

  return <AuditLogDetailView log={log} />;
}
