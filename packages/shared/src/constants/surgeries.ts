export const SURGERY_STATUSES = [
  'programada',
  'en_curso',
  'recuperacion',
  'completada',
  'cancelada',
] as const;

export type SurgeryStatus = (typeof SURGERY_STATUSES)[number];

export const SURGERY_STATUS_LABELS: Record<SurgeryStatus, string> = {
  programada: 'Programada',
  en_curso: 'En quirófano',
  recuperacion: 'Recuperación',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

export const SURGERY_STATUS_VARIANT: Record<
  SurgeryStatus,
  'default' | 'success' | 'warning' | 'destructive'
> = {
  programada: 'default',
  en_curso: 'warning',
  recuperacion: 'warning',
  completada: 'success',
  cancelada: 'destructive',
};

export const SURGERY_ACTIVE_STATUSES = ['en_curso', 'recuperacion'] as const;

export const SURGERY_BOARD_STATUSES = ['programada', 'en_curso', 'recuperacion'] as const;

export const SURGERY_ASA_GRADES = ['I', 'II', 'III', 'IV', 'V'] as const;

export type SurgeryAsa = (typeof SURGERY_ASA_GRADES)[number];

export const SURGERY_ASA_LABELS: Record<SurgeryAsa, string> = {
  I: 'ASA I — sano',
  II: 'ASA II — enfermedad leve',
  III: 'ASA III — enfermedad grave',
  IV: 'ASA IV — amenaza de vida',
  V: 'ASA V — moribundo',
};

export const SURGERY_ANESTHESIA_TYPES = [
  'general',
  'sedacion',
  'local',
  'epidural',
  'otro',
] as const;

export type SurgeryAnesthesia = (typeof SURGERY_ANESTHESIA_TYPES)[number];

export const SURGERY_ANESTHESIA_LABELS: Record<SurgeryAnesthesia, string> = {
  general: 'General',
  sedacion: 'Sedación',
  local: 'Local',
  epidural: 'Epidural',
  otro: 'Otra',
};

export const SURGERY_PROCEDURE_PRESETS = [
  'Castración',
  'Ovariohisterectomía (OH)',
  'Tartrectomía / limpieza dental',
  'Extracción dental',
  'Cesárea',
  'Gastropexia',
  'Gastrotomía / enterotomía',
  'Cistotomía',
  'Herniorrafia',
  'Extirpación de masa',
  'Enucleación',
  'Amputación',
  'Osteosíntesis / fractura',
  'Otra',
] as const;
