export const APPOINTMENT_STATUSES = [
  'programada',
  'confirmada',
  'en_curso',
  'completada',
  'cancelada',
  'ausente',
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const APPOINTMENT_TYPES = [
  'consulta',
  'vacunacion',
  'cirugia',
  'control',
  'emergencia',
  'otro',
] as const;

export type AppointmentType = (typeof APPOINTMENT_TYPES)[number];

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  programada: 'Programada',
  confirmada: 'Confirmada',
  en_curso: 'En curso',
  completada: 'Completada',
  cancelada: 'Cancelada',
  ausente: 'Ausente',
};

export const APPOINTMENT_TYPE_LABELS: Record<AppointmentType, string> = {
  consulta: 'Consulta',
  vacunacion: 'Vacunación',
  cirugia: 'Cirugía',
  control: 'Control',
  emergencia: 'Emergencia',
  otro: 'Otro',
};

export const APPOINTMENT_STATUS_VARIANT: Record<
  AppointmentStatus,
  'default' | 'success' | 'destructive' | 'warning'
> = {
  programada: 'default',
  confirmada: 'success',
  en_curso: 'warning',
  completada: 'success',
  cancelada: 'destructive',
  ausente: 'destructive',
};

export const DEFAULT_APPOINTMENT_DURATION_MINUTES = 30;

export const APPOINTMENT_DURATION_OPTIONS = [15, 30, 45, 60, 90, 120] as const;
