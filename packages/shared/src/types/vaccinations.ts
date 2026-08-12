import type { VaccinationDueStatus, VaccinationRoute } from '../constants/vaccinations';
import type { PatientSpecies } from '../constants/patients';

export interface Vaccination {
  id: string;
  organization_id: string;
  branch_id: string;
  patient_id: string;
  owner_id: string;
  consultation_id: string | null;
  clinical_entry_id: string | null;
  veterinarian_id: string | null;
  vaccine_name: string;
  manufacturer: string | null;
  lot_number: string | null;
  administered_at: string;
  next_due_at: string | null;
  route: VaccinationRoute | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface VaccinationListRow extends Vaccination {
  patient_name: string;
  patient_species: PatientSpecies;
  owner_full_name: string;
  veterinarian_name: string | null;
}

export interface VaccinationDueRow extends VaccinationListRow {
  due_status: VaccinationDueStatus;
}
