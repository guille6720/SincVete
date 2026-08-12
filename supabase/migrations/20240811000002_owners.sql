-- SincVete - Módulo 4: Propietarios

CREATE TABLE public.owners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL CHECK (char_length(full_name) BETWEEN 2 AND 150),
  email TEXT,
  phone TEXT,
  phone_whatsapp TEXT,
  document_type TEXT NOT NULL DEFAULT 'DNI' CHECK (document_type IN ('DNI', 'CUIT', 'Pasaporte', 'Otro')),
  document_number TEXT,
  address TEXT,
  city TEXT,
  province TEXT,
  postal_code TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ,
  CONSTRAINT owners_email_format CHECK (
    email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
  )
);

CREATE INDEX idx_owners_org_created ON public.owners (organization_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_owners_org_name ON public.owners (organization_id, lower(full_name))
  WHERE deleted_at IS NULL;

CREATE INDEX idx_owners_org_phone ON public.owners (organization_id, phone)
  WHERE deleted_at IS NULL AND phone IS NOT NULL;

CREATE INDEX idx_owners_org_document ON public.owners (organization_id, document_number)
  WHERE deleted_at IS NULL AND document_number IS NOT NULL;

CREATE INDEX idx_owners_org_branch ON public.owners (organization_id, branch_id)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_owners_search ON public.owners
  USING gin (
    to_tsvector(
      'spanish',
      coalesce(full_name, '') || ' ' ||
      coalesce(email, '') || ' ' ||
      coalesce(phone, '') || ' ' ||
      coalesce(phone_whatsapp, '') || ' ' ||
      coalesce(document_number, '')
    )
  )
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_owners_updated_at
  BEFORE UPDATE ON public.owners
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_audit_owners
  AFTER INSERT OR UPDATE OR DELETE ON public.owners
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

ALTER TABLE public.owners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owners_select_tenant" ON public.owners
  FOR SELECT USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('patients:read')
  );

CREATE POLICY "owners_insert_tenant" ON public.owners
  FOR INSERT WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.has_permission('patients:write')
  );

CREATE POLICY "owners_update_tenant" ON public.owners
  FOR UPDATE USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('patients:write')
  );

-- Búsqueda server-side con full-text (función reutilizable)
CREATE OR REPLACE FUNCTION public.search_owners(
  p_search TEXT DEFAULT NULL,
  p_branch_id UUID DEFAULT NULL,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 25
)
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  branch_id UUID,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  phone_whatsapp TEXT,
  document_type TEXT,
  document_number TEXT,
  address TEXT,
  city TEXT,
  province TEXT,
  postal_code TEXT,
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
  v_query TEXT;
BEGIN
  v_org_id := public.get_user_organization_id();

  IF v_org_id IS NULL OR NOT public.has_permission('patients:read') THEN
    RETURN;
  END IF;

  v_offset := GREATEST(p_page - 1, 0) * LEAST(GREATEST(p_page_size, 1), 100);

  RETURN QUERY
  WITH filtered AS (
    SELECT o.*
    FROM public.owners o
    WHERE o.organization_id = v_org_id
      AND o.deleted_at IS NULL
      AND (p_branch_id IS NULL OR o.branch_id = p_branch_id)
      AND (
        p_search IS NULL
        OR btrim(p_search) = ''
        OR to_tsvector(
          'spanish',
          coalesce(o.full_name, '') || ' ' ||
          coalesce(o.email, '') || ' ' ||
          coalesce(o.phone, '') || ' ' ||
          coalesce(o.phone_whatsapp, '') || ' ' ||
          coalesce(o.document_number, '')
        ) @@ plainto_tsquery('spanish', p_search)
        OR o.full_name ILIKE '%' || p_search || '%'
        OR o.phone ILIKE '%' || p_search || '%'
        OR o.document_number ILIKE '%' || p_search || '%'
      )
  ),
  counted AS (
    SELECT COUNT(*) AS cnt FROM filtered
  )
  SELECT
    f.id, f.organization_id, f.branch_id, f.full_name, f.email, f.phone,
    f.phone_whatsapp, f.document_type, f.document_number, f.address, f.city,
    f.province, f.postal_code, f.notes, f.is_active, f.created_at, f.updated_at,
    c.cnt
  FROM filtered f
  CROSS JOIN counted c
  ORDER BY f.full_name ASC
  LIMIT LEAST(GREATEST(p_page_size, 1), 100)
  OFFSET v_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_owners TO authenticated;
