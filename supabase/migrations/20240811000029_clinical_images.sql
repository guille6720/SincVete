-- SincVete - Módulo 20: Imágenes clínicas

DO $$ BEGIN
  CREATE TYPE public.clinical_image_kind AS ENUM (
    'foto',
    'radiografia',
    'ecografia',
    'laboratorio',
    'documento',
    'otro'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.clinical_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE RESTRICT,
  owner_id UUID NOT NULL REFERENCES public.owners(id) ON DELETE RESTRICT,
  consultation_id UUID REFERENCES public.consultations(id) ON DELETE SET NULL,
  clinical_entry_id UUID REFERENCES public.clinical_entries(id) ON DELETE SET NULL,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  kind public.clinical_image_kind NOT NULL DEFAULT 'foto',
  title TEXT CHECK (title IS NULL OR char_length(title) BETWEEN 1 AND 160),
  notes TEXT CHECK (notes IS NULL OR char_length(notes) <= 2000),
  storage_path TEXT NOT NULL CHECK (char_length(storage_path) BETWEEN 8 AND 400),
  mime_type TEXT NOT NULL CHECK (char_length(mime_type) BETWEEN 3 AND 80),
  file_size INT NOT NULL CHECK (file_size > 0 AND file_size <= 10485760),
  original_name TEXT CHECK (original_name IS NULL OR char_length(original_name) BETWEEN 1 AND 200),
  taken_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE public.clinical_images
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES public.patients(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.owners(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS consultation_id UUID REFERENCES public.consultations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS clinical_entry_id UUID REFERENCES public.clinical_entries(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS kind public.clinical_image_kind,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS storage_path TEXT,
  ADD COLUMN IF NOT EXISTS mime_type TEXT,
  ADD COLUMN IF NOT EXISTS file_size INT,
  ADD COLUMN IF NOT EXISTS original_name TEXT,
  ADD COLUMN IF NOT EXISTS taken_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_clinical_images_org_taken
  ON public.clinical_images (organization_id, taken_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_clinical_images_patient
  ON public.clinical_images (patient_id, taken_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_clinical_images_kind
  ON public.clinical_images (organization_id, kind, taken_at DESC)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_clinical_images_storage_path
  ON public.clinical_images (storage_path)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_clinical_images_updated_at ON public.clinical_images;
CREATE TRIGGER trg_clinical_images_updated_at
  BEFORE UPDATE ON public.clinical_images
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_audit_clinical_images ON public.clinical_images;
CREATE TRIGGER trg_audit_clinical_images
  AFTER INSERT OR UPDATE OR DELETE ON public.clinical_images
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

ALTER TABLE public.clinical_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "clinical_images_select_tenant" ON public.clinical_images;
CREATE POLICY "clinical_images_select_tenant" ON public.clinical_images
  FOR SELECT USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('clinical:read')
  );

DROP POLICY IF EXISTS "clinical_images_insert_tenant" ON public.clinical_images;
CREATE POLICY "clinical_images_insert_tenant" ON public.clinical_images
  FOR INSERT WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.has_permission('clinical:write')
  );

DROP POLICY IF EXISTS "clinical_images_update_tenant" ON public.clinical_images;
CREATE POLICY "clinical_images_update_tenant" ON public.clinical_images
  FOR UPDATE USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('clinical:write')
  );

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'clinical-images',
  'clinical-images',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "clinical_images_storage_select" ON storage.objects;
CREATE POLICY "clinical_images_storage_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'clinical-images'
    AND (storage.foldername(name))[1] = public.get_user_organization_id()::text
    AND public.has_permission('clinical:read')
  );

DROP POLICY IF EXISTS "clinical_images_storage_insert" ON storage.objects;
CREATE POLICY "clinical_images_storage_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'clinical-images'
    AND (storage.foldername(name))[1] = public.get_user_organization_id()::text
    AND public.has_permission('clinical:write')
  );

DROP POLICY IF EXISTS "clinical_images_storage_delete" ON storage.objects;
CREATE POLICY "clinical_images_storage_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'clinical-images'
    AND (storage.foldername(name))[1] = public.get_user_organization_id()::text
    AND public.has_permission('clinical:write')
  );

CREATE OR REPLACE FUNCTION public.count_clinical_images_this_month(
  p_branch_id UUID DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_month_start TIMESTAMPTZ;
BEGIN
  v_org_id := public.get_user_organization_id();
  IF v_org_id IS NULL OR NOT public.has_permission('clinical:read') THEN
    RETURN 0;
  END IF;

  v_month_start := date_trunc(
    'month',
    timezone('America/Argentina/Buenos_Aires', now())
  ) AT TIME ZONE 'America/Argentina/Buenos_Aires';

  RETURN (
    SELECT COUNT(*)::int
    FROM public.clinical_images i
    WHERE i.organization_id = v_org_id
      AND i.deleted_at IS NULL
      AND i.created_at >= v_month_start
      AND (p_branch_id IS NULL OR i.branch_id = p_branch_id)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.search_clinical_images(
  p_search TEXT DEFAULT NULL,
  p_patient_id UUID DEFAULT NULL,
  p_branch_id UUID DEFAULT NULL,
  p_kind TEXT DEFAULT NULL,
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
  uploaded_by UUID,
  kind public.clinical_image_kind,
  title TEXT,
  notes TEXT,
  storage_path TEXT,
  mime_type TEXT,
  file_size INT,
  original_name TEXT,
  taken_at TIMESTAMPTZ,
  patient_name TEXT,
  patient_species public.patient_species,
  owner_full_name TEXT,
  uploaded_by_name TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
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
      i.*,
      p.name AS pat_name,
      p.species AS pat_species,
      ow.full_name AS own_name,
      pr.full_name AS up_name
    FROM public.clinical_images i
    INNER JOIN public.patients p ON p.id = i.patient_id AND p.deleted_at IS NULL
    INNER JOIN public.owners ow ON ow.id = i.owner_id AND ow.deleted_at IS NULL
    LEFT JOIN public.profiles pr ON pr.id = i.uploaded_by
    WHERE i.organization_id = v_org_id
      AND i.deleted_at IS NULL
      AND (p_patient_id IS NULL OR i.patient_id = p_patient_id)
      AND (p_branch_id IS NULL OR i.branch_id = p_branch_id)
      AND (p_kind IS NULL OR btrim(p_kind) = '' OR i.kind::TEXT = p_kind)
      AND (
        p_search IS NULL
        OR btrim(p_search) = ''
        OR i.title ILIKE '%' || p_search || '%'
        OR i.original_name ILIKE '%' || p_search || '%'
        OR i.notes ILIKE '%' || p_search || '%'
        OR p.name ILIKE '%' || p_search || '%'
        OR ow.full_name ILIKE '%' || p_search || '%'
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
    f.consultation_id,
    f.clinical_entry_id,
    f.uploaded_by,
    f.kind,
    f.title,
    f.notes,
    f.storage_path,
    f.mime_type,
    f.file_size,
    f.original_name,
    f.taken_at,
    f.pat_name,
    f.pat_species,
    f.own_name,
    f.up_name,
    f.created_at,
    f.updated_at,
    f.deleted_at,
    c.cnt
  FROM filtered f
  CROSS JOIN counted c
  ORDER BY f.taken_at DESC, f.created_at DESC
  LIMIT LEAST(GREATEST(p_page_size, 1), 100)
  OFFSET v_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.count_clinical_images_this_month TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_clinical_images TO authenticated;

CREATE OR REPLACE FUNCTION public.get_dashboard_summary(
  p_branch_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_month_start TIMESTAMPTZ;
  v_today_start TIMESTAMPTZ;
  v_today_end TIMESTAMPTZ;
  v_today DATE;
BEGIN
  v_org_id := public.get_user_organization_id();

  IF v_org_id IS NULL OR NOT public.has_permission('patients:read') THEN
    RETURN '{}'::jsonb;
  END IF;

  v_month_start := date_trunc(
    'month',
    timezone('America/Argentina/Buenos_Aires', now())
  ) AT TIME ZONE 'America/Argentina/Buenos_Aires';

  v_today_start := date_trunc(
    'day',
    timezone('America/Argentina/Buenos_Aires', now())
  ) AT TIME ZONE 'America/Argentina/Buenos_Aires';

  v_today_end := v_today_start + interval '1 day';
  v_today := (timezone('America/Argentina/Buenos_Aires', now()))::date;

  RETURN jsonb_build_object(
    'active_patients',
      (
        SELECT COUNT(*)
        FROM public.patients p
        WHERE p.organization_id = v_org_id
          AND p.deleted_at IS NULL
          AND p.is_active = true
          AND p.is_deceased = false
          AND (p_branch_id IS NULL OR p.branch_id = p_branch_id)
      ),
    'active_owners',
      (
        SELECT COUNT(*)
        FROM public.owners o
        WHERE o.organization_id = v_org_id
          AND o.deleted_at IS NULL
          AND o.is_active = true
          AND (p_branch_id IS NULL OR o.branch_id = p_branch_id)
      ),
    'patients_this_month',
      (
        SELECT COUNT(*)
        FROM public.patients p
        WHERE p.organization_id = v_org_id
          AND p.deleted_at IS NULL
          AND p.created_at >= v_month_start
          AND (p_branch_id IS NULL OR p.branch_id = p_branch_id)
      ),
    'owners_this_month',
      (
        SELECT COUNT(*)
        FROM public.owners o
        WHERE o.organization_id = v_org_id
          AND o.deleted_at IS NULL
          AND o.created_at >= v_month_start
          AND (p_branch_id IS NULL OR o.branch_id = p_branch_id)
      ),
    'appointments_today',
      (
        SELECT COUNT(*)
        FROM public.appointments a
        WHERE a.organization_id = v_org_id
          AND a.deleted_at IS NULL
          AND a.starts_at >= v_today_start
          AND a.starts_at < v_today_end
          AND a.status NOT IN ('cancelada', 'ausente')
          AND (p_branch_id IS NULL OR a.branch_id = p_branch_id)
          AND public.has_permission('appointments:read')
      ),
    'consultations_this_month',
      (
        SELECT COUNT(*)
        FROM public.consultations c
        WHERE c.organization_id = v_org_id
          AND c.deleted_at IS NULL
          AND c.status = 'completada'
          AND c.completed_at >= v_month_start
          AND (p_branch_id IS NULL OR c.branch_id = p_branch_id)
          AND public.has_permission('clinical:read')
      ),
    'hospitalizations_active',
      (
        SELECT COUNT(*)
        FROM public.hospitalizations h
        WHERE h.organization_id = v_org_id
          AND h.deleted_at IS NULL
          AND h.status IN ('internado', 'observacion')
          AND (p_branch_id IS NULL OR h.branch_id = p_branch_id)
          AND public.has_permission('clinical:read')
      ),
    'vaccinations_overdue',
      (
        SELECT COUNT(*)
        FROM (
          SELECT DISTINCT ON (v.patient_id, lower(btrim(v.vaccine_name)))
            v.next_due_at
          FROM public.vaccinations v
          INNER JOIN public.patients p
            ON p.id = v.patient_id
            AND p.deleted_at IS NULL
            AND p.is_deceased = false
            AND p.is_active = true
          WHERE v.organization_id = v_org_id
            AND v.deleted_at IS NULL
            AND v.next_due_at IS NOT NULL
            AND (p_branch_id IS NULL OR v.branch_id = p_branch_id)
            AND public.has_permission('clinical:read')
          ORDER BY v.patient_id, lower(btrim(v.vaccine_name)), v.administered_at DESC, v.created_at DESC
        ) latest
        WHERE latest.next_due_at < v_today
      ),
    'surgeries_active',
      (
        SELECT COUNT(*)
        FROM public.surgeries s
        WHERE s.organization_id = v_org_id
          AND s.deleted_at IS NULL
          AND s.status IN ('en_curso', 'recuperacion')
          AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
          AND public.has_permission('clinical:read')
      ),
    'lab_orders_pending',
      (
        SELECT COUNT(*)
        FROM public.lab_orders o
        WHERE o.organization_id = v_org_id
          AND o.deleted_at IS NULL
          AND o.status IN ('solicitada', 'en_proceso')
          AND (p_branch_id IS NULL OR o.branch_id = p_branch_id)
          AND public.has_permission('clinical:read')
      ),
    'inventory_low_stock',
      (
        SELECT COUNT(*)
        FROM public.inventory_products ip
        WHERE ip.organization_id = v_org_id
          AND ip.deleted_at IS NULL
          AND ip.is_active = true
          AND ip.quantity <= ip.min_quantity
          AND (p_branch_id IS NULL OR ip.branch_id = p_branch_id)
          AND public.has_permission('inventory:read')
      ),
    'invoices_open',
      (
        SELECT COUNT(*)
        FROM public.invoices inv
        WHERE inv.organization_id = v_org_id
          AND inv.deleted_at IS NULL
          AND inv.status = 'emitida'
          AND inv.balance > 0
          AND (p_branch_id IS NULL OR inv.branch_id = p_branch_id)
          AND public.has_permission('billing:read')
      ),
    'reminders_pending',
      public.count_pending_reminders(p_branch_id),
    'prescriptions_active',
      public.count_active_prescriptions(p_branch_id),
    'cash_sessions_open',
      public.count_open_cash_sessions(p_branch_id),
    'clinical_images_this_month',
      public.count_clinical_images_this_month(p_branch_id),
    'species_counts',
      COALESCE(
        (
          SELECT jsonb_agg(
            jsonb_build_object('species', s.species, 'count', s.cnt)
            ORDER BY s.cnt DESC, s.species ASC
          )
          FROM (
            SELECT p.species::TEXT AS species, COUNT(*) AS cnt
            FROM public.patients p
            WHERE p.organization_id = v_org_id
              AND p.deleted_at IS NULL
              AND p.is_active = true
              AND p.is_deceased = false
              AND (p_branch_id IS NULL OR p.branch_id = p_branch_id)
            GROUP BY p.species
          ) s
        ),
        '[]'::jsonb
      ),
    'recent_patients',
      COALESCE(
        (
          SELECT jsonb_agg(row_to_json(r) ORDER BY r.created_at DESC)
          FROM (
            SELECT
              p.id,
              p.name,
              p.species::TEXT AS species,
              o.full_name AS owner_full_name,
              p.created_at
            FROM public.patients p
            INNER JOIN public.owners o ON o.id = p.owner_id AND o.deleted_at IS NULL
            WHERE p.organization_id = v_org_id
              AND p.deleted_at IS NULL
              AND (p_branch_id IS NULL OR p.branch_id = p_branch_id)
            ORDER BY p.created_at DESC
            LIMIT 5
          ) r
        ),
        '[]'::jsonb
      ),
    'recent_owners',
      COALESCE(
        (
          SELECT jsonb_agg(row_to_json(r) ORDER BY r.created_at DESC)
          FROM (
            SELECT o.id, o.full_name, o.created_at
            FROM public.owners o
            WHERE o.organization_id = v_org_id
              AND o.deleted_at IS NULL
              AND (p_branch_id IS NULL OR o.branch_id = p_branch_id)
            ORDER BY o.created_at DESC
            LIMIT 5
          ) r
        ),
        '[]'::jsonb
      )
  );
END;
$$;
