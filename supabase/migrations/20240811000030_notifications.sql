-- SincVete - Módulo 22: Notificaciones in-app del staff

DO $$ BEGIN
  CREATE TYPE public.notification_kind AS ENUM (
    'cita',
    'laboratorio',
    'stock',
    'internacion',
    'factura',
    'receta'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  kind public.notification_kind NOT NULL,
  title TEXT NOT NULL CHECK (char_length(title) BETWEEN 1 AND 160),
  body TEXT CHECK (body IS NULL OR char_length(body) <= 500),
  href TEXT NOT NULL CHECK (href ~ '^/[^/].*'),
  related_type TEXT CHECK (related_type IS NULL OR char_length(related_type) BETWEEN 1 AND 40),
  related_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS kind public.notification_kind,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS body TEXT,
  ADD COLUMN IF NOT EXISTS href TEXT,
  ADD COLUMN IF NOT EXISTS related_type TEXT,
  ADD COLUMN IF NOT EXISTS related_id UUID,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_notifications_org_created
  ON public.notifications (organization_id, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_org_kind
  ON public.notifications (organization_id, kind, created_at DESC)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_notifications_related
  ON public.notifications (organization_id, kind, related_id)
  WHERE deleted_at IS NULL AND related_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.notification_reads (
  notification_id UUID NOT NULL REFERENCES public.notifications(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (notification_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_reads_user
  ON public.notification_reads (user_id, read_at DESC);

DROP TRIGGER IF EXISTS trg_notifications_updated_at ON public.notifications;
CREATE TRIGGER trg_notifications_updated_at
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select_staff" ON public.notifications;
CREATE POLICY "notifications_select_staff" ON public.notifications
  FOR SELECT USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND public.is_clinic_staff()
  );

DROP POLICY IF EXISTS "notification_reads_select_own" ON public.notification_reads;
CREATE POLICY "notification_reads_select_own" ON public.notification_reads
  FOR SELECT USING (
    user_id = auth.uid()
    AND public.is_clinic_staff()
  );

DROP POLICY IF EXISTS "notification_reads_insert_own" ON public.notification_reads;
CREATE POLICY "notification_reads_insert_own" ON public.notification_reads
  FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND public.is_clinic_staff()
  );

CREATE OR REPLACE FUNCTION public.emit_notification(
  p_organization_id UUID,
  p_branch_id UUID,
  p_kind public.notification_kind,
  p_title TEXT,
  p_body TEXT,
  p_href TEXT,
  p_related_type TEXT,
  p_related_id UUID,
  p_dedupe_hours INT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_organization_id IS NULL OR p_title IS NULL OR btrim(p_title) = '' OR p_href IS NULL THEN
    RETURN NULL;
  END IF;

  IF p_dedupe_hours IS NOT NULL AND p_related_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.notifications n
      WHERE n.organization_id = p_organization_id
        AND n.deleted_at IS NULL
        AND n.kind = p_kind
        AND n.related_id = p_related_id
        AND n.created_at >= now() - make_interval(hours => p_dedupe_hours)
    ) THEN
      RETURN NULL;
    END IF;
  END IF;

  INSERT INTO public.notifications (
    organization_id,
    branch_id,
    kind,
    title,
    body,
    href,
    related_type,
    related_id
  )
  VALUES (
    p_organization_id,
    p_branch_id,
    p_kind,
    left(btrim(p_title), 160),
    NULLIF(left(btrim(COALESCE(p_body, '')), 500), ''),
    p_href,
    p_related_type,
    p_related_id
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.search_notifications(
  p_search TEXT DEFAULT NULL,
  p_kind TEXT DEFAULT NULL,
  p_unread_only BOOLEAN DEFAULT false,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 25
)
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  branch_id UUID,
  kind public.notification_kind,
  title TEXT,
  body TEXT,
  href TEXT,
  related_type TEXT,
  related_id UUID,
  read_at TIMESTAMPTZ,
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
  v_user_id UUID;
  v_offset INT;
BEGIN
  v_org_id := public.get_user_organization_id();
  v_user_id := auth.uid();
  IF v_org_id IS NULL OR v_user_id IS NULL OR NOT public.is_clinic_staff() THEN
    RETURN;
  END IF;

  v_offset := GREATEST(p_page - 1, 0) * LEAST(GREATEST(p_page_size, 1), 100);

  RETURN QUERY
  WITH filtered AS (
    SELECT
      n.*,
      r.read_at AS user_read_at
    FROM public.notifications n
    LEFT JOIN public.notification_reads r
      ON r.notification_id = n.id AND r.user_id = v_user_id
    WHERE n.organization_id = v_org_id
      AND n.deleted_at IS NULL
      AND (p_kind IS NULL OR btrim(p_kind) = '' OR n.kind::TEXT = p_kind)
      AND (NOT COALESCE(p_unread_only, false) OR r.read_at IS NULL)
      AND (
        p_search IS NULL
        OR btrim(p_search) = ''
        OR n.title ILIKE '%' || p_search || '%'
        OR n.body ILIKE '%' || p_search || '%'
      )
  ),
  counted AS (
    SELECT COUNT(*) AS cnt FROM filtered
  )
  SELECT
    f.id,
    f.organization_id,
    f.branch_id,
    f.kind,
    f.title,
    f.body,
    f.href,
    f.related_type,
    f.related_id,
    f.user_read_at,
    f.created_at,
    f.updated_at,
    f.deleted_at,
    c.cnt
  FROM filtered f
  CROSS JOIN counted c
  ORDER BY f.created_at DESC, f.id DESC
  LIMIT LEAST(GREATEST(p_page_size, 1), 100)
  OFFSET v_offset;
END;
$$;

CREATE OR REPLACE FUNCTION public.count_unread_notifications()
RETURNS INTEGER
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
BEGIN
  v_org_id := public.get_user_organization_id();
  v_user_id := auth.uid();
  IF v_org_id IS NULL OR v_user_id IS NULL OR NOT public.is_clinic_staff() THEN
    RETURN 0;
  END IF;

  RETURN (
    SELECT COUNT(*)::int
    FROM public.notifications n
    LEFT JOIN public.notification_reads r
      ON r.notification_id = n.id AND r.user_id = v_user_id
    WHERE n.organization_id = v_org_id
      AND n.deleted_at IS NULL
      AND r.read_at IS NULL
      AND n.created_at >= now() - interval '90 days'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_notification_read(p_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
BEGIN
  v_org_id := public.get_user_organization_id();
  v_user_id := auth.uid();
  IF v_org_id IS NULL OR v_user_id IS NULL OR NOT public.is_clinic_staff() THEN
    RAISE EXCEPTION 'Sin permisos';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.notifications n
    WHERE n.id = p_id
      AND n.organization_id = v_org_id
      AND n.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'Notificación no encontrada';
  END IF;

  INSERT INTO public.notification_reads (notification_id, user_id)
  VALUES (p_id, v_user_id)
  ON CONFLICT (notification_id, user_id) DO NOTHING;

  RETURN true;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_user_id UUID;
  v_count INTEGER;
BEGIN
  v_org_id := public.get_user_organization_id();
  v_user_id := auth.uid();
  IF v_org_id IS NULL OR v_user_id IS NULL OR NOT public.is_clinic_staff() THEN
    RAISE EXCEPTION 'Sin permisos';
  END IF;

  INSERT INTO public.notification_reads (notification_id, user_id)
  SELECT n.id, v_user_id
  FROM public.notifications n
  LEFT JOIN public.notification_reads r
    ON r.notification_id = n.id AND r.user_id = v_user_id
  WHERE n.organization_id = v_org_id
    AND n.deleted_at IS NULL
    AND r.read_at IS NULL
  ON CONFLICT (notification_id, user_id) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.search_notifications TO authenticated;
GRANT EXECUTE ON FUNCTION public.count_unread_notifications TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_notification_read TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_all_notifications_read TO authenticated;

REVOKE ALL ON FUNCTION public.emit_notification(
  UUID, UUID, public.notification_kind, TEXT, TEXT, TEXT, TEXT, UUID, INT
) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.trg_notify_appointment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient TEXT;
BEGIN
  IF NEW.deleted_at IS NOT NULL OR NEW.status IN ('cancelada', 'ausente') THEN
    RETURN NEW;
  END IF;

  SELECT p.name INTO v_patient
  FROM public.patients p
  WHERE p.id = NEW.patient_id;

  PERFORM public.emit_notification(
    NEW.organization_id,
    NEW.branch_id,
    'cita',
    'Nueva cita: ' || COALESCE(v_patient, 'paciente'),
    COALESCE(NEW.title, NEW.appointment_type::TEXT) || ' · ' ||
      to_char(NEW.starts_at AT TIME ZONE 'America/Argentina/Buenos_Aires', 'DD/MM HH24:MI'),
    '/agenda/' || NEW.id::TEXT,
    'appointment',
    NEW.id,
    NULL
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_appointment ON public.appointments;
CREATE TRIGGER trg_notify_appointment
  AFTER INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_appointment();

CREATE OR REPLACE FUNCTION public.trg_notify_lab_order()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient TEXT;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM 'completada' OR OLD.status IS NOT DISTINCT FROM 'completada' THEN
    RETURN NEW;
  END IF;

  SELECT p.name INTO v_patient
  FROM public.patients p
  WHERE p.id = NEW.patient_id;

  PERFORM public.emit_notification(
    NEW.organization_id,
    NEW.branch_id,
    'laboratorio',
    'Resultado de laboratorio: ' || COALESCE(v_patient, 'paciente'),
    COALESCE(NEW.title, 'Estudio') || ' listo para revisar',
    '/laboratorio/' || NEW.id::TEXT,
    'lab_order',
    NEW.id,
    NULL
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_lab_order ON public.lab_orders;
CREATE TRIGGER trg_notify_lab_order
  AFTER UPDATE OF status ON public.lab_orders
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_lab_order();

CREATE OR REPLACE FUNCTION public.trg_notify_inventory_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL OR NEW.is_active IS NOT TRUE THEN
    RETURN NEW;
  END IF;
  IF NEW.quantity > NEW.min_quantity THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE'
    AND OLD.quantity <= OLD.min_quantity
    AND OLD.is_active IS TRUE THEN
    RETURN NEW;
  END IF;

  PERFORM public.emit_notification(
    NEW.organization_id,
    NEW.branch_id,
    'stock',
    'Stock bajo: ' || NEW.name,
    'Quedan ' || trim(to_char(NEW.quantity, 'FM999999990.00')) ||
      ' (mínimo ' || trim(to_char(NEW.min_quantity, 'FM999999990.00')) || ')',
    '/inventario/' || NEW.id::TEXT,
    'inventory_product',
    NEW.id,
    168
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_inventory_stock ON public.inventory_products;
CREATE TRIGGER trg_notify_inventory_stock
  AFTER INSERT OR UPDATE OF quantity, min_quantity, is_active ON public.inventory_products
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_inventory_stock();

CREATE OR REPLACE FUNCTION public.trg_notify_hospitalization()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient TEXT;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.name INTO v_patient
  FROM public.patients p
  WHERE p.id = NEW.patient_id;

  PERFORM public.emit_notification(
    NEW.organization_id,
    NEW.branch_id,
    'internacion',
    'Internación: ' || COALESCE(v_patient, 'paciente'),
    left(COALESCE(NEW.reason, 'Ingreso a internación'), 500),
    '/internacion/' || NEW.id::TEXT,
    'hospitalization',
    NEW.id,
    NULL
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_hospitalization ON public.hospitalizations;
CREATE TRIGGER trg_notify_hospitalization
  AFTER INSERT ON public.hospitalizations
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_hospitalization();

CREATE OR REPLACE FUNCTION public.trg_notify_invoice()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner TEXT;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.status IS DISTINCT FROM 'emitida' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM 'emitida' THEN
    RETURN NEW;
  END IF;

  SELECT o.full_name INTO v_owner
  FROM public.owners o
  WHERE o.id = NEW.owner_id;

  PERFORM public.emit_notification(
    NEW.organization_id,
    NEW.branch_id,
    'factura',
    'Factura emitida: ' || COALESCE(NEW.number, 'sin número'),
    COALESCE(v_owner, 'Tutor') || ' · saldo pendiente',
    '/facturacion/' || NEW.id::TEXT,
    'invoice',
    NEW.id,
    NULL
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_invoice ON public.invoices;
CREATE TRIGGER trg_notify_invoice
  AFTER INSERT OR UPDATE OF status ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_invoice();

CREATE OR REPLACE FUNCTION public.trg_notify_prescription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_patient TEXT;
BEGIN
  IF NEW.deleted_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  SELECT p.name INTO v_patient
  FROM public.patients p
  WHERE p.id = NEW.patient_id;

  PERFORM public.emit_notification(
    NEW.organization_id,
    NEW.branch_id,
    'receta',
    'Nueva receta: ' || COALESCE(NEW.number, 'sin número'),
    COALESCE(v_patient, 'paciente'),
    '/farmacia/' || NEW.id::TEXT,
    'prescription',
    NEW.id,
    NULL
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_prescription ON public.prescriptions;
CREATE TRIGGER trg_notify_prescription
  AFTER INSERT ON public.prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.trg_notify_prescription();

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
