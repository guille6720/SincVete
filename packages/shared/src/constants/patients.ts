export const PATIENT_SPECIES = [
  'Canino',
  'Felino',
  'Ave',
  'Roedor',
  'Reptil',
  'Equino',
  'Bovino',
  'Otro',
] as const;

export type PatientSpecies = (typeof PATIENT_SPECIES)[number];

export const PATIENT_SEX = ['Macho', 'Hembra', 'Desconocido'] as const;

export type PatientSex = (typeof PATIENT_SEX)[number];

export const SPECIES_EMOJI: Record<PatientSpecies, string> = {
  Canino: '🐕',
  Felino: '🐈',
  Ave: '🐦',
  Roedor: '🐹',
  Reptil: '🦎',
  Equino: '🐴',
  Bovino: '🐄',
  Otro: '🐾',
};
