import type { ClinicalImageKind } from '../constants/images';
import type { PatientSpecies } from '../constants/patients';

export interface ClinicalImage {
  id: string;
  organization_id: string;
  branch_id: string | null;
  patient_id: string;
  owner_id: string;
  consultation_id: string | null;
  clinical_entry_id: string | null;
  uploaded_by: string | null;
  kind: ClinicalImageKind;
  title: string | null;
  notes: string | null;
  storage_path: string;
  mime_type: string;
  file_size: number;
  original_name: string | null;
  taken_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ClinicalImageListRow extends ClinicalImage {
  patient_name: string;
  patient_species: PatientSpecies;
  owner_full_name: string;
  uploaded_by_name: string | null;
  signed_url: string | null;
}
