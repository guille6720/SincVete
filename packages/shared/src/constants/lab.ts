export const LAB_ORDER_STATUSES = [
  'solicitada',
  'en_proceso',
  'completada',
  'cancelada',
] as const;

export type LabOrderStatus = (typeof LAB_ORDER_STATUSES)[number];

export const LAB_ORDER_STATUS_LABELS: Record<LabOrderStatus, string> = {
  solicitada: 'Solicitada',
  en_proceso: 'En proceso',
  completada: 'Completada',
  cancelada: 'Cancelada',
};

export const LAB_ORDER_STATUS_VARIANT: Record<
  LabOrderStatus,
  'default' | 'success' | 'warning' | 'destructive'
> = {
  solicitada: 'default',
  en_proceso: 'warning',
  completada: 'success',
  cancelada: 'destructive',
};

export const LAB_QUEUE_STATUSES = ['solicitada', 'en_proceso'] as const;

export const LAB_PRIORITIES = ['rutina', 'urgente'] as const;

export type LabPriority = (typeof LAB_PRIORITIES)[number];

export const LAB_PRIORITY_LABELS: Record<LabPriority, string> = {
  rutina: 'Rutina',
  urgente: 'Urgente',
};

export const LAB_PRIORITY_VARIANT: Record<
  LabPriority,
  'default' | 'success' | 'warning' | 'destructive'
> = {
  rutina: 'default',
  urgente: 'destructive',
};

export const LAB_SAMPLE_TYPES = [
  'sangre',
  'orina',
  'materia_fecal',
  'hisopado',
  'otro',
] as const;

export type LabSampleType = (typeof LAB_SAMPLE_TYPES)[number];

export const LAB_SAMPLE_TYPE_LABELS: Record<LabSampleType, string> = {
  sangre: 'Sangre',
  orina: 'Orina',
  materia_fecal: 'Materia fecal',
  hisopado: 'Hisopado',
  otro: 'Otra',
};

export const LAB_RESULT_FLAGS = [
  'pendiente',
  'normal',
  'alto',
  'bajo',
  'anormal',
] as const;

export type LabResultFlag = (typeof LAB_RESULT_FLAGS)[number];

export const LAB_RESULT_FLAG_LABELS: Record<LabResultFlag, string> = {
  pendiente: 'Pendiente',
  normal: 'Normal',
  alto: 'Alto',
  bajo: 'Bajo',
  anormal: 'Anormal',
};

export const LAB_RESULT_FLAG_VARIANT: Record<
  LabResultFlag,
  'default' | 'success' | 'warning' | 'destructive'
> = {
  pendiente: 'default',
  normal: 'success',
  alto: 'warning',
  bajo: 'warning',
  anormal: 'destructive',
};

export const LAB_TEST_PRESETS = [
  {
    id: 'hemograma',
    title: 'Hemograma completo',
    sampleType: 'sangre' as LabSampleType,
    tests: [
      'Hematocrito',
      'Hemoglobina',
      'Eritrocitos',
      'Leucocitos',
      'Plaquetas',
      'Neutrófilos',
      'Linfocitos',
      'Monocitos',
      'Eosinófilos',
    ],
  },
  {
    id: 'bioquimica',
    title: 'Bioquímica sanguínea',
    sampleType: 'sangre' as LabSampleType,
    tests: [
      'Urea',
      'Creatinina',
      'ALT / GPT',
      'ALP',
      'Glucosa',
      'Proteínas totales',
      'Albúmina',
      'Bilirrubina total',
    ],
  },
  {
    id: 'orina',
    title: 'Análisis de orina',
    sampleType: 'orina' as LabSampleType,
    tests: [
      'Densidad',
      'pH',
      'Proteínas',
      'Glucosa',
      'Cetonas',
      'Sangre / Hb',
      'Sedimento',
    ],
  },
  {
    id: 'copro',
    title: 'Coproparasitológico',
    sampleType: 'materia_fecal' as LabSampleType,
    tests: ['Parásitos / huevos', 'Sangre oculta'],
  },
  {
    id: 'parvo',
    title: 'Test rápido Parvovirus',
    sampleType: 'materia_fecal' as LabSampleType,
    tests: ['Parvovirus Ag'],
  },
  {
    id: 'fiv_felv',
    title: 'Test FIV / FeLV',
    sampleType: 'sangre' as LabSampleType,
    tests: ['FIV Ab', 'FeLV Ag'],
  },
  {
    id: 'otro',
    title: 'Otro estudio',
    sampleType: 'otro' as LabSampleType,
    tests: [] as string[],
  },
] as const;
