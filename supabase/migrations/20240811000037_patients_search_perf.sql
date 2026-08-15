-- Patients list performance: pg_trgm for ILIKE + species index + lighter list + page cap 50

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE INDEX IF NOT EXISTS idx_patients_name_trgm
  ON public.patients USING gin (name extensions.gin_trgm_ops)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_patients_microchip_trgm
  ON public.patients USING gin (microchip extensions.gin_trgm_ops)
  WHERE deleted_at IS NULL AND microchip IS NOT NULL AND btrim(microchip) <> '';

CREATE INDEX IF NOT EXISTS idx_patients_org_species
  ON public.patients (organization_id, species)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_owners_full_name_trgm
  ON public.owners USING gin (full_name extensions.gin_trgm_ops)
  WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION public.search_patients(
  p_search TEXT DEFAULT NULL,
  p_owner_id UUID DEFAULT NULL,
  p_branch_id UUID DEFAULT NULL,
  p_species TEXT DEFAULT NULL,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 25
)
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  branch_id UUID,
  owner_id UUID,
  owner_full_name TEXT,
  name TEXT,
  species public.patient_species,
  breed TEXT,
  sex public.patient_sex,
  birth_date DATE,
  color TEXT,
  microchip TEXT,
  is_neutered BOOLEAN,
  is_deceased BOOLEAN,
  deceased_at DATE,
  notes TEXT,
  photo_url TEXT,
  is_active BOOLEAN,
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
  v_search TEXT;
BEGIN
  v_org_id := public.get_user_organization_id();

  IF v_org_id IS NULL OR NOT public.has_permission('patients:read') THEN
    RETURN;
  END IF;

  -- Product goal: 25–50 patients per page
  v_page_size := LEAST(GREATEST(COALESCE(p_page_size, 25), 1), 50);
  v_offset := GREATEST(COALESCE(p_page, 1) - 1, 0) * v_page_size;
  v_search := NULLIF(btrim(COALESCE(p_search, '')), '');

  RETURN QUERY
  WITH filtered AS (
    SELECT
      p.id,
      p.organization_id,
      p.branch_id,
      p.owner_id,
      p.name,
      p.species,
      p.breed,
      p.sex,
      p.birth_date,
      p.color,
      p.microchip,
      p.is_neutered,
      p.is_deceased,
      p.deceased_at,
      p.photo_url,
      p.is_active,
      p.created_at,
      p.updated_at,
      o.full_name AS owner_name
    FROM public.patients p
    INNER JOIN public.owners o ON o.id = p.owner_id AND o.deleted_at IS NULL
    WHERE p.organization_id = v_org_id
      AND p.deleted_at IS NULL
      AND (p_owner_id IS NULL OR p.owner_id = p_owner_id)
      AND (p_branch_id IS NULL OR p.branch_id = p_branch_id)
      AND (p_species IS NULL OR btrim(p_species) = '' OR p.species::TEXT = p_species)
      AND (
        v_search IS NULL
        OR to_tsvector(
          'spanish',
          coalesce(p.name, '') || ' ' ||
          coalesce(p.breed, '') || ' ' ||
          coalesce(p.microchip, '') || ' ' ||
          coalesce(p.color, '') || ' ' ||
          coalesce(o.full_name, '')
        ) @@ plainto_tsquery('spanish', v_search)
        OR p.name ILIKE '%' || v_search || '%'
        OR p.microchip ILIKE '%' || v_search || '%'
        OR o.full_name ILIKE '%' || v_search || '%'
      )
  ),
  counted AS (
    SELECT COUNT(*) AS cnt FROM filtered
  )
  SELECT
    f.id,
    f.organization_id,
    f.branch_id,
    f.owner_id,
    f.owner_name,
    f.name,
    f.species,
    f.breed,
    f.sex,
    f.birth_date,
    f.color,
    f.microchip,
    f.is_neutered,
    f.is_deceased,
    f.deceased_at,
    NULL::TEXT AS notes,
    f.photo_url,
    f.is_active,
    f.created_at,
    f.updated_at,
    c.cnt
  FROM filtered f
  CROSS JOIN counted c
  ORDER BY f.name ASC
  LIMIT v_page_size
  OFFSET v_offset;
END;
$$;
