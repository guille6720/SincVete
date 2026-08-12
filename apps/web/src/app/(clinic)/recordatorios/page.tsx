import { redirect } from 'next/navigation';
import { canSendWhatsApp } from '@/actions/whatsapp';
import { canReadReminders, listClinicReminders } from '@/actions/reminders';
import { RemindersBoard } from '@/components/reminders/reminders-board';
import { countPendingReminders } from '@sincvete/shared';

export default async function RecordatoriosPage() {
  const canRead = await canReadReminders();
  if (!canRead) redirect('/dashboard');

  const [board, canSend] = await Promise.all([listClinicReminders(), canSendWhatsApp()]);
  const pending = countPendingReminders(board);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Recordatorios</h1>
        <p className="text-muted-foreground">
          Avisos de turnos, vacunas y saldos. {pending} pendiente{pending !== 1 ? 's' : ''}.
        </p>
      </div>
      <RemindersBoard board={board} canSend={canSend} />
    </div>
  );
}
