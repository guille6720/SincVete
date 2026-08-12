import type { AppointmentStatus, AppointmentType } from '../constants/appointments';
import type { PatientSpecies } from '../constants/patients';

export interface Appointment {
  id: string;
  organization_id: string;
  branch_id: string;
  patient_id: string;
  owner_id: string;
  assigned_user_id: string | null;
  starts_at: string;
  ends_at: string;
  status: AppointmentStatus;
  appointment_type: AppointmentType;
  title: string | null;
  notes: string | null;
  cancellation_reason: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface AppointmentListRow extends Appointment {
  patient_name: string;
  patient_species: PatientSpecies;
  owner_full_name: string;
  assigned_user_name: string | null;
}

export interface AssignableStaffMember {
  userId: string;
  fullName: string;
  role: string;
}
