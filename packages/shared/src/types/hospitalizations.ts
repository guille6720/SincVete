import type {
  HospitalizationNoteType,
  HospitalizationStatus,
} from '../constants/hospitalizations';
import type { PatientSpecies } from '../constants/patients';

export interface Hospitalization {
  id: string;
  organization_id: string;
  branch_id: string;
  patient_id: string;
  owner_id: string;
  consultation_id: string | null;
  clinical_entry_id: string | null;
  veterinarian_id: string | null;
  status: HospitalizationStatus;
  admitted_at: string;
  discharged_at: string | null;
  cage: string | null;
  reason: string;
  diagnosis: string | null;
  treatment_plan: string | null;
  discharge_summary: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface HospitalizationListRow extends Hospitalization {
  patient_name: string;
  patient_species: PatientSpecies;
  owner_full_name: string;
  veterinarian_name: string | null;
}

export interface HospitalizationNote {
  id: string;
  organization_id: string;
  hospitalization_id: string;
  recorded_by: string | null;
  recorded_at: string;
  note_type: HospitalizationNoteType;
  content: string;
  weight_kg: number | null;
  temperature_c: number | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  recorded_by_name: string | null;
}
