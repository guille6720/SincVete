-- SincVete - Módulo 7: Internación

CREATE TYPE public.hospitalization_status AS ENUM (
  'internado',
  'observacion',
  'alta',
  'fallecido'
);

CREATE TYPE public.hospitalization_note_type AS ENUM (
  'evolucion',
  'tratamiento',
  'vitals',
  'otro'
);

CREATE TABLE public.hospitalizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  owner_id UUID NOT NULL REFERENCES public.owners(id) ON DELETE RESTRICT,
  consultation_id UUID REFERENCES public.consultations(id) ON DELETE SET NULL,
  clinical_entry_id UUID REFERENCES public.clinical_entries(id) ON DELETE SET NULL,
  veterinarian_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.hospitalization_status NOT NULL DEFAULT 'internado',
  admitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  discharged_at TIMESTAMPTZ,
  cage TEXT,
  reason TEXT NOT NULL CHECK (char_length(reason) BETWEEN 2 AND 500),
  diagnosis TEXT,
  treatment_plan TEXT,
  discharge_summary TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_hospitalizations_org_admitted ON public.hospitalizations (organization_id, admitted_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_hospitalizations_patient ON public.hospitalizations (patient_id, admitted_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_hospitalizations_status ON public.hospitalizations (organization_id, status, admitted_at DESC)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX idx_hospitalizations_patient_active
  ON public.hospitalizations (patient_id)
  WHERE deleted_at IS NULL AND status IN ('internado', 'observacion');

CREATE TABLE public.hospitalization_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  hospitalization_id UUID NOT NULL REFERENCES public.hospitalizations(id) ON DELETE CASCADE,
  recorded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  note_type public.hospitalization_note_type NOT NULL DEFAULT 'evolucion',
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 5000),
  weight_kg NUMERIC(6, 2),
  temperature_c NUMERIC(4, 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_hospitalization_notes_stay ON public.hospitalization_notes (hospitalization_id, recorded_at DESC)
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_hospitalizations_updated_at
  BEFORE UPDATE ON public.hospitalizations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_hospitalization_notes_updated_at
  BEFORE UPDATE ON public.hospitalization_notes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_audit_hospitalizations
  AFTER INSERT OR UPDATE OR DELETE ON public.hospitalizations
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

CREATE TRIGGER trg_audit_hospitalization_notes
  AFTER INSERT OR UPDATE OR DELETE ON public.hospitalization_notes
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

ALTER TABLE public.hospitalizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hospitalization_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "hospitalizations_select_tenant" ON public.hospitalizations
  FOR SELECT USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('clinical:read')
  );

CREATE POLICY "hospitalizations_insert_tenant" ON public.hospitalizations
  FOR INSERT WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.has_permission('clinical:write')
  );

CREATE POLICY "hospitalizations_update_tenant" ON public.hospitalizations
  FOR UPDATE USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('clinical:write')
  );

CREATE POLICY "hospitalization_notes_select_tenant" ON public.hospitalization_notes
  FOR SELECT USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('clinical:read')
  );

CREATE POLICY "hospitalization_notes_insert_tenant" ON public.hospitalization_notes
  FOR INSERT WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.has_permission('clinical:write')
  );

CREATE POLICY "hospitalization_notes_update_tenant" ON public.hospitalization_notes
  FOR UPDATE USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('clinical:write')
  );

CREATE OR REPLACE FUNCTION public.list_active_hospitalizations(
  p_branch_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  branch_id UUID,
  patient_id UUID,
  owner_id UUID,
  consultation_id UUID,
  clinical_entry_id UUID,
  veterinarian_id UUID,
  status public.hospitalization_status,
  admitted_at TIMESTAMPTZ,
  discharged_at TIMESTAMPTZ,
  cage TEXT,
  reason TEXT,
  diagnosis TEXT,
  treatment_plan TEXT,
  discharge_summary TEXT,
  notes TEXT,
  patient_name TEXT,
  patient_species public.patient_species,
  owner_full_name TEXT,
  veterinarian_name TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
BEGIN
  v_org_id := public.get_user_organization_id();

  IF v_org_id IS NULL OR NOT public.has_permission('clinical:read') THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    h.id, h.organization_id, h.branch_id, h.patient_id, h.owner_id,
    h.consultation_id, h.clinical_entry_id, h.veterinarian_id, h.status,
    h.admitted_at, h.discharged_at, h.cage, h.reason, h.diagnosis,
    h.treatment_plan, h.discharge_summary, h.notes,
    p.name AS patient_name,
    p.species AS patient_species,
    o.full_name AS owner_full_name,
    pr.full_name AS veterinarian_name,
    h.created_at, h.updated_at
  FROM public.hospitalizations h
  INNER JOIN public.patients p ON p.id = h.patient_id AND p.deleted_at IS NULL
  INNER JOIN public.owners o ON o.id = h.owner_id AND o.deleted_at IS NULL
  LEFT JOIN public.profiles pr ON pr.id = h.veterinarian_id
  WHERE h.organization_id = v_org_id
    AND h.deleted_at IS NULL
    AND h.status IN ('internado', 'observacion')
    AND (p_branch_id IS NULL OR h.branch_id = p_branch_id)
  ORDER BY h.admitted_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_active_hospitalizations TO authenticated;

CREATE OR REPLACE FUNCTION public.search_hospitalizations(
  p_search TEXT DEFAULT NULL,
  p_patient_id UUID DEFAULT NULL,
  p_branch_id UUID DEFAULT NULL,
  p_status TEXT DEFAULT NULL,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 25
)
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  branch_id UUID,
  patient_id UUID,
  owner_id UUID,
  consultation_id UUID,
  clinical_entry_id UUID,
  veterinarian_id UUID,
  status public.hospitalization_status,
  admitted_at TIMESTAMPTZ,
  discharged_at TIMESTAMPTZ,
  cage TEXT,
  reason TEXT,
  diagnosis TEXT,
  treatment_plan TEXT,
  discharge_summary TEXT,
  notes TEXT,
  patient_name TEXT,
  patient_species public.patient_species,
  owner_full_name TEXT,
  veterinarian_name TEXT,
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
      h.*,
      p.name AS pat_name,
      p.species AS pat_species,
      o.full_name AS own_name,
      pr.full_name AS vet_name
    FROM public.hospitalizations h
    INNER JOIN public.patients p ON p.id = h.patient_id AND p.deleted_at IS NULL
    INNER JOIN public.owners o ON o.id = h.owner_id AND o.deleted_at IS NULL
    LEFT JOIN public.profiles pr ON pr.id = h.veterinarian_id
    WHERE h.organization_id = v_org_id
      AND h.deleted_at IS NULL
      AND (p_patient_id IS NULL OR h.patient_id = p_patient_id)
      AND (p_branch_id IS NULL OR h.branch_id = p_branch_id)
      AND (p_status IS NULL OR btrim(p_status) = '' OR h.status::TEXT = p_status)
      AND (
        p_search IS NULL
        OR btrim(p_search) = ''
        OR h.reason ILIKE '%' || p_search || '%'
        OR h.diagnosis ILIKE '%' || p_search || '%'
        OR h.cage ILIKE '%' || p_search || '%'
        OR p.name ILIKE '%' || p_search || '%'
        OR o.full_name ILIKE '%' || p_search || '%'
      )
  ),
  counted AS (
    SELECT COUNT(*) AS cnt FROM filtered
  )
  SELECT
    f.id, f.organization_id, f.branch_id, f.patient_id, f.owner_id,
    f.consultation_id, f.clinical_entry_id, f.veterinarian_id, f.status,
    f.admitted_at, f.discharged_at, f.cage, f.reason, f.diagnosis,
    f.treatment_plan, f.discharge_summary, f.notes,
    f.pat_name, f.pat_species, f.own_name, f.vet_name,
    f.created_at, f.updated_at, c.cnt
  FROM filtered f
  CROSS JOIN counted c
  ORDER BY f.admitted_at DESC
  LIMIT LEAST(GREATEST(p_page_size, 1), 100)
  OFFSET v_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_hospitalizations TO authenticated;

CREATE OR REPLACE FUNCTION public.discharge_hospitalization(
  p_hospitalization_id UUID,
  p_outcome TEXT,
  p_summary TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_stay public.hospitalizations%ROWTYPE;
  v_entry_id UUID;
  v_status public.hospitalization_status;
BEGIN
  v_org_id := public.get_user_organization_id();

  IF v_org_id IS NULL OR NOT public.has_permission('clinical:write') THEN
    RAISE EXCEPTION 'Sin permisos para dar el alta';
  END IF;

  IF p_outcome NOT IN ('alta', 'fallecido') THEN
    RAISE EXCEPTION 'Resultado de internación inválido';
  END IF;

  v_status := p_outcome::public.hospitalization_status;

  SELECT * INTO v_stay
  FROM public.hospitalizations
  WHERE id = p_hospitalization_id
    AND organization_id = v_org_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Internación no encontrada';
  END IF;

  IF v_stay.status IN ('alta', 'fallecido') THEN
    RETURN jsonb_build_object(
      'hospitalization_id', v_stay.id,
      'clinical_entry_id', v_stay.clinical_entry_id
    );
  END IF;

  INSERT INTO public.clinical_entries (
    organization_id,
    branch_id,
    patient_id,
    owner_id,
    recorded_by,
    entry_date,
    entry_type,
    title,
    diagnosis,
    treatment,
    plan,
    notes
  ) VALUES (
    v_stay.organization_id,
    v_stay.branch_id,
    v_stay.patient_id,
    v_stay.owner_id,
    COALESCE(v_stay.veterinarian_id, auth.uid()),
    now(),
    'internacion',
    CASE WHEN v_status = 'fallecido' THEN 'Internación — fallecimiento' ELSE 'Alta de internación' END,
    v_stay.diagnosis,
    v_stay.treatment_plan,
    COALESCE(p_summary, v_stay.discharge_summary),
    CONCAT_WS(
      E'\n',
      CASE WHEN v_stay.cage IS NOT NULL AND btrim(v_stay.cage) <> '' THEN 'Jaula/box: ' || v_stay.cage END,
      'Motivo: ' || v_stay.reason
    )
  )
  RETURNING id INTO v_entry_id;

  UPDATE public.hospitalizations
  SET
    status = v_status,
    discharged_at = now(),
    discharge_summary = COALESCE(p_summary, discharge_summary),
    clinical_entry_id = v_entry_id
  WHERE id = v_stay.id;

  IF v_status = 'fallecido' THEN
    UPDATE public.patients
    SET is_deceased = true, deceased_at = CURRENT_DATE, is_active = false
    WHERE id = v_stay.patient_id
      AND deleted_at IS NULL;
  END IF;

  RETURN jsonb_build_object(
    'hospitalization_id', v_stay.id,
    'clinical_entry_id', v_entry_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.discharge_hospitalization TO authenticated;
