-- SincVete - Módulo 5: Historia clínica

CREATE TYPE public.clinical_entry_type AS ENUM (
  'consulta',
  'cirugia',
  'internacion',
  'laboratorio',
  'vacunacion',
  'nota',
  'otro'
);

CREATE TABLE public.clinical_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  owner_id UUID NOT NULL REFERENCES public.owners(id) ON DELETE RESTRICT,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  entry_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  entry_type public.clinical_entry_type NOT NULL DEFAULT 'consulta',
  title TEXT,
  anamnesis TEXT,
  physical_exam TEXT,
  diagnosis TEXT,
  treatment TEXT,
  plan TEXT,
  weight_kg NUMERIC(6, 2),
  temperature_c NUMERIC(4, 1),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_clinical_entries_org_date ON public.clinical_entries (organization_id, entry_date DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_clinical_entries_patient_date ON public.clinical_entries (patient_id, entry_date DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_clinical_entries_branch_date ON public.clinical_entries (branch_id, entry_date DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_clinical_entries_search ON public.clinical_entries
  USING gin (
    to_tsvector(
      'spanish',
      coalesce(title, '') || ' ' ||
      coalesce(anamnesis, '') || ' ' ||
      coalesce(physical_exam, '') || ' ' ||
      coalesce(diagnosis, '') || ' ' ||
      coalesce(treatment, '') || ' ' ||
      coalesce(plan, '') || ' ' ||
      coalesce(notes, '')
    )
  )
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_clinical_entries_updated_at
  BEFORE UPDATE ON public.clinical_entries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_audit_clinical_entries
  AFTER INSERT OR UPDATE OR DELETE ON public.clinical_entries
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

ALTER TABLE public.clinical_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "clinical_entries_select_tenant" ON public.clinical_entries
  FOR SELECT USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('clinical:read')
  );

CREATE POLICY "clinical_entries_insert_tenant" ON public.clinical_entries
  FOR INSERT WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.has_permission('clinical:write')
  );

CREATE POLICY "clinical_entries_update_tenant" ON public.clinical_entries
  FOR UPDATE USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('clinical:write')
  );

CREATE OR REPLACE FUNCTION public.search_clinical_entries(
  p_search TEXT DEFAULT NULL,
  p_patient_id UUID DEFAULT NULL,
  p_branch_id UUID DEFAULT NULL,
  p_entry_type TEXT DEFAULT NULL,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 25
)
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  branch_id UUID,
  patient_id UUID,
  owner_id UUID,
  appointment_id UUID,
  recorded_by UUID,
  entry_date TIMESTAMPTZ,
  entry_type public.clinical_entry_type,
  title TEXT,
  anamnesis TEXT,
  physical_exam TEXT,
  diagnosis TEXT,
  treatment TEXT,
  plan TEXT,
  weight_kg NUMERIC,
  temperature_c NUMERIC,
  notes TEXT,
  patient_name TEXT,
  patient_species public.patient_species,
  owner_full_name TEXT,
  recorded_by_name TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  total_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_offset INT;
BEGIN
  v_org_id := public.get_user_organization_id();

  IF v_org_id IS NULL OR NOT public.has_permission('clinical:read') THEN
    RETURN;
  END IF;

  v_offset := GREATEST(p_page - 1, 0) * LEAST(GREATEST(p_page_size, 1), 100);

  RETURN QUERY
  WITH filtered AS (
    SELECT
      ce.*,
      p.name AS pat_name,
      p.species AS pat_species,
      o.full_name AS own_name,
      pr.full_name AS recorder_name
    FROM public.clinical_entries ce
    INNER JOIN public.patients p ON p.id = ce.patient_id AND p.deleted_at IS NULL
    INNER JOIN public.owners o ON o.id = ce.owner_id AND o.deleted_at IS NULL
    LEFT JOIN public.profiles pr ON pr.id = ce.recorded_by
    WHERE ce.organization_id = v_org_id
      AND ce.deleted_at IS NULL
      AND (p_patient_id IS NULL OR ce.patient_id = p_patient_id)
      AND (p_branch_id IS NULL OR ce.branch_id = p_branch_id)
      AND (p_entry_type IS NULL OR btrim(p_entry_type) = '' OR ce.entry_type::TEXT = p_entry_type)
      AND (
        p_search IS NULL
        OR btrim(p_search) = ''
        OR to_tsvector(
          'spanish',
          coalesce(ce.title, '') || ' ' ||
          coalesce(ce.anamnesis, '') || ' ' ||
          coalesce(ce.physical_exam, '') || ' ' ||
          coalesce(ce.diagnosis, '') || ' ' ||
          coalesce(ce.treatment, '') || ' ' ||
          coalesce(ce.plan, '') || ' ' ||
          coalesce(ce.notes, '') || ' ' ||
          coalesce(p.name, '') || ' ' ||
          coalesce(o.full_name, '')
        ) @@ plainto_tsquery('spanish', p_search)
        OR ce.title ILIKE '%' || p_search || '%'
        OR ce.diagnosis ILIKE '%' || p_search || '%'
        OR p.name ILIKE '%' || p_search || '%'
        OR o.full_name ILIKE '%' || p_search || '%'
      )
  ),
  counted AS (
    SELECT COUNT(*) AS cnt FROM filtered
  )
  SELECT
    f.id, f.organization_id, f.branch_id, f.patient_id, f.owner_id, f.appointment_id,
    f.recorded_by, f.entry_date, f.entry_type, f.title, f.anamnesis, f.physical_exam,
    f.diagnosis, f.treatment, f.plan, f.weight_kg, f.temperature_c, f.notes,
    f.pat_name, f.pat_species, f.own_name, f.recorder_name,
    f.created_at, f.updated_at, c.cnt
  FROM filtered f
  CROSS JOIN counted c
  ORDER BY f.entry_date DESC
  LIMIT LEAST(GREATEST(p_page_size, 1), 100)
  OFFSET v_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_clinical_entries TO authenticated;
