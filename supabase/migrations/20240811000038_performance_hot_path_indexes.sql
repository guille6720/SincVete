-- Fase 8: hot-path indexes for clinical routes (no duplicates of existing org/patient/date indexes).
-- Based on migration audit + query patterns (list/search RPCs, portal by owner_id, farmacia activa, cola walk-in).
-- EXPLAIN against production not available in this environment; indexes are additive IF NOT EXISTS.

-- Appointments: patient timeline (upgrade from patient_id-only)
DROP INDEX IF EXISTS public.idx_appointments_patient;
CREATE INDEX IF NOT EXISTS idx_appointments_patient_starts
  ON public.appointments (patient_id, starts_at DESC)
  WHERE deleted_at IS NULL;

-- Owner-scoped lookups (portal + owner hub; invoices/whatsapp already had owner indexes)
CREATE INDEX IF NOT EXISTS idx_appointments_owner_starts
  ON public.appointments (owner_id, starts_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_clinical_entries_owner_date
  ON public.clinical_entries (owner_id, entry_date DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_consultations_owner_started
  ON public.consultations (owner_id, started_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_prescriptions_owner_prescribed
  ON public.prescriptions (owner_id, prescribed_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_vaccinations_owner_administered
  ON public.vaccinations (owner_id, administered_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_lab_orders_owner_ordered
  ON public.lab_orders (owner_id, ordered_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_hospitalizations_owner_admitted
  ON public.hospitalizations (owner_id, admitted_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_surgeries_owner_scheduled
  ON public.surgeries (owner_id, scheduled_at DESC)
  WHERE deleted_at IS NULL;

-- Farmacia board: status = 'activa' (narrower than org+status for large dispensed history)
CREATE INDEX IF NOT EXISTS idx_prescriptions_activa_board
  ON public.prescriptions (organization_id, branch_id, prescribed_at ASC)
  WHERE deleted_at IS NULL AND status = 'activa';

-- Consultation walk-in queue: appointment_id IS NULL + today range
CREATE INDEX IF NOT EXISTS idx_consultations_walkin_started
  ON public.consultations (organization_id, started_at DESC)
  WHERE deleted_at IS NULL AND appointment_id IS NULL;

-- Owners search: ILIKE on document / phone (full_name trgm already in 00037; tsvector GIN exists)
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS idx_owners_document_trgm
  ON public.owners USING gin (document_number extensions.gin_trgm_ops)
  WHERE deleted_at IS NULL AND document_number IS NOT NULL AND btrim(document_number) <> '';

CREATE INDEX IF NOT EXISTS idx_owners_phone_trgm
  ON public.owners USING gin (phone extensions.gin_trgm_ops)
  WHERE deleted_at IS NULL AND phone IS NOT NULL AND btrim(phone) <> '';
