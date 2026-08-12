import { notFound, redirect } from 'next/navigation';
import { getAppointment, canReadAppointments, canManageAppointments } from '@/actions/appointments';
import { canManageConsultations, getConsultationByAppointment } from '@/actions/consultations';
import { canSendWhatsApp } from '@/actions/whatsapp';
import { AppointmentDetail } from '@/components/appointments/appointment-detail';

interface CitaPageProps {
  params: Promise<{ id: string }>;
}

export default async function CitaDetailPage({ params }: CitaPageProps) {
  const canRead = await canReadAppointments();
  if (!canRead) redirect('/dashboard');

  const { id } = await params;
  const [appointment, canWrite, canStart, existingConsultation, canWhatsApp] = await Promise.all([
    getAppointment(id),
    canManageAppointments(),
    canManageConsultations(),
    getConsultationByAppointment(id).catch(() => null),
    canSendWhatsApp(),
  ]);

  if (!appointment) notFound();

  return (
    <AppointmentDetail
      appointment={appointment}
      canWrite={canWrite}
      canStartConsultation={canStart}
      canSendWhatsApp={canWhatsApp}
      consultationId={existingConsultation?.id ?? null}
    />
  );
}
