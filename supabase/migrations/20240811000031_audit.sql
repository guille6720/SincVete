-- SincVete - Módulo 23: Auditoría

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_action
  ON public.audit_logs (organization_id, action, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_org_entity_type
  ON public.audit_logs (organization_id, entity_type, created_at DESC);

CREATE OR REPLACE FUNCTION public.audit_log_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  org_id UUID;
  branch_id_val UUID;
  action_name TEXT;
  old_row JSONB;
  new_row JSONB;
BEGIN
  IF TG_OP = 'INSERT' THEN
    action_name := 'create';
    new_row := to_jsonb(NEW);
    org_id := NEW.organization_id;
  ELSIF TG_OP = 'UPDATE' THEN
    action_name := 'update';
    old_row := to_jsonb(OLD);
    new_row := to_jsonb(NEW);
    org_id := NEW.organization_id;
  ELSIF TG_OP = 'DELETE' THEN
    action_name := 'delete';
    old_row := to_jsonb(OLD);
    org_id := OLD.organization_id;
  END IF;

  BEGIN
    branch_id_val := NULLIF(COALESCE(new_row, old_row)->>'branch_id', '')::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    branch_id_val := NULL;
  END;

  INSERT INTO public.audit_logs (
    organization_id, branch_id, user_id, action, entity_type, entity_id, old_data, new_data
  ) VALUES (
    org_id,
    branch_id_val,
    auth.uid(),
    action_name,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    old_row,
    new_row
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.audit_event_summary(
  p_action TEXT,
  p_entity_type TEXT,
  p_old JSONB,
  p_new JSONB
)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v_action TEXT;
  v_soft BOOLEAN;
  v_subject TEXT;
  v_label TEXT;
BEGIN
  v_action := lower(COALESCE(p_action, ''));
  IF v_action IN ('insert', 'create') THEN
    v_action := 'create';
  ELSIF v_action IN ('update') THEN
    v_action := 'update';
  ELSIF v_action IN ('delete') THEN
    v_action := 'delete';
  END IF;

  v_soft := v_action = 'update'
    AND COALESCE(p_new->>'deleted_at', '') <> ''
    AND COALESCE(p_old->>'deleted_at', '') = '';

  v_subject := COALESCE(
    NULLIF(p_new->>'name', ''),
    NULLIF(p_old->>'name', ''),
    NULLIF(p_new->>'full_name', ''),
    NULLIF(p_old->>'full_name', ''),
    NULLIF(p_new->>'title', ''),
    NULLIF(p_old->>'title', ''),
    NULLIF(p_new->>'number', ''),
    NULLIF(p_old->>'number', ''),
    NULLIF(p_new->>'vaccine_name', ''),
    NULLIF(p_old->>'vaccine_name', ''),
    NULLIF(p_new->>'procedure_name', ''),
    NULLIF(p_old->>'procedure_name', ''),
    NULLIF(p_new->>'sku', ''),
    NULLIF(p_old->>'sku', ''),
    ''
  );

  v_label := CASE p_entity_type
    WHEN 'patients' THEN 'Paciente'
    WHEN 'owners' THEN 'Propietario'
    WHEN 'appointments' THEN 'Cita'
    WHEN 'clinical_entries' THEN 'Historia clínica'
    WHEN 'consultations' THEN 'Consulta'
    WHEN 'hospitalizations' THEN 'Internación'
    WHEN 'hospitalization_notes' THEN 'Nota de internación'
    WHEN 'vaccinations' THEN 'Vacuna'
    WHEN 'surgeries' THEN 'Cirugía'
    WHEN 'lab_orders' THEN 'Laboratorio'
    WHEN 'lab_order_items' THEN 'Ítem de laboratorio'
    WHEN 'inventory_products' THEN 'Producto'
    WHEN 'inventory_movements' THEN 'Movimiento de stock'
    WHEN 'invoices' THEN 'Factura'
    WHEN 'invoice_items' THEN 'Ítem de factura'
    WHEN 'payments' THEN 'Pago'
    WHEN 'prescriptions' THEN 'Receta'
    WHEN 'cash_sessions' THEN 'Caja'
    WHEN 'cash_movements' THEN 'Movimiento de caja'
    WHEN 'clinical_images' THEN 'Imagen clínica'
    WHEN 'whatsapp_messages' THEN 'WhatsApp'
    WHEN 'reminder_logs' THEN 'Recordatorio'
    WHEN 'ai_suggestions' THEN 'IA clínica'
    WHEN 'notifications' THEN 'Notificación'
    WHEN 'organizations' THEN 'Clínica'
    WHEN 'branches' THEN 'Sucursal'
    WHEN 'profiles' THEN 'Perfil'
    WHEN 'branch_members' THEN 'Miembro'
    WHEN 'organization_invitations' THEN 'Invitación'
    WHEN 'owner_portal_invites' THEN 'Invitación al portal'
    ELSE replace(p_entity_type, '_', ' ')
  END;

  IF p_entity_type = 'consultations' AND v_action = 'update' AND p_new->>'status' = 'completada' THEN
    RETURN 'Consulta completada' || CASE WHEN v_subject <> '' THEN ': ' || v_subject ELSE '' END;
  END IF;
  IF p_entity_type = 'hospitalizations' AND v_action = 'update' AND p_new->>'status' = 'alta' THEN
    RETURN 'Alta de internación';
  END IF;
  IF p_entity_type = 'lab_orders' AND v_action = 'update' AND p_new->>'status' = 'completada' THEN
    RETURN 'Lab completado' || CASE WHEN v_subject <> '' THEN ': ' || v_subject ELSE '' END;
  END IF;
  IF p_entity_type = 'invoices' AND v_action = 'update' AND p_new->>'status' = 'emitida' THEN
    RETURN 'Factura emitida' || CASE WHEN v_subject <> '' THEN ': ' || v_subject ELSE '' END;
  END IF;
  IF p_entity_type = 'invoices' AND v_action = 'update' AND p_new->>'status' = 'pagada' THEN
    RETURN 'Factura cobrada' || CASE WHEN v_subject <> '' THEN ': ' || v_subject ELSE '' END;
  END IF;
  IF p_entity_type = 'invoices' AND v_action = 'update' AND p_new->>'status' = 'anulada' THEN
    RETURN 'Factura anulada' || CASE WHEN v_subject <> '' THEN ': ' || v_subject ELSE '' END;
  END IF;
  IF p_entity_type = 'surgeries' AND v_action = 'update' AND p_new->>'status' = 'completada' THEN
    RETURN 'Cirugía completada' || CASE WHEN v_subject <> '' THEN ': ' || v_subject ELSE '' END;
  END IF;

  RETURN v_label || ' ' ||
    CASE
      WHEN v_action = 'create' THEN 'creado'
      WHEN v_soft OR v_action = 'delete' THEN 'eliminado'
      ELSE 'actualizado'
    END ||
    CASE WHEN v_subject <> '' THEN ': ' || v_subject ELSE '' END;
END;
$$;

CREATE OR REPLACE FUNCTION public.search_audit_logs(
  p_search TEXT DEFAULT NULL,
  p_action TEXT DEFAULT NULL,
  p_entity_type TEXT DEFAULT NULL,
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 25
)
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  branch_id UUID,
  user_id UUID,
  action TEXT,
  entity_type TEXT,
  entity_id UUID,
  user_full_name TEXT,
  branch_name TEXT,
  summary TEXT,
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
  IF v_org_id IS NULL OR NOT public.has_permission('audit:read') THEN
    RETURN;
  END IF;

  v_offset := GREATEST(p_page - 1, 0) * LEAST(GREATEST(p_page_size, 1), 100);

  RETURN QUERY
  WITH filtered AS (
    SELECT
      al.*,
      pr.full_name AS usr_name,
      b.name AS br_name,
      public.audit_event_summary(al.action, al.entity_type, al.old_data, al.new_data) AS evt_summary
    FROM public.audit_logs al
    LEFT JOIN public.profiles pr ON pr.id = al.user_id
    LEFT JOIN public.branches b ON b.id = al.branch_id
    WHERE al.organization_id = v_org_id
      AND (p_action IS NULL OR btrim(p_action) = '' OR al.action = p_action)
      AND (p_entity_type IS NULL OR btrim(p_entity_type) = '' OR al.entity_type = p_entity_type)
      AND (p_from IS NULL OR al.created_at >= p_from)
      AND (p_to IS NULL OR al.created_at < p_to)
      AND (
        p_search IS NULL
        OR btrim(p_search) = ''
        OR al.action ILIKE '%' || p_search || '%'
        OR al.entity_type ILIKE '%' || p_search || '%'
        OR al.entity_id::TEXT ILIKE '%' || p_search || '%'
        OR pr.full_name ILIKE '%' || p_search || '%'
        OR COALESCE(al.new_data->>'name', '') ILIKE '%' || p_search || '%'
        OR COALESCE(al.new_data->>'full_name', '') ILIKE '%' || p_search || '%'
        OR COALESCE(al.new_data->>'title', '') ILIKE '%' || p_search || '%'
        OR COALESCE(al.new_data->>'number', '') ILIKE '%' || p_search || '%'
        OR COALESCE(al.old_data->>'name', '') ILIKE '%' || p_search || '%'
        OR COALESCE(al.old_data->>'full_name', '') ILIKE '%' || p_search || '%'
      )
  ),
  counted AS (
    SELECT COUNT(*) AS cnt FROM filtered
  )
  SELECT
    f.id,
    f.organization_id,
    f.branch_id,
    f.user_id,
    f.action,
    f.entity_type,
    f.entity_id,
    f.usr_name,
    f.br_name,
    f.evt_summary,
    f.created_at,
    c.cnt
  FROM filtered f
  CROSS JOIN counted c
  ORDER BY f.created_at DESC, f.id DESC
  LIMIT LEAST(GREATEST(p_page_size, 1), 100)
  OFFSET v_offset;
END;
$$;

CREATE OR REPLACE FUNCTION public.count_audit_logs_today()
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_today_start TIMESTAMPTZ;
BEGIN
  v_org_id := public.get_user_organization_id();
  IF v_org_id IS NULL OR NOT public.has_permission('audit:read') THEN
    RETURN 0;
  END IF;

  v_today_start := date_trunc(
    'day',
    timezone('America/Argentina/Buenos_Aires', now())
  ) AT TIME ZONE 'America/Argentina/Buenos_Aires';

  RETURN (
    SELECT COUNT(*)::int
    FROM public.audit_logs al
    WHERE al.organization_id = v_org_id
      AND al.created_at >= v_today_start
      AND al.created_at < v_today_start + interval '1 day'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_dashboard_activity(
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  action TEXT,
  entity_type TEXT,
  entity_id UUID,
  user_full_name TEXT,
  summary TEXT,
  created_at TIMESTAMPTZ
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

  IF v_org_id IS NULL OR NOT public.has_permission('audit:read') THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    al.id,
    al.action,
    al.entity_type,
    al.entity_id,
    pr.full_name AS user_full_name,
    public.audit_event_summary(al.action, al.entity_type, al.old_data, al.new_data) AS summary,
    al.created_at
  FROM public.audit_logs al
  LEFT JOIN public.profiles pr ON pr.id = al.user_id
  WHERE al.organization_id = v_org_id
  ORDER BY al.created_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 50);
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_audit_logs TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_audit_logs_today TO authenticated;
GRANT EXECUTE ON FUNCTION public.audit_event_summary TO authenticated;

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
    'notifications_unread',
      public.count_unread_notifications(),
    'audit_events_today',
      public.count_audit_logs_today(),
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
