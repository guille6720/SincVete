-- SincVete - Módulo 8: Vacunación

CREATE TYPE public.vaccination_route AS ENUM (
  'sc',
  'im',
  'in',
  'oral',
  'otro'
);

CREATE TABLE public.vaccinations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  branch_id UUID NOT NULL REFERENCES public.branches(id) ON DELETE RESTRICT,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  owner_id UUID NOT NULL REFERENCES public.owners(id) ON DELETE RESTRICT,
  consultation_id UUID REFERENCES public.consultations(id) ON DELETE SET NULL,
  clinical_entry_id UUID REFERENCES public.clinical_entries(id) ON DELETE SET NULL,
  veterinarian_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  vaccine_name TEXT NOT NULL CHECK (char_length(vaccine_name) BETWEEN 2 AND 120),
  manufacturer TEXT,
  lot_number TEXT,
  administered_at DATE NOT NULL DEFAULT (timezone('America/Argentina/Buenos_Aires', now()))::date,
  next_due_at DATE,
  route public.vaccination_route,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT vaccinations_next_due_after_admin
    CHECK (next_due_at IS NULL OR next_due_at >= administered_at)
);

CREATE INDEX idx_vaccinations_org_administered ON public.vaccinations (organization_id, administered_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_vaccinations_patient ON public.vaccinations (patient_id, administered_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_vaccinations_due ON public.vaccinations (organization_id, next_due_at)
  WHERE deleted_at IS NULL AND next_due_at IS NOT NULL;

CREATE TRIGGER trg_vaccinations_updated_at
  BEFORE UPDATE ON public.vaccinations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_audit_vaccinations
  AFTER INSERT OR UPDATE OR DELETE ON public.vaccinations
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

ALTER TABLE public.vaccinations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vaccinations_select_tenant" ON public.vaccinations
  FOR SELECT USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('clinical:read')
  );

CREATE POLICY "vaccinations_insert_tenant" ON public.vaccinations
  FOR INSERT WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.has_permission('clinical:write')
  );

CREATE POLICY "vaccinations_update_tenant" ON public.vaccinations
  FOR UPDATE USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('clinical:write')
  );

CREATE OR REPLACE FUNCTION public.list_vaccination_due(
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
  vaccine_name TEXT,
  manufacturer TEXT,
  lot_number TEXT,
  administered_at DATE,
  next_due_at DATE,
  route public.vaccination_route,
  notes TEXT,
  due_status TEXT,
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
  v_today DATE;
  v_horizon DATE;
BEGIN
  v_org_id := public.get_user_organization_id();

  IF v_org_id IS NULL OR NOT public.has_permission('clinical:read') THEN
    RETURN;
  END IF;

  v_today := (timezone('America/Argentina/Buenos_Aires', now()))::date;
  v_horizon := v_today + 30;

  RETURN QUERY
  WITH latest AS (
    SELECT DISTINCT ON (v.patient_id, lower(btrim(v.vaccine_name)))
      v.*,
      p.name AS pat_name,
      p.species AS pat_species,
      o.full_name AS own_name,
      pr.full_name AS vet_name
    FROM public.vaccinations v
    INNER JOIN public.patients p
      ON p.id = v.patient_id
      AND p.deleted_at IS NULL
      AND p.is_deceased = false
      AND p.is_active = true
    INNER JOIN public.owners o ON o.id = v.owner_id AND o.deleted_at IS NULL
    LEFT JOIN public.profiles pr ON pr.id = v.veterinarian_id
    WHERE v.organization_id = v_org_id
      AND v.deleted_at IS NULL
      AND v.next_due_at IS NOT NULL
      AND (p_branch_id IS NULL OR v.branch_id = p_branch_id)
    ORDER BY v.patient_id, lower(btrim(v.vaccine_name)), v.administered_at DESC, v.created_at DESC
  )
  SELECT
    l.id, l.organization_id, l.branch_id, l.patient_id, l.owner_id,
    l.consultation_id, l.clinical_entry_id, l.veterinarian_id,
    l.vaccine_name, l.manufacturer, l.lot_number, l.administered_at, l.next_due_at,
    l.route, l.notes,
    CASE
      WHEN l.next_due_at < v_today THEN 'vencida'
      ELSE 'por_vencer'
    END AS due_status,
    l.pat_name, l.pat_species, l.own_name, l.vet_name,
    l.created_at, l.updated_at
  FROM latest l
  WHERE l.next_due_at <= v_horizon
  ORDER BY l.next_due_at ASC, l.pat_name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_vaccination_due TO authenticated;

CREATE OR REPLACE FUNCTION public.list_patient_vaccine_status(
  p_patient_id UUID
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
  vaccine_name TEXT,
  manufacturer TEXT,
  lot_number TEXT,
  administered_at DATE,
  next_due_at DATE,
  route public.vaccination_route,
  notes TEXT,
  due_status TEXT,
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
  v_today DATE;
  v_horizon DATE;
BEGIN
  v_org_id := public.get_user_organization_id();

  IF v_org_id IS NULL OR NOT public.has_permission('clinical:read') THEN
    RETURN;
  END IF;

  v_today := (timezone('America/Argentina/Buenos_Aires', now()))::date;
  v_horizon := v_today + 30;

  RETURN QUERY
  WITH latest AS (
    SELECT DISTINCT ON (lower(btrim(v.vaccine_name)))
      v.*,
      p.name AS pat_name,
      p.species AS pat_species,
      o.full_name AS own_name,
      pr.full_name AS vet_name
    FROM public.vaccinations v
    INNER JOIN public.patients p ON p.id = v.patient_id AND p.deleted_at IS NULL
    INNER JOIN public.owners o ON o.id = v.owner_id AND o.deleted_at IS NULL
    LEFT JOIN public.profiles pr ON pr.id = v.veterinarian_id
    WHERE v.organization_id = v_org_id
      AND v.deleted_at IS NULL
      AND v.patient_id = p_patient_id
    ORDER BY lower(btrim(v.vaccine_name)), v.administered_at DESC, v.created_at DESC
  )
  SELECT
    l.id, l.organization_id, l.branch_id, l.patient_id, l.owner_id,
    l.consultation_id, l.clinical_entry_id, l.veterinarian_id,
    l.vaccine_name, l.manufacturer, l.lot_number, l.administered_at, l.next_due_at,
    l.route, l.notes,
    CASE
      WHEN l.next_due_at IS NULL THEN 'sin_fecha'
      WHEN l.next_due_at < v_today THEN 'vencida'
      WHEN l.next_due_at <= v_horizon THEN 'por_vencer'
      ELSE 'al_dia'
    END AS due_status,
    l.pat_name, l.pat_species, l.own_name, l.vet_name,
    l.created_at, l.updated_at
  FROM latest l
  ORDER BY
    CASE
      WHEN l.next_due_at IS NULL THEN 3
      WHEN l.next_due_at < v_today THEN 0
      WHEN l.next_due_at <= v_horizon THEN 1
      ELSE 2
    END,
    l.next_due_at ASC NULLS LAST,
    l.vaccine_name ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_patient_vaccine_status TO authenticated;

CREATE OR REPLACE FUNCTION public.search_vaccinations(
  p_search TEXT DEFAULT NULL,
  p_patient_id UUID DEFAULT NULL,
  p_branch_id UUID DEFAULT NULL,
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
  vaccine_name TEXT,
  manufacturer TEXT,
  lot_number TEXT,
  administered_at DATE,
  next_due_at DATE,
  route public.vaccination_route,
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
      v.*,
      p.name AS pat_name,
      p.species AS pat_species,
      o.full_name AS own_name,
      pr.full_name AS vet_name
    FROM public.vaccinations v
    INNER JOIN public.patients p ON p.id = v.patient_id AND p.deleted_at IS NULL
    INNER JOIN public.owners o ON o.id = v.owner_id AND o.deleted_at IS NULL
    LEFT JOIN public.profiles pr ON pr.id = v.veterinarian_id
    WHERE v.organization_id = v_org_id
      AND v.deleted_at IS NULL
      AND (p_patient_id IS NULL OR v.patient_id = p_patient_id)
      AND (p_branch_id IS NULL OR v.branch_id = p_branch_id)
      AND (
        p_search IS NULL
        OR btrim(p_search) = ''
        OR v.vaccine_name ILIKE '%' || p_search || '%'
        OR v.manufacturer ILIKE '%' || p_search || '%'
        OR v.lot_number ILIKE '%' || p_search || '%'
        OR p.name ILIKE '%' || p_search || '%'
        OR o.full_name ILIKE '%' || p_search || '%'
      )
  ),
  counted AS (
    SELECT COUNT(*) AS cnt FROM filtered
  )
  SELECT
    f.id, f.organization_id, f.branch_id, f.patient_id, f.owner_id,
    f.consultation_id, f.clinical_entry_id, f.veterinarian_id,
    f.vaccine_name, f.manufacturer, f.lot_number, f.administered_at, f.next_due_at,
    f.route, f.notes,
    f.pat_name, f.pat_species, f.own_name, f.vet_name,
    f.created_at, f.updated_at, c.cnt
  FROM filtered f
  CROSS JOIN counted c
  ORDER BY f.administered_at DESC, f.created_at DESC
  LIMIT LEAST(GREATEST(p_page_size, 1), 100)
  OFFSET v_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_vaccinations TO authenticated;

CREATE OR REPLACE FUNCTION public.record_vaccination(
  p_branch_id UUID,
  p_patient_id UUID,
  p_owner_id UUID,
  p_vaccine_name TEXT,
  p_administered_at DATE,
  p_manufacturer TEXT DEFAULT NULL,
  p_lot_number TEXT DEFAULT NULL,
  p_next_due_at DATE DEFAULT NULL,
  p_route TEXT DEFAULT NULL,
  p_notes TEXT DEFAULT NULL,
  p_consultation_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_vaccination_id UUID;
  v_entry_id UUID;
  v_route public.vaccination_route;
BEGIN
  v_org_id := public.get_user_organization_id();

  IF v_org_id IS NULL OR NOT public.has_permission('clinical:write') THEN
    RAISE EXCEPTION 'Sin permisos para registrar vacunación';
  END IF;

  IF p_route IS NOT NULL AND btrim(p_route) <> '' THEN
    IF p_route NOT IN ('sc', 'im', 'in', 'oral', 'otro') THEN
      RAISE EXCEPTION 'Vía de aplicación inválida';
    END IF;
    v_route := p_route::public.vaccination_route;
  END IF;

  INSERT INTO public.vaccinations (
    organization_id,
    branch_id,
    patient_id,
    owner_id,
    consultation_id,
    veterinarian_id,
    vaccine_name,
    manufacturer,
    lot_number,
    administered_at,
    next_due_at,
    route,
    notes
  ) VALUES (
    v_org_id,
    p_branch_id,
    p_patient_id,
    p_owner_id,
    p_consultation_id,
    auth.uid(),
    btrim(p_vaccine_name),
    NULLIF(btrim(COALESCE(p_manufacturer, '')), ''),
    NULLIF(btrim(COALESCE(p_lot_number, '')), ''),
    p_administered_at,
    p_next_due_at,
    v_route,
    NULLIF(btrim(COALESCE(p_notes, '')), '')
  )
  RETURNING id INTO v_vaccination_id;

  INSERT INTO public.clinical_entries (
    organization_id,
    branch_id,
    patient_id,
    owner_id,
    recorded_by,
    entry_date,
    entry_type,
    title,
    treatment,
    plan,
    notes
  ) VALUES (
    v_org_id,
    p_branch_id,
    p_patient_id,
    p_owner_id,
    auth.uid(),
    (p_administered_at::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires'),
    'vacunacion',
    btrim(p_vaccine_name),
    CONCAT_WS(
      E'\n',
      CASE WHEN p_manufacturer IS NOT NULL AND btrim(p_manufacturer) <> '' THEN 'Laboratorio: ' || btrim(p_manufacturer) END,
      CASE WHEN p_lot_number IS NOT NULL AND btrim(p_lot_number) <> '' THEN 'Lote: ' || btrim(p_lot_number) END,
      CASE WHEN p_route IS NOT NULL AND btrim(p_route) <> '' THEN 'Vía: ' || p_route END
    ),
    CASE
      WHEN p_next_due_at IS NOT NULL THEN 'Próximo refuerzo: ' || to_char(p_next_due_at, 'DD/MM/YYYY')
      ELSE NULL
    END,
    NULLIF(btrim(COALESCE(p_notes, '')), '')
  )
  RETURNING id INTO v_entry_id;

  UPDATE public.vaccinations
  SET clinical_entry_id = v_entry_id
  WHERE id = v_vaccination_id;

  RETURN jsonb_build_object(
    'vaccination_id', v_vaccination_id,
    'clinical_entry_id', v_entry_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_vaccination TO authenticated;
