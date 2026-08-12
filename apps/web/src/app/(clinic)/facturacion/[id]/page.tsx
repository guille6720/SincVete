import { notFound, redirect } from 'next/navigation';
import { canManageBilling, canReadBilling, getInvoice } from '@/actions/billing';
import { canSendWhatsApp } from '@/actions/whatsapp';
import { InvoiceDetail } from '@/components/billing/invoice-detail';

interface FacturaDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function FacturaDetailPage({ params }: FacturaDetailPageProps) {
  const canRead = await canReadBilling();
  if (!canRead) redirect('/dashboard');

  const { id } = await params;
  const [data, canWrite, canWhatsApp] = await Promise.all([
    getInvoice(id),
    canManageBilling(),
    canSendWhatsApp(),
  ]);

  if (!data) notFound();

  return (
    <InvoiceDetail
      invoice={data.invoice}
      items={data.items}
      payments={data.payments}
      canWrite={canWrite}
      canSendWhatsApp={canWhatsApp}
    />
  );
}
