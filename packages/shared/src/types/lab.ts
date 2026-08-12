import type {
  LabOrderStatus,
  LabPriority,
  LabResultFlag,
  LabSampleType,
} from '../constants/lab';
import type { PatientSpecies } from '../constants/patients';

export interface LabOrder {
  id: string;
  organization_id: string;
  branch_id: string;
  patient_id: string;
  owner_id: string;
  consultation_id: string | null;
  clinical_entry_id: string | null;
  ordered_by: string | null;
  completed_by: string | null;
  status: LabOrderStatus;
  priority: LabPriority;
  sample_type: LabSampleType | null;
  title: string;
  ordered_at: string;
  collected_at: string | null;
  completed_at: string | null;
  interpretation: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface LabOrderItem {
  id: string;
  organization_id: string;
  lab_order_id: string;
  test_name: string;
  result_value: string | null;
  unit: string | null;
  reference_range: string | null;
  flag: LabResultFlag;
  sort_order: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface LabOrderListRow extends LabOrder {
  item_count: number;
  patient_name: string;
  patient_species: PatientSpecies;
  owner_full_name: string;
  ordered_by_name: string | null;
}
