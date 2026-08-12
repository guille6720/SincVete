export const PRESCRIPTION_STATUSES = [
  'activa',
  'dispensada',
  'anulada',
] as const;

export type PrescriptionStatus = (typeof PRESCRIPTION_STATUSES)[number];

export const PRESCRIPTION_STATUS_LABELS: Record<PrescriptionStatus, string> = {
  activa: 'Activa',
  dispensada: 'Dispensada',
  anulada: 'Anulada',
};

export const PRESCRIPTION_STATUS_VARIANT: Record<
  PrescriptionStatus,
  'default' | 'success' | 'warning' | 'destructive'
> = {
  activa: 'warning',
  dispensada: 'success',
  anulada: 'destructive',
};

export const PRESCRIPTION_ROUTES = [
  'oral',
  'sc',
  'im',
  'topico',
  'oftalmico',
  'otico',
  'otro',
] as const;

export type PrescriptionRoute = (typeof PRESCRIPTION_ROUTES)[number];

export const PRESCRIPTION_ROUTE_LABELS: Record<PrescriptionRoute, string> = {
  oral: 'Oral',
  sc: 'SC',
  im: 'IM',
  topico: 'Tópico',
  oftalmico: 'Oftálmico',
  otico: 'Ótico',
  otro: 'Otra',
};

export const PRESCRIPTION_FREQUENCIES = [
  'cada 8 h',
  'cada 12 h',
  'cada 24 h',
  'SID',
  'BID',
  'TID',
  'única',
] as const;

export const MEDICATION_PRESETS = [
  {
    id: 'amoxi_clav',
    name: 'Amoxicilina + ácido clavulánico',
    dose: '12.5–25 mg/kg',
    frequency: 'cada 12 h',
    duration: '7 días',
    route: 'oral' as PrescriptionRoute,
  },
  {
    id: 'cefalexina',
    name: 'Cefalexina',
    dose: '20 mg/kg',
    frequency: 'cada 12 h',
    duration: '10 días',
    route: 'oral' as PrescriptionRoute,
  },
  {
    id: 'enrofloxacina',
    name: 'Enrofloxacina',
    dose: '5 mg/kg',
    frequency: 'cada 24 h',
    duration: '7 días',
    route: 'oral' as PrescriptionRoute,
  },
  {
    id: 'metronidazol',
    name: 'Metronidazol',
    dose: '15 mg/kg',
    frequency: 'cada 12 h',
    duration: '7 días',
    route: 'oral' as PrescriptionRoute,
  },
  {
    id: 'doxiciclina',
    name: 'Doxiciclina',
    dose: '5–10 mg/kg',
    frequency: 'cada 12 h',
    duration: '14 días',
    route: 'oral' as PrescriptionRoute,
  },
  {
    id: 'meloxicam',
    name: 'Meloxicam',
    dose: '0.1 mg/kg',
    frequency: 'cada 24 h',
    duration: '5 días',
    route: 'oral' as PrescriptionRoute,
  },
  {
    id: 'carprofeno',
    name: 'Carprofeno',
    dose: '2–4 mg/kg',
    frequency: 'cada 24 h',
    duration: '5 días',
    route: 'oral' as PrescriptionRoute,
  },
  {
    id: 'tramadol',
    name: 'Tramadol',
    dose: '2–4 mg/kg',
    frequency: 'cada 8 h',
    duration: '5 días',
    route: 'oral' as PrescriptionRoute,
  },
  {
    id: 'dipirona',
    name: 'Dipirona',
    dose: '25 mg/kg',
    frequency: 'cada 8 h',
    duration: '3 días',
    route: 'oral' as PrescriptionRoute,
  },
  {
    id: 'prednisolona',
    name: 'Prednisolona',
    dose: '0.5–1 mg/kg',
    frequency: 'cada 24 h',
    duration: '5 días',
    route: 'oral' as PrescriptionRoute,
  },
  {
    id: 'omeprazol',
    name: 'Omeprazol',
    dose: '1 mg/kg',
    frequency: 'cada 24 h',
    duration: '7 días',
    route: 'oral' as PrescriptionRoute,
  },
  {
    id: 'maropitant',
    name: 'Maropitant',
    dose: '1 mg/kg',
    frequency: 'cada 24 h',
    duration: '5 días',
    route: 'sc' as PrescriptionRoute,
  },
  {
    id: 'furosemida',
    name: 'Furosemida',
    dose: '2 mg/kg',
    frequency: 'cada 12 h',
    duration: 'según control',
    route: 'oral' as PrescriptionRoute,
  },
  {
    id: 'fenbendazol',
    name: 'Fenbendazol',
    dose: '50 mg/kg',
    frequency: 'cada 24 h',
    duration: '3 días',
    route: 'oral' as PrescriptionRoute,
  },
] as const;
