import { notFound, redirect } from 'next/navigation';
import { getLabOrder, canReadLab, canManageLab } from '@/actions/lab';
import { canSendWhatsApp } from '@/actions/whatsapp';
import { LabOrderDetail } from '@/components/lab/lab-order-detail';

interface LabDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function LabDetailPage({ params }: LabDetailPageProps) {
  const canRead = await canReadLab();
  if (!canRead) redirect('/dashboard');

  const { id } = await params;
  const [data, canWrite, canWhatsApp] = await Promise.all([getLabOrder(id), canManageLab(), canSendWhatsApp()]);

  if (!data) notFound();

  return (
    <LabOrderDetail
      order={data.order}
      items={data.items}
      canWrite={canWrite}
      canSendWhatsApp={canWhatsApp}
    />
  );
}
