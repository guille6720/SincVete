import type { ConsultationStatus } from '../constants/consultations';
import type { AppointmentStatus, AppointmentType } from '../constants/appointments';
import type { PatientSpecies } from '../constants/patients';

export interface Consultation {
  id: string;
  organization_id: string;
  branch_id: string;
  patient_id: string;
  owner_id: string;
  appointment_id: string | null;
  clinical_entry_id: string | null;
  veterinarian_id: string | null;
  status: ConsultationStatus;
  started_at: string;
  completed_at: string | null;
  title: string | null;
  anamnesis: string | null;
  physical_exam: string | null;
  diagnosis: string | null;
  treatment: string | null;
  plan: string | null;
  weight_kg: number | null;
  temperature_c: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface ConsultationListRow extends Consultation {
  patient_name: string;
  patient_species: PatientSpecies;
  owner_full_name: string;
  veterinarian_name: string | null;
}

export interface ConsultationQueueItem {
  queue_kind: 'cita' | 'walkin';
  appointment_id: string | null;
  consultation_id: string | null;
  patient_id: string;
  owner_id: string;
  starts_at: string;
  appointment_status: AppointmentStatus | null;
  consultation_status: ConsultationStatus | null;
  appointment_type: AppointmentType | null;
  title: string | null;
  patient_name: string;
  patient_species: PatientSpecies;
  owner_full_name: string;
  veterinarian_name: string | null;
}
