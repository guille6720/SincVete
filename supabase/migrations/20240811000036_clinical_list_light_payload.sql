-- Lighten clinical history list payload (keep signature; null/truncate long SOAP fields)

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
  v_page_size INT;
BEGIN
  v_org_id := public.get_user_organization_id();

  IF v_org_id IS NULL OR NOT public.has_permission('clinical:read') THEN
    RETURN;
  END IF;

  -- Keep list pages small; detail view loads full SOAP separately
  v_page_size := LEAST(GREATEST(p_page_size, 1), 50);
  v_offset := GREATEST(p_page - 1, 0) * v_page_size;

  RETURN QUERY
  WITH filtered AS (
    SELECT
      ce.id,
      ce.organization_id,
      ce.branch_id,
      ce.patient_id,
      ce.owner_id,
      ce.appointment_id,
      ce.recorded_by,
      ce.entry_date,
      ce.entry_type,
      ce.title,
      ce.diagnosis,
      ce.treatment,
      ce.weight_kg,
      ce.temperature_c,
      ce.created_at,
      ce.updated_at,
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
    f.id,
    f.organization_id,
    f.branch_id,
    f.patient_id,
    f.owner_id,
    f.appointment_id,
    f.recorded_by,
    f.entry_date,
    f.entry_type,
    f.title,
    NULL::TEXT AS anamnesis,
    NULL::TEXT AS physical_exam,
    LEFT(f.diagnosis, 240) AS diagnosis,
    LEFT(f.treatment, 240) AS treatment,
    NULL::TEXT AS plan,
    f.weight_kg,
    f.temperature_c,
    NULL::TEXT AS notes,
    f.pat_name,
    f.pat_species,
    f.own_name,
    f.recorder_name,
    f.created_at,
    f.updated_at,
    c.cnt
  FROM filtered f
  CROSS JOIN counted c
  ORDER BY f.entry_date DESC
  LIMIT v_page_size
  OFFSET v_offset;
END;
$$;
