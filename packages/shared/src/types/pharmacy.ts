import type { PrescriptionRoute, PrescriptionStatus } from '../constants/pharmacy';
import type { PatientSpecies } from '../constants/patients';

export interface Prescription {
  id: string;
  organization_id: string;
  branch_id: string;
  patient_id: string;
  owner_id: string;
  consultation_id: string | null;
  clinical_entry_id: string | null;
  prescribed_by: string | null;
  dispensed_by: string | null;
  voided_by: string | null;
  status: PrescriptionStatus;
  number: string | null;
  notes: string | null;
  void_reason: string | null;
  prescribed_at: string;
  dispensed_at: string | null;
  voided_at: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface PrescriptionItem {
  id: string;
  organization_id: string;
  prescription_id: string;
  inventory_product_id: string | null;
  medication_name: string;
  dose: string;
  frequency: string;
  duration: string | null;
  route: PrescriptionRoute;
  quantity: number;
  instructions: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface PrescriptionListRow extends Prescription {
  item_count: number;
  patient_name: string;
  patient_species: PatientSpecies;
  owner_full_name: string;
  prescribed_by_name: string | null;
}
