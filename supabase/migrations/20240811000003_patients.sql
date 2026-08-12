-- SincVete - Módulo 3: Pacientes

CREATE TYPE public.patient_species AS ENUM (
  'Canino',
  'Felino',
  'Ave',
  'Roedor',
  'Reptil',
  'Equino',
  'Bovino',
  'Otro'
);

CREATE TYPE public.patient_sex AS ENUM (
  'Macho',
  'Hembra',
  'Desconocido'
);

CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  owner_id UUID NOT NULL REFERENCES public.owners(id) ON DELETE RESTRICT,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 100),
  species public.patient_species NOT NULL DEFAULT 'Canino',
  breed TEXT,
  sex public.patient_sex NOT NULL DEFAULT 'Desconocido',
  birth_date DATE,
  color TEXT,
  microchip TEXT,
  is_neutered BOOLEAN NOT NULL DEFAULT false,
  is_deceased BOOLEAN NOT NULL DEFAULT false,
  deceased_at DATE,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_patients_org_created ON public.patients (organization_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_patients_org_name ON public.patients (organization_id, lower(name))
  WHERE deleted_at IS NULL;

CREATE INDEX idx_patients_owner ON public.patients (owner_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_patients_org_branch ON public.patients (organization_id, branch_id)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX idx_patients_microchip_org ON public.patients (organization_id, microchip)
  WHERE deleted_at IS NULL AND microchip IS NOT NULL AND btrim(microchip) <> '';

CREATE INDEX idx_patients_search ON public.patients
  USING gin (
    to_tsvector(
      'spanish',
      coalesce(name, '') || ' ' ||
      coalesce(breed, '') || ' ' ||
      coalesce(microchip, '') || ' ' ||
      coalesce(color, '')
    )
  )
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_patients_updated_at
  BEFORE UPDATE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_audit_patients
  AFTER INSERT OR UPDATE OR DELETE ON public.patients
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patients_select_tenant" ON public.patients
  FOR SELECT USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('patients:read')
  );

CREATE POLICY "patients_insert_tenant" ON public.patients
  FOR INSERT WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.has_permission('patients:write')
  );

CREATE POLICY "patients_update_tenant" ON public.patients
  FOR UPDATE USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('patients:write')
  );

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
BEGIN
  v_org_id := public.get_user_organization_id();

  IF v_org_id IS NULL OR NOT public.has_permission('patients:read') THEN
    RETURN;
  END IF;

  v_offset := GREATEST(p_page - 1, 0) * LEAST(GREATEST(p_page_size, 1), 100);

  RETURN QUERY
  WITH filtered AS (
    SELECT
      p.*,
      o.full_name AS owner_name
    FROM public.patients p
    INNER JOIN public.owners o ON o.id = p.owner_id AND o.deleted_at IS NULL
    WHERE p.organization_id = v_org_id
      AND p.deleted_at IS NULL
      AND (p_owner_id IS NULL OR p.owner_id = p_owner_id)
      AND (p_branch_id IS NULL OR p.branch_id = p_branch_id)
      AND (p_species IS NULL OR btrim(p_species) = '' OR p.species::TEXT = p_species)
      AND (
        p_search IS NULL
        OR btrim(p_search) = ''
        OR to_tsvector(
          'spanish',
          coalesce(p.name, '') || ' ' ||
          coalesce(p.breed, '') || ' ' ||
          coalesce(p.microchip, '') || ' ' ||
          coalesce(p.color, '') || ' ' ||
          coalesce(o.full_name, '')
        ) @@ plainto_tsquery('spanish', p_search)
        OR p.name ILIKE '%' || p_search || '%'
        OR p.microchip ILIKE '%' || p_search || '%'
        OR o.full_name ILIKE '%' || p_search || '%'
      )
  ),
  counted AS (
    SELECT COUNT(*) AS cnt FROM filtered
  )
  SELECT
    f.id, f.organization_id, f.branch_id, f.owner_id, f.owner_name,
    f.name, f.species, f.breed, f.sex, f.birth_date, f.color, f.microchip,
    f.is_neutered, f.is_deceased, f.deceased_at, f.notes, f.is_active,
    f.created_at, f.updated_at, c.cnt
  FROM filtered f
  CROSS JOIN counted c
  ORDER BY f.name ASC
  LIMIT LEAST(GREATEST(p_page_size, 1), 100)
  OFFSET v_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_patients TO authenticated;
