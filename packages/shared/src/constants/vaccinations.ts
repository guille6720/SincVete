import type { PatientSpecies } from './patients';

export const VACCINATION_DUE_SOON_DAYS = 30;

export const VACCINE_PRESETS = [
  { name: 'Antirrábica', intervalMonths: 12, species: ['Canino', 'Felino'] },
  { name: 'Séxtuple (DHPP + L)', intervalMonths: 12, species: ['Canino'] },
  { name: 'Óctuple', intervalMonths: 12, species: ['Canino'] },
  { name: 'Triple felina (PRC)', intervalMonths: 12, species: ['Felino'] },
  { name: 'Leucemia felina (FeLV)', intervalMonths: 12, species: ['Felino'] },
  { name: 'Tos de las perreras', intervalMonths: 12, species: ['Canino'] },
  { name: 'Bordetella', intervalMonths: 12, species: ['Canino'] },
  { name: 'Giardia', intervalMonths: 12, species: ['Canino'] },
  { name: 'Refuerzo cachorro (DHPP)', intervalMonths: 1, species: ['Canino'] },
  { name: 'Refuerzo gatito (PRC)', intervalMonths: 1, species: ['Felino'] },
  { name: 'Otra', intervalMonths: 12, species: [] },
] as const;

export type VaccinePresetName = (typeof VACCINE_PRESETS)[number]['name'];

export const VACCINATION_ROUTES = ['sc', 'im', 'in', 'oral', 'otro'] as const;

export type VaccinationRoute = (typeof VACCINATION_ROUTES)[number];

export const VACCINATION_ROUTE_LABELS: Record<VaccinationRoute, string> = {
  sc: 'Subcutánea (SC)',
  im: 'Intramuscular (IM)',
  in: 'Intranasal (IN)',
  oral: 'Oral',
  otro: 'Otra',
};

export const VACCINATION_DUE_STATUSES = [
  'vencida',
  'por_vencer',
  'al_dia',
  'sin_fecha',
] as const;

export type VaccinationDueStatus = (typeof VACCINATION_DUE_STATUSES)[number];

export const VACCINATION_DUE_STATUS_LABELS: Record<VaccinationDueStatus, string> = {
  vencida: 'Vencida',
  por_vencer: 'Por vencer',
  al_dia: 'Al día',
  sin_fecha: 'Sin fecha',
};

export const VACCINATION_DUE_STATUS_VARIANT: Record<
  VaccinationDueStatus,
  'default' | 'success' | 'warning' | 'destructive'
> = {
  vencida: 'destructive',
  por_vencer: 'warning',
  al_dia: 'success',
  sin_fecha: 'default',
};

export function vaccinePresetsForSpecies(species?: PatientSpecies) {
  if (!species) return VACCINE_PRESETS;
  return VACCINE_PRESETS.filter(
    (preset) => preset.species.length === 0 || (preset.species as readonly string[]).includes(species)
  );
}
