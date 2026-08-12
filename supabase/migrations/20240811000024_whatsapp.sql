-- SincVete - Módulo 15: WhatsApp

CREATE TYPE public.whatsapp_related_type AS ENUM (
  'none',
  'appointment',
  'invoice',
  'lab_order',
  'vaccination',
  'portal'
);

CREATE TABLE public.whatsapp_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  owner_id UUID NOT NULL REFERENCES public.owners(id) ON DELETE RESTRICT,
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  related_type public.whatsapp_related_type NOT NULL DEFAULT 'none',
  related_id UUID,
  template_key TEXT NOT NULL CHECK (char_length(template_key) BETWEEN 2 AND 60),
  phone_e164 TEXT NOT NULL CHECK (phone_e164 ~ '^[0-9]{11,15}$'),
  body TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_whatsapp_messages_org_created
  ON public.whatsapp_messages (organization_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_whatsapp_messages_owner
  ON public.whatsapp_messages (owner_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX idx_whatsapp_messages_search ON public.whatsapp_messages
  USING gin (
    to_tsvector(
      'spanish',
      coalesce(body, '') || ' ' ||
      coalesce(phone_e164, '') || ' ' ||
      coalesce(template_key, '')
    )
  )
  WHERE deleted_at IS NULL;

CREATE TRIGGER trg_whatsapp_messages_updated_at
  BEFORE UPDATE ON public.whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_audit_whatsapp_messages
  AFTER INSERT OR UPDATE OR DELETE ON public.whatsapp_messages
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "whatsapp_messages_select_tenant" ON public.whatsapp_messages
  FOR SELECT USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.has_permission('whatsapp:send')
  );

CREATE POLICY "whatsapp_messages_insert_tenant" ON public.whatsapp_messages
  FOR INSERT WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.has_permission('whatsapp:send')
  );

CREATE OR REPLACE FUNCTION public.has_permission(required_permission TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_role public.user_role;
  custom_perms JSONB;
  role_perms TEXT[];
BEGIN
  SELECT bm.role, bm.permissions
  INTO user_role, custom_perms
  FROM public.branch_members bm
  WHERE bm.user_id = auth.uid()
    AND bm.deleted_at IS NULL
    AND bm.is_active = true
  ORDER BY bm.created_at ASC
  LIMIT 1;

  IF user_role IS NULL THEN
    RETURN false;
  END IF;

  IF custom_perms IS NOT NULL AND jsonb_array_length(custom_perms) > 0 THEN
    RETURN custom_perms ? required_permission;
  END IF;

  role_perms := CASE user_role
    WHEN 'owner' THEN ARRAY[
      'org:manage','branch:manage','users:manage','patients:read','patients:write',
      'appointments:read','appointments:write','clinical:read','clinical:write',
      'billing:read','billing:write','inventory:read','inventory:write',
      'reports:read','audit:read','whatsapp:send'
    ]
    WHEN 'admin' THEN ARRAY[
      'org:manage','branch:manage','users:manage','patients:read','patients:write',
      'appointments:read','appointments:write','clinical:read','clinical:write',
      'billing:read','billing:write','inventory:read','inventory:write',
      'reports:read','audit:read','whatsapp:send'
    ]
    WHEN 'veterinarian' THEN ARRAY[
      'patients:read','patients:write','appointments:read','appointments:write',
      'clinical:read','clinical:write','inventory:read','reports:read','whatsapp:send'
    ]
    WHEN 'nurse' THEN ARRAY[
      'patients:read','patients:write','appointments:read','appointments:write',
      'clinical:read','clinical:write','inventory:read','whatsapp:send'
    ]
    WHEN 'receptionist' THEN ARRAY[
      'patients:read','patients:write','appointments:read','appointments:write',
      'billing:read','whatsapp:send'
    ]
    WHEN 'cashier' THEN ARRAY[
      'patients:read','appointments:read','billing:read','billing:write','whatsapp:send'
    ]
    WHEN 'lab_tech' THEN ARRAY[
      'patients:read','clinical:read','clinical:write','inventory:read','whatsapp:send'
    ]
    WHEN 'readonly' THEN ARRAY['patients:read','appointments:read','clinical:read','reports:read']
    ELSE ARRAY[]::TEXT[]
  END;

  RETURN required_permission = ANY(role_perms);
END;
$$;

CREATE OR REPLACE FUNCTION public.log_whatsapp_message(
  p_owner_id UUID,
  p_body TEXT,
  p_phone_e164 TEXT,
  p_template_key TEXT,
  p_patient_id UUID DEFAULT NULL,
  p_related_type TEXT DEFAULT 'none',
  p_related_id UUID DEFAULT NULL,
  p_branch_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_branch_id UUID;
  v_related public.whatsapp_related_type;
  v_id UUID;
BEGIN
  v_org_id := public.get_user_organization_id();

  IF v_org_id IS NULL OR NOT public.has_permission('whatsapp:send') THEN
    RAISE EXCEPTION 'No tenés permisos para enviar WhatsApp';
  END IF;

  IF p_body IS NULL OR char_length(btrim(p_body)) < 1 OR char_length(p_body) > 2000 THEN
    RAISE EXCEPTION 'El mensaje es inválido';
  END IF;

  IF p_phone_e164 IS NULL OR p_phone_e164 !~ '^[0-9]{11,15}$' THEN
    RAISE EXCEPTION 'El teléfono de WhatsApp es inválido';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.owners
    WHERE id = p_owner_id
      AND organization_id = v_org_id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Propietario no encontrado';
  END IF;

  IF p_patient_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.patients
    WHERE id = p_patient_id
      AND owner_id = p_owner_id
      AND organization_id = v_org_id
      AND deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Paciente no encontrado';
  END IF;

  IF p_branch_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.branches
    WHERE id = p_branch_id
      AND organization_id = v_org_id
      AND deleted_at IS NULL
  ) THEN
    v_branch_id := p_branch_id;
  END IF;

  BEGIN
    v_related := COALESCE(p_related_type, 'none')::public.whatsapp_related_type;
  EXCEPTION WHEN invalid_text_representation THEN
    v_related := 'none';
  END;

  INSERT INTO public.whatsapp_messages (
    organization_id, branch_id, owner_id, patient_id,
    related_type, related_id, template_key, phone_e164, body, sent_by
  ) VALUES (
    v_org_id,
    v_branch_id,
    p_owner_id,
    p_patient_id,
    v_related,
    p_related_id,
    COALESCE(NULLIF(btrim(p_template_key), ''), 'mensaje_libre'),
    p_phone_e164,
    btrim(p_body),
    auth.uid()
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'id', v_id,
    'phone_e164', p_phone_e164,
    'body', btrim(p_body)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.search_whatsapp_messages(
  p_search TEXT DEFAULT NULL,
  p_owner_id UUID DEFAULT NULL,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 25
)
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  branch_id UUID,
  owner_id UUID,
  patient_id UUID,
  related_type public.whatsapp_related_type,
  related_id UUID,
  template_key TEXT,
  phone_e164 TEXT,
  body TEXT,
  sent_by UUID,
  owner_full_name TEXT,
  patient_name TEXT,
  sent_by_name TEXT,
  created_at TIMESTAMPTZ,
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

  IF v_org_id IS NULL OR NOT public.has_permission('whatsapp:send') THEN
    RETURN;
  END IF;

  v_offset := GREATEST(p_page - 1, 0) * LEAST(GREATEST(p_page_size, 1), 100);

  RETURN QUERY
  WITH filtered AS (
    SELECT m.*
    FROM public.whatsapp_messages m
    INNER JOIN public.owners o ON o.id = m.owner_id
    WHERE m.organization_id = v_org_id
      AND m.deleted_at IS NULL
      AND (p_owner_id IS NULL OR m.owner_id = p_owner_id)
      AND (
        p_search IS NULL
        OR btrim(p_search) = ''
        OR to_tsvector(
          'spanish',
          coalesce(m.body, '') || ' ' ||
          coalesce(m.phone_e164, '') || ' ' ||
          coalesce(o.full_name, '')
        ) @@ plainto_tsquery('spanish', p_search)
        OR o.full_name ILIKE '%' || p_search || '%'
        OR m.phone_e164 ILIKE '%' || p_search || '%'
        OR m.body ILIKE '%' || p_search || '%'
      )
  ),
  counted AS (
    SELECT COUNT(*) AS cnt FROM filtered
  )
  SELECT
    f.id, f.organization_id, f.branch_id, f.owner_id, f.patient_id,
    f.related_type, f.related_id, f.template_key, f.phone_e164, f.body, f.sent_by,
    o.full_name,
    p.name,
    pr.full_name,
    f.created_at,
    c.cnt
  FROM filtered f
  CROSS JOIN counted c
  INNER JOIN public.owners o ON o.id = f.owner_id
  LEFT JOIN public.patients p ON p.id = f.patient_id
  LEFT JOIN public.profiles pr ON pr.id = f.sent_by
  ORDER BY f.created_at DESC
  LIMIT LEAST(GREATEST(p_page_size, 1), 100)
  OFFSET v_offset;
END;
$$;

GRANT EXECUTE ON FUNCTION public.has_permission TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_whatsapp_message TO authenticated;
GRANT EXECUTE ON FUNCTION public.search_whatsapp_messages TO authenticated;
