export const HOSPITALIZATION_STATUSES = [
  'internado',
  'observacion',
  'alta',
  'fallecido',
] as const;

export type HospitalizationStatus = (typeof HOSPITALIZATION_STATUSES)[number];

export const HOSPITALIZATION_STATUS_LABELS: Record<HospitalizationStatus, string> = {
  internado: 'Internado',
  observacion: 'Observación',
  alta: 'Alta',
  fallecido: 'Fallecido',
};

export const HOSPITALIZATION_STATUS_VARIANT: Record<
  HospitalizationStatus,
  'default' | 'success' | 'warning' | 'destructive'
> = {
  internado: 'warning',
  observacion: 'default',
  alta: 'success',
  fallecido: 'destructive',
};

export const HOSPITALIZATION_ACTIVE_STATUSES = ['internado', 'observacion'] as const;

export type HospitalizationActiveStatus = (typeof HOSPITALIZATION_ACTIVE_STATUSES)[number];

export const HOSPITALIZATION_NOTE_TYPES = [
  'evolucion',
  'tratamiento',
  'vitals',
  'otro',
] as const;

export type HospitalizationNoteType = (typeof HOSPITALIZATION_NOTE_TYPES)[number];

export const HOSPITALIZATION_NOTE_TYPE_LABELS: Record<HospitalizationNoteType, string> = {
  evolucion: 'Evolución',
  tratamiento: 'Tratamiento',
  vitals: 'Signos vitales',
  otro: 'Otro',
};

export const HOSPITALIZATION_OUTCOMES = ['alta', 'fallecido'] as const;

export type HospitalizationOutcome = (typeof HOSPITALIZATION_OUTCOMES)[number];

export const HOSPITALIZATION_OUTCOME_LABELS: Record<HospitalizationOutcome, string> = {
  alta: 'Alta',
  fallecido: 'Fallecimiento',
};
