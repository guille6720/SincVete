-- Patient profile photo

ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS photo_url TEXT;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'patient-photos',
  'patient-photos',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "patient_photos_storage_select" ON storage.objects;
CREATE POLICY "patient_photos_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'patient-photos'
    AND (storage.foldername(name))[1] = public.get_user_organization_id()::text
  );

DROP POLICY IF EXISTS "patient_photos_storage_insert" ON storage.objects;
CREATE POLICY "patient_photos_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'patient-photos'
    AND (storage.foldername(name))[1] = public.get_user_organization_id()::text
    AND public.has_permission('patients:write')
  );

DROP POLICY IF EXISTS "patient_photos_storage_update" ON storage.objects;
CREATE POLICY "patient_photos_storage_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'patient-photos'
    AND (storage.foldername(name))[1] = public.get_user_organization_id()::text
    AND public.has_permission('patients:write')
  );

DROP POLICY IF EXISTS "patient_photos_storage_delete" ON storage.objects;
CREATE POLICY "patient_photos_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'patient-photos'
    AND (storage.foldername(name))[1] = public.get_user_organization_id()::text
    AND public.has_permission('patients:write')
  );

DROP FUNCTION IF EXISTS public.search_patients(TEXT, UUID, UUID, TEXT, INT, INT);

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
    f.is_neutered, f.is_deceased, f.deceased_at, f.notes, f.photo_url, f.is_active,
    f.created_at, f.updated_at, c.cnt
  FROM filtered f
  CROSS JOIN counted c
  ORDER BY f.name ASC
  LIMIT LEAST(GREATEST(p_page_size, 1), 100)
  OFFSET v_offset;
END;
$$;
