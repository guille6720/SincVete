-- SincVete - Módulo 9: Cirugías

CREATE TYPE public.surgery_status AS ENUM (
  'programada',
  'en_curso',
  'recuperacion',
  'completada',
  'cancelada'
);

CREATE TYPE public.surgery_asa AS ENUM ('I', 'II', 'III', 'IV', 'V');

CREATE TYPE public.surgery_anesthesia AS ENUM (
  'general',
  'sedacion',
  'local',
  'epidural',
  'otro'
);

CREATE TABLE public.surgeries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  owner_id UUID NOT NULL REFERENCES public.owners(id) ON DELETE RESTRICT,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  consultation_id UUID REFERENCES public.consultations(id) ON DELETE SET NULL,
  clinical_entry_id UUID REFERENCES public.clinical_entries(id) ON DELETE SET NULL,
  surgeon_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.surgery_status NOT NULL DEFAULT 'programada',
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  procedure_name TEXT NOT NULL CHECK (char_length(procedure_name) BETWEEN 2 AND 160),
  diagnosis TEXT,
  anesthesia public.surgery_anesthesia,
  asa public.surgery_asa,
  preop_notes TEXT,
  intraop_notes TEXT,
  postop_notes TEXT,
  complications TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_surgeries_org_scheduled ON public.surgeries (organization_id, scheduled_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_surgeries_patient ON public.surgeries (patient_id, scheduled_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_surgeries_status ON public.surgeries (organization_id, status, scheduled_at DESC)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX idx_surgeries_patient_active
  ON public.surgeries (patient_id)
  WHERE deleted_at IS NULL AND status IN ('en_curso', 'recuperacion');

CREATE TRIGGER trg_surgeries_updated_at
  BEFORE UPDATE ON public.surgeries
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_audit_surgeries
  AFTER INSERT OR UPDATE OR DELETE ON public.surgeries
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

ALTER TABLE public.surgeries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "surgeries_select_tenant" ON public.surgeries
  FOR SELECT USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('clinical:read')
  );

CREATE POLICY "surgeries_insert_tenant" ON public.surgeries
  FOR INSERT WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.has_permission('clinical:write')
  );

CREATE POLICY "surgeries_update_tenant" ON public.surgeries
  FOR UPDATE USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('clinical:write')
  );

CREATE OR REPLACE FUNCTION public.list_surgery_board(
  p_branch_id UUID DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  branch_id UUID,
  patient_id UUID,
  owner_id UUID,
  appointment_id UUID,
  consultation_id UUID,
  clinical_entry_id UUID,
  surgeon_id UUID,
  status public.surgery_status,
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  procedure_name TEXT,
  diagnosis TEXT,
  anesthesia public.surgery_anesthesia,
  asa public.surgery_asa,
  preop_notes TEXT,
  intraop_notes TEXT,
  postop_notes TEXT,
  complications TEXT,
  notes TEXT,
  patient_name TEXT,
  patient_species public.patient_species,
  owner_full_name TEXT,
  surgeon_name TEXT,
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
    s.id, s.organization_id, s.branch_id, s.patient_id, s.owner_id,
    s.appointment_id, s.consultation_id, s.clinical_entry_id, s.surgeon_id,
    s.status, s.scheduled_at, s.started_at, s.completed_at, s.procedure_name,
    s.diagnosis, s.anesthesia, s.asa, s.preop_notes, s.intraop_notes,
    s.postop_notes, s.complications, s.notes,
    p.name AS patient_name,
    p.species AS patient_species,
    o.full_name AS owner_full_name,
    pr.full_name AS surgeon_name,
    s.created_at, s.updated_at
  FROM public.surgeries s
  INNER JOIN public.patients p ON p.id = s.patient_id AND p.deleted_at IS NULL
  INNER JOIN public.owners o ON o.id = s.owner_id AND o.deleted_at IS NULL
  LEFT JOIN public.profiles pr ON pr.id = s.surgeon_id
  WHERE s.organization_id = v_org_id
    AND s.deleted_at IS NULL
    AND s.status IN ('programada', 'en_curso', 'recuperacion')
    AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
  ORDER BY
    CASE s.status
      WHEN 'en_curso' THEN 0
      WHEN 'recuperacion' THEN 1
      ELSE 2
    END,
    s.scheduled_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_surgery_board TO authenticated;

CREATE OR REPLACE FUNCTION public.search_surgeries(
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
  appointment_id UUID,
  consultation_id UUID,
  clinical_entry_id UUID,
  surgeon_id UUID,
  status public.surgery_status,
  scheduled_at TIMESTAMPTZ,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  procedure_name TEXT,
  diagnosis TEXT,
  anesthesia public.surgery_anesthesia,
  asa public.surgery_asa,
  preop_notes TEXT,
  intraop_notes TEXT,
  postop_notes TEXT,
  complications TEXT,
  notes TEXT,
  patient_name TEXT,
  patient_species public.patient_species,
  owner_full_name TEXT,
  surgeon_name TEXT,
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
      s.*,
      p.name AS pat_name,
      p.species AS pat_species,
      o.full_name AS own_name,
      pr.full_name AS surg_name
    FROM public.surgeries s
    INNER JOIN public.patients p ON p.id = s.patient_id AND p.deleted_at IS NULL
    INNER JOIN public.owners o ON o.id = s.owner_id AND o.deleted_at IS NULL
    LEFT JOIN public.profiles pr ON pr.id = s.surgeon_id
    WHERE s.organization_id = v_org_id
      AND s.deleted_at IS NULL
      AND (p_patient_id IS NULL OR s.patient_id = p_patient_id)
      AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
      AND (p_status IS NULL OR btrim(p_status) = '' OR s.status::TEXT = p_status)
      AND (
        p_search IS NULL
        OR btrim(p_search) = ''
        OR s.procedure_name ILIKE '%' || p_search || '%'
        OR s.diagnosis ILIKE '%' || p_search || '%'
        OR p.name ILIKE '%' || p_search || '%'
        OR o.full_name ILIKE '%' || p_search || '%'
      )
  ),
  counted AS (
    SELECT COUNT(*) AS cnt FROM filtered
  )
  SELECT
    f.id, f.organization_id, f.branch_id, f.patient_id, f.owner_id,
    f.appointment_id, f.consultation_id, f.clinical_entry_id, f.surgeon_id,
    f.status, f.scheduled_at, f.started_at, f.completed_at, f.procedure_name,
    f.diagnosis, f.anesthesia, f.asa, f.preop_notes, f.intraop_notes,
    f.postop_notes, f.complications, f.notes,
    f.pat_name, f.pat_species, f.own_name, f.surg_name,
    f.created_at, f.updated_at, c.cnt
  FROM filtered f
  CROSS JOIN counted c
  ORDER BY f.scheduled_at DESC
  LIMIT LEAST(GREATEST(p_page_size, 1), 100)
  OFFSET v_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_surgeries TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_surgery(
  p_surgery_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_surgery public.surgeries%ROWTYPE;
  v_entry_id UUID;
BEGIN
  v_org_id := public.get_user_organization_id();

  IF v_org_id IS NULL OR NOT public.has_permission('clinical:write') THEN
    RAISE EXCEPTION 'Sin permisos para completar la cirugía';
  END IF;

  SELECT * INTO v_surgery
  FROM public.surgeries
  WHERE id = p_surgery_id
    AND organization_id = v_org_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cirugía no encontrada';
  END IF;

  IF v_surgery.status = 'completada' THEN
    RETURN jsonb_build_object(
      'surgery_id', v_surgery.id,
      'clinical_entry_id', v_surgery.clinical_entry_id
    );
  END IF;

  IF v_surgery.status NOT IN ('en_curso', 'recuperacion') THEN
    RAISE EXCEPTION 'La cirugía debe estar en curso o en recuperación';
  END IF;

  INSERT INTO public.clinical_entries (
    organization_id,
    branch_id,
    patient_id,
    owner_id,
    appointment_id,
    recorded_by,
    entry_date,
    entry_type,
    title,
    anamnesis,
    physical_exam,
    diagnosis,
    treatment,
    plan,
    notes
  ) VALUES (
    v_surgery.organization_id,
    v_surgery.branch_id,
    v_surgery.patient_id,
    v_surgery.owner_id,
    v_surgery.appointment_id,
    COALESCE(v_surgery.surgeon_id, auth.uid()),
    now(),
    'cirugia',
    v_surgery.procedure_name,
    v_surgery.preop_notes,
    v_surgery.intraop_notes,
    v_surgery.diagnosis,
    CONCAT_WS(
      E'\n',
      CASE WHEN v_surgery.anesthesia IS NOT NULL THEN 'Anestesia: ' || v_surgery.anesthesia::TEXT END,
      CASE WHEN v_surgery.asa IS NOT NULL THEN 'ASA: ' || v_surgery.asa::TEXT END
    ),
    v_surgery.postop_notes,
    CONCAT_WS(
      E'\n',
      CASE WHEN v_surgery.complications IS NOT NULL AND btrim(v_surgery.complications) <> '' THEN 'Complicaciones: ' || v_surgery.complications END,
      v_surgery.notes
    )
  )
  RETURNING id INTO v_entry_id;

  UPDATE public.surgeries
  SET
    status = 'completada',
    completed_at = now(),
    clinical_entry_id = v_entry_id
  WHERE id = v_surgery.id;

  IF v_surgery.appointment_id IS NOT NULL THEN
    UPDATE public.appointments
    SET status = 'completada'
    WHERE id = v_surgery.appointment_id
      AND deleted_at IS NULL
      AND status NOT IN ('cancelada', 'ausente', 'completada');
  END IF;

  RETURN jsonb_build_object(
    'surgery_id', v_surgery.id,
    'clinical_entry_id', v_entry_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_surgery TO authenticated;
