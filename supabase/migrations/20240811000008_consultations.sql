-- SincVete - Módulo 6: Consultas (flujo de atención)

CREATE TYPE public.consultation_status AS ENUM (
  'en_espera',
  'en_curso',
  'completada',
  'cancelada'
);

CREATE TABLE public.consultations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  owner_id UUID NOT NULL REFERENCES public.owners(id) ON DELETE RESTRICT,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  clinical_entry_id UUID REFERENCES public.clinical_entries(id) ON DELETE SET NULL,
  veterinarian_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.consultation_status NOT NULL DEFAULT 'en_curso',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
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

CREATE INDEX idx_consultations_org_started ON public.consultations (organization_id, started_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_consultations_patient ON public.consultations (patient_id, started_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_consultations_status ON public.consultations (organization_id, status, started_at DESC)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX idx_consultations_appointment_unique
  ON public.consultations (appointment_id)
  WHERE deleted_at IS NULL AND appointment_id IS NOT NULL AND status <> 'cancelada';

CREATE TRIGGER trg_consultations_updated_at
  BEFORE UPDATE ON public.consultations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_audit_consultations
  AFTER INSERT OR UPDATE OR DELETE ON public.consultations
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

ALTER TABLE public.consultations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "consultations_select_tenant" ON public.consultations
  FOR SELECT USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND (
      public.has_permission('clinical:read')
      OR public.has_permission('appointments:read')
    )
  );

CREATE POLICY "consultations_insert_tenant" ON public.consultations
  FOR INSERT WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.has_permission('clinical:write')
  );

CREATE POLICY "consultations_update_tenant" ON public.consultations
  FOR UPDATE USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('clinical:write')
  );

CREATE OR REPLACE FUNCTION public.list_consultation_queue(
  p_branch_id UUID DEFAULT NULL
)
RETURNS TABLE (
  queue_kind TEXT,
  appointment_id UUID,
  consultation_id UUID,
  patient_id UUID,
  owner_id UUID,
  starts_at TIMESTAMPTZ,
  appointment_status public.appointment_status,
  consultation_status public.consultation_status,
  appointment_type public.appointment_type,
  title TEXT,
  patient_name TEXT,
  patient_species public.patient_species,
  owner_full_name TEXT,
  veterinarian_name TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_today_start TIMESTAMPTZ;
  v_today_end TIMESTAMPTZ;
BEGIN
  v_org_id := public.get_user_organization_id();

  IF v_org_id IS NULL OR NOT (
    public.has_permission('clinical:read')
    OR public.has_permission('appointments:read')
  ) THEN
    RETURN;
  END IF;

  v_today_start := date_trunc(
    'day',
    timezone('America/Argentina/Buenos_Aires', now())
  ) AT TIME ZONE 'America/Argentina/Buenos_Aires';
  v_today_end := v_today_start + interval '1 day';

  RETURN QUERY
  SELECT
    'cita'::TEXT AS queue_kind,
    a.id AS appointment_id,
    c.id AS consultation_id,
    a.patient_id,
    a.owner_id,
    a.starts_at,
    a.status AS appointment_status,
    c.status AS consultation_status,
    a.appointment_type,
    COALESCE(c.title, a.title) AS title,
    p.name AS patient_name,
    p.species AS patient_species,
    o.full_name AS owner_full_name,
    pr.full_name AS veterinarian_name
  FROM public.appointments a
  INNER JOIN public.patients p ON p.id = a.patient_id AND p.deleted_at IS NULL
  INNER JOIN public.owners o ON o.id = a.owner_id AND o.deleted_at IS NULL
  LEFT JOIN public.consultations c
    ON c.appointment_id = a.id
    AND c.deleted_at IS NULL
    AND c.status <> 'cancelada'
  LEFT JOIN public.profiles pr ON pr.id = COALESCE(c.veterinarian_id, a.assigned_user_id)
  WHERE a.organization_id = v_org_id
    AND a.deleted_at IS NULL
    AND a.starts_at >= v_today_start
    AND a.starts_at < v_today_end
    AND a.status NOT IN ('cancelada', 'ausente')
    AND (p_branch_id IS NULL OR a.branch_id = p_branch_id)

  UNION ALL

  SELECT
    'walkin'::TEXT AS queue_kind,
    NULL::UUID AS appointment_id,
    c.id AS consultation_id,
    c.patient_id,
    c.owner_id,
    c.started_at AS starts_at,
    NULL::public.appointment_status AS appointment_status,
    c.status AS consultation_status,
    NULL::public.appointment_type AS appointment_type,
    c.title,
    p.name AS patient_name,
    p.species AS patient_species,
    o.full_name AS owner_full_name,
    pr.full_name AS veterinarian_name
  FROM public.consultations c
  INNER JOIN public.patients p ON p.id = c.patient_id AND p.deleted_at IS NULL
  INNER JOIN public.owners o ON o.id = c.owner_id AND o.deleted_at IS NULL
  LEFT JOIN public.profiles pr ON pr.id = c.veterinarian_id
  WHERE c.organization_id = v_org_id
    AND c.deleted_at IS NULL
    AND c.appointment_id IS NULL
    AND c.started_at >= v_today_start
    AND c.started_at < v_today_end
    AND (p_branch_id IS NULL OR c.branch_id = p_branch_id)

  ORDER BY 6 ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_consultation_queue TO authenticated;

CREATE OR REPLACE FUNCTION public.search_consultations(
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
  clinical_entry_id UUID,
  veterinarian_id UUID,
  status public.consultation_status,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
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
      c.*,
      p.name AS pat_name,
      p.species AS pat_species,
      o.full_name AS own_name,
      pr.full_name AS vet_name
    FROM public.consultations c
    INNER JOIN public.patients p ON p.id = c.patient_id AND p.deleted_at IS NULL
    INNER JOIN public.owners o ON o.id = c.owner_id AND o.deleted_at IS NULL
    LEFT JOIN public.profiles pr ON pr.id = c.veterinarian_id
    WHERE c.organization_id = v_org_id
      AND c.deleted_at IS NULL
      AND (p_patient_id IS NULL OR c.patient_id = p_patient_id)
      AND (p_branch_id IS NULL OR c.branch_id = p_branch_id)
      AND (p_status IS NULL OR btrim(p_status) = '' OR c.status::TEXT = p_status)
      AND (
        p_search IS NULL
        OR btrim(p_search) = ''
        OR c.title ILIKE '%' || p_search || '%'
        OR c.diagnosis ILIKE '%' || p_search || '%'
        OR p.name ILIKE '%' || p_search || '%'
        OR o.full_name ILIKE '%' || p_search || '%'
      )
  ),
  counted AS (
    SELECT COUNT(*) AS cnt FROM filtered
  )
  SELECT
    f.id, f.organization_id, f.branch_id, f.patient_id, f.owner_id,
    f.appointment_id, f.clinical_entry_id, f.veterinarian_id, f.status,
    f.started_at, f.completed_at, f.title, f.anamnesis, f.physical_exam,
    f.diagnosis, f.treatment, f.plan, f.weight_kg, f.temperature_c, f.notes,
    f.pat_name, f.pat_species, f.own_name, f.vet_name,
    f.created_at, f.updated_at, c.cnt
  FROM filtered f
  CROSS JOIN counted c
  ORDER BY f.started_at DESC
  LIMIT LEAST(GREATEST(p_page_size, 1), 100)
  OFFSET v_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_consultations TO authenticated;

CREATE OR REPLACE FUNCTION public.complete_consultation(p_consultation_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_consult public.consultations%ROWTYPE;
  v_entry_id UUID;
BEGIN
  v_org_id := public.get_user_organization_id();

  IF v_org_id IS NULL OR NOT public.has_permission('clinical:write') THEN
    RAISE EXCEPTION 'Sin permisos para completar la consulta';
  END IF;

  SELECT * INTO v_consult
  FROM public.consultations
  WHERE id = p_consultation_id
    AND organization_id = v_org_id
    AND deleted_at IS NULL
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Consulta no encontrada';
  END IF;

  IF v_consult.status = 'completada' THEN
    RETURN jsonb_build_object(
      'consultation_id', v_consult.id,
      'clinical_entry_id', v_consult.clinical_entry_id
    );
  END IF;

  IF v_consult.status = 'cancelada' THEN
    RAISE EXCEPTION 'No se puede completar una consulta cancelada';
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
    weight_kg,
    temperature_c,
    notes
  ) VALUES (
    v_consult.organization_id,
    v_consult.branch_id,
    v_consult.patient_id,
    v_consult.owner_id,
    v_consult.appointment_id,
    COALESCE(v_consult.veterinarian_id, auth.uid()),
    COALESCE(v_consult.completed_at, now()),
    'consulta',
    v_consult.title,
    v_consult.anamnesis,
    v_consult.physical_exam,
    v_consult.diagnosis,
    v_consult.treatment,
    v_consult.plan,
    v_consult.weight_kg,
    v_consult.temperature_c,
    v_consult.notes
  )
  RETURNING id INTO v_entry_id;

  UPDATE public.consultations
  SET
    status = 'completada',
    completed_at = now(),
    clinical_entry_id = v_entry_id
  WHERE id = v_consult.id;

  IF v_consult.appointment_id IS NOT NULL THEN
    UPDATE public.appointments
    SET status = 'completada'
    WHERE id = v_consult.appointment_id
      AND deleted_at IS NULL
      AND status NOT IN ('cancelada', 'ausente');
  END IF;

  RETURN jsonb_build_object(
    'consultation_id', v_consult.id,
    'clinical_entry_id', v_entry_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_consultation TO authenticated;
