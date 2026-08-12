import type { ClinicalAiKind } from '../constants/clinical-ai';

export interface ClinicalAiContextPatient {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  sex: string | null;
  birth_date: string | null;
  is_neutered: boolean;
  is_deceased: boolean;
  owner_id: string;
  owner_name: string;
}

export interface ClinicalAiContextEntry {
  id: string;
  entry_date: string;
  entry_type: string;
  title: string | null;
  anamnesis: string | null;
  physical_exam: string | null;
  diagnosis: string | null;
  treatment: string | null;
  plan: string | null;
  weight_kg: number | null;
  temperature_c: number | null;
}

export interface ClinicalAiContextVaccination {
  vaccine_name: string;
  administered_at: string;
  next_due_at: string | null;
}

export interface ClinicalAiContext {
  patient: ClinicalAiContextPatient | null;
  entries: ClinicalAiContextEntry[];
  vaccinations: ClinicalAiContextVaccination[];
}

export interface ClinicalAiSoapSnapshot {
  title?: string | null;
  anamnesis?: string | null;
  physicalExam?: string | null;
  diagnosis?: string | null;
  treatment?: string | null;
  plan?: string | null;
  notes?: string | null;
  weightKg?: number | null;
  temperatureC?: number | null;
}

export interface ClinicalAiPatientSummary {
  summary: string;
  alerts: string[];
  lastDiagnoses: string[];
  pending: string[];
}

export interface ClinicalAiSoapAssist {
  diagnosis: string;
  differentials: string[];
  treatment: string;
  plan: string;
}

export interface ClinicalAiOwnerInstructions {
  title: string;
  body: string;
}

export type ClinicalAiOutput =
  | ClinicalAiPatientSummary
  | ClinicalAiSoapAssist
  | ClinicalAiOwnerInstructions;

export interface ClinicalAiSuggestion {
  id: string;
  organization_id: string;
  branch_id: string | null;
  patient_id: string;
  owner_id: string;
  consultation_id: string | null;
  clinical_entry_id: string | null;
  kind: ClinicalAiKind;
  prompt_hash: string;
  input_excerpt: string | null;
  output: ClinicalAiOutput | Record<string, unknown>;
  model: string;
  created_by: string | null;
  created_at: string;
}

export interface ClinicalAiSuggestionListRow extends ClinicalAiSuggestion {
  patient_name: string;
  owner_full_name: string;
  created_by_name: string | null;
}

export interface ClinicalAiGenerateResult {
  id: string;
  kind: ClinicalAiKind;
  output: ClinicalAiOutput;
  model: string;
}
