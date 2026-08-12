export const CONSULTATION_STATUSES = [
  'en_espera',
  'en_curso',
  'completada',
  'cancelada',
] as const;

export type ConsultationStatus = (typeof CONSULTATION_STATUSES)[number];

export const CONSULTATION_STATUS_LABELS: Record<ConsultationStatus, string> = {
  en_espera: 'En espera',
  en_curso: 'En curso',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

export const CONSULTATION_STATUS_VARIANT: Record<
  ConsultationStatus,
  'default' | 'success' | 'warning' | 'destructive'
> = {
  en_espera: 'default',
  en_curso: 'warning',
  completada: 'success',
  cancelada: 'destructive',
};
