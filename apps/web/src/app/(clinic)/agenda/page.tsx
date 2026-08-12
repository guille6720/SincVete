import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import {
  listAppointments,
  getAssignableStaff,
  canManageAppointments,
  canReadAppointments,
} from '@/actions/appointments';
import { AppointmentsAgenda } from '@/components/appointments/appointments-agenda';
import {
  APPOINTMENT_STATUSES,
  getWeekStartDate,
  parseDateParam,
  type AppointmentStatus,
} from '@sincvete/shared';

interface AgendaPageProps {
  searchParams: Promise<{
    date?: string;
    week?: string;
    status?: string;
    assigned?: string;
  }>;
}

export default async function AgendaPage({ searchParams }: AgendaPageProps) {
  const canRead = await canReadAppointments();
  if (!canRead) redirect('/dashboard');

  const params = await searchParams;
  const selectedDate = parseDateParam(params.date);
  const weekStart = params.week ?? getWeekStartDate(selectedDate);
  const statusParam = params.status?.trim() ?? '';
  const status = APPOINTMENT_STATUSES.includes(statusParam as AppointmentStatus)
    ? (statusParam as AppointmentStatus)
    : undefined;

  const [appointments, staff, canWrite] = await Promise.all([
    listAppointments({
      weekStart,
      status,
      assignedUserId: params.assigned,
    }),
    getAssignableStaff(),
    canManageAppointments(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Agenda</h1>
        <p className="text-muted-foreground">Calendario semanal de citas</p>
      </div>

      <Suspense fallback={<div className="text-sm text-muted-foreground">Cargando...</div>}>
        <AppointmentsAgenda
          appointments={appointments}
          weekStart={weekStart}
          selectedDate={selectedDate}
          canWrite={canWrite}
          staff={staff}
          initialStatus={status ?? ''}
          initialAssignedUserId={params.assigned ?? ''}
        />
      </Suspense>
    </div>
  );
}
