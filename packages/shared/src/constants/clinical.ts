export const CLINICAL_ENTRY_TYPES = [
  'consulta',
  'cirugia',
  'internacion',
  'laboratorio',
  'vacunacion',
  'nota',
  'otro',
] as const;

export type ClinicalEntryType = (typeof CLINICAL_ENTRY_TYPES)[number];

export const CLINICAL_ENTRY_TYPE_LABELS: Record<ClinicalEntryType, string> = {
  consulta: 'Consulta',
  cirugia: 'Cirugía',
  internacion: 'Internación',
  laboratorio: 'Laboratorio',
  vacunacion: 'Vacunación',
  nota: 'Nota clínica',
  otro: 'Otro',
};

export const CLINICAL_ENTRY_TYPE_VARIANT: Record<
  ClinicalEntryType,
  'default' | 'success' | 'warning' | 'destructive'
> = {
  consulta: 'default',
  cirugia: 'warning',
  internacion: 'warning',
  laboratorio: 'default',
  vacunacion: 'success',
  nota: 'default',
  otro: 'default',
};

export const CLINICAL_FIELD_LABELS = {
  anamnesis: 'Anamnesis',
  physicalExam: 'Examen físico',
  diagnosis: 'Diagnóstico',
  treatment: 'Tratamiento',
  plan: 'Plan / observaciones',
  weightKg: 'Peso (kg)',
  temperatureC: 'Temperatura (°C)',
} as const;

/** Initial patient history page size (server-side). */
export const CLINICAL_HISTORY_PAGE_SIZE = 20;

/** Recent evolutions on patient detail hub. */
export const CLINICAL_RECENT_PAGE_SIZE = 5;
