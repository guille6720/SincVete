import type {
  SurgeryAnesthesia,
  SurgeryAsa,
  SurgeryStatus,
} from '../constants/surgeries';
import type { PatientSpecies } from '../constants/patients';

export interface Surgery {
  id: string;
  organization_id: string;
  branch_id: string;
  patient_id: string;
  owner_id: string;
  appointment_id: string | null;
  consultation_id: string | null;
  clinical_entry_id: string | null;
  surgeon_id: string | null;
  status: SurgeryStatus;
  scheduled_at: string;
  started_at: string | null;
  completed_at: string | null;
  procedure_name: string;
  diagnosis: string | null;
  anesthesia: SurgeryAnesthesia | null;
  asa: SurgeryAsa | null;
  preop_notes: string | null;
  intraop_notes: string | null;
  postop_notes: string | null;
  complications: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface SurgeryListRow extends Surgery {
  patient_name: string;
  patient_species: PatientSpecies;
  owner_full_name: string;
  surgeon_name: string | null;
}
