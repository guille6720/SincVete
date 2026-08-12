-- SincVete - Módulo 16: Recordatorios

DO $$ BEGIN
  CREATE TYPE public.reminder_type AS ENUM (
    'appointment',
    'vaccination',
    'invoice'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.reminder_status AS ENUM (
    'enviado',
    'omitido'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.reminder_channel AS ENUM (
    'whatsapp',
    'omitido'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS public.reminder_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE RESTRICT,
  branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  reminder_type public.reminder_type NOT NULL,
  related_id UUID NOT NULL,
  owner_id UUID NOT NULL REFERENCES public.owners(id) ON DELETE RESTRICT,
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  channel public.reminder_channel NOT NULL DEFAULT 'whatsapp',
  status public.reminder_status NOT NULL,
  due_on DATE,
  whatsapp_message_id UUID REFERENCES public.whatsapp_messages(id) ON DELETE SET NULL,
  sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

ALTER TABLE public.reminder_logs
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS branch_id UUID REFERENCES public.branches(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reminder_type public.reminder_type,
  ADD COLUMN IF NOT EXISTS related_id UUID,
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES public.owners(id) ON DELETE RESTRICT,
  ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS channel public.reminder_channel NOT NULL DEFAULT 'whatsapp',
  ADD COLUMN IF NOT EXISTS status public.reminder_status,
  ADD COLUMN IF NOT EXISTS due_on DATE,
  ADD COLUMN IF NOT EXISTS whatsapp_message_id UUID REFERENCES public.whatsapp_messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sent_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

CREATE UNIQUE INDEX IF NOT EXISTS idx_reminder_logs_unique_open
  ON public.reminder_logs (organization_id, reminder_type, related_id)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_reminder_logs_org_type
  ON public.reminder_logs (organization_id, reminder_type, sent_at DESC)
  WHERE deleted_at IS NULL;

DROP TRIGGER IF EXISTS trg_reminder_logs_updated_at ON public.reminder_logs;
CREATE TRIGGER trg_reminder_logs_updated_at
  BEFORE UPDATE ON public.reminder_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_audit_reminder_logs ON public.reminder_logs;
CREATE TRIGGER trg_audit_reminder_logs
  AFTER INSERT OR UPDATE OR DELETE ON public.reminder_logs
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

ALTER TABLE public.reminder_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reminder_logs_select_tenant" ON public.reminder_logs;
CREATE POLICY "reminder_logs_select_tenant" ON public.reminder_logs
  FOR SELECT USING (
    organization_id = public.get_user_organization_id()
    AND deleted_at IS NULL
    AND (
      public.has_permission('appointments:read')
      OR public.has_permission('clinical:read')
      OR public.has_permission('billing:read')
      OR public.has_permission('whatsapp:send')
    )
  );

DROP POLICY IF EXISTS "reminder_logs_insert_tenant" ON public.reminder_logs;
CREATE POLICY "reminder_logs_insert_tenant" ON public.reminder_logs
  FOR INSERT WITH CHECK (
    organization_id = public.get_user_organization_id()
    AND public.has_permission('whatsapp:send')
  );

CREATE OR REPLACE FUNCTION public.count_pending_reminders(
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
  v_today DATE;
  v_horizon DATE;
  v_count INTEGER := 0;
BEGIN
  v_org_id := public.get_user_organization_id();
  IF v_org_id IS NULL THEN
    RETURN 0;
  END IF;

  v_today := (timezone('America/Argentina/Buenos_Aires', now()))::date;
  v_horizon := v_today + 30;

  IF public.has_permission('appointments:read') THEN
    v_count := v_count + (
      SELECT COUNT(*)::int
      FROM public.appointments a
      WHERE a.organization_id = v_org_id
        AND a.deleted_at IS NULL
        AND a.status IN ('programada', 'confirmada')
        AND a.starts_at >= now()
        AND a.starts_at < now() + interval '48 hours'
        AND (p_branch_id IS NULL OR a.branch_id = p_branch_id)
        AND NOT EXISTS (
          SELECT 1
          FROM public.reminder_logs rl
          WHERE rl.organization_id = v_org_id
            AND rl.deleted_at IS NULL
            AND rl.reminder_type = 'appointment'
            AND rl.related_id = a.id
        )
    );
  END IF;

  IF public.has_permission('clinical:read') THEN
    v_count := v_count + (
      SELECT COUNT(*)::int
      FROM (
        SELECT DISTINCT ON (v.patient_id, lower(btrim(v.vaccine_name)))
          v.id,
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
        ORDER BY v.patient_id, lower(btrim(v.vaccine_name)), v.administered_at DESC, v.created_at DESC
      ) latest
      WHERE latest.next_due_at <= v_horizon
        AND NOT EXISTS (
          SELECT 1
          FROM public.reminder_logs rl
          WHERE rl.organization_id = v_org_id
            AND rl.deleted_at IS NULL
            AND rl.reminder_type = 'vaccination'
            AND rl.related_id = latest.id
        )
    );
  END IF;

  IF public.has_permission('billing:read') THEN
    v_count := v_count + (
      SELECT COUNT(*)::int
      FROM public.invoices inv
      WHERE inv.organization_id = v_org_id
        AND inv.deleted_at IS NULL
        AND inv.status = 'emitida'
        AND inv.balance > 0
        AND (p_branch_id IS NULL OR inv.branch_id = p_branch_id)
        AND NOT EXISTS (
          SELECT 1
          FROM public.reminder_logs rl
          WHERE rl.organization_id = v_org_id
            AND rl.deleted_at IS NULL
            AND rl.reminder_type = 'invoice'
            AND rl.related_id = inv.id
        )
    );
  END IF;

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_clinic_reminders(
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
  v_today DATE;
  v_horizon DATE;
  v_appointments JSONB := '[]'::jsonb;
  v_vaccinations JSONB := '[]'::jsonb;
  v_invoices JSONB := '[]'::jsonb;
BEGIN
  v_org_id := public.get_user_organization_id();

  IF v_org_id IS NULL OR NOT (
    public.has_permission('appointments:read')
    OR public.has_permission('clinical:read')
    OR public.has_permission('billing:read')
    OR public.has_permission('whatsapp:send')
  ) THEN
    RETURN jsonb_build_object(
      'appointments', '[]'::jsonb,
      'vaccinations', '[]'::jsonb,
      'invoices', '[]'::jsonb
    );
  END IF;

  v_today := (timezone('America/Argentina/Buenos_Aires', now()))::date;
  v_horizon := v_today + 30;

  IF public.has_permission('appointments:read') THEN
    SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY r.due_at ASC), '[]'::jsonb)
    INTO v_appointments
    FROM (
      SELECT
        a.id AS related_id,
        'appointment'::text AS reminder_type,
        a.owner_id,
        o.full_name AS owner_name,
        a.patient_id,
        p.name AS patient_name,
        o.phone_whatsapp,
        o.phone,
        a.starts_at AS due_at,
        COALESCE(NULLIF(btrim(a.title), ''), a.appointment_type::text) AS title,
        a.appointment_type::text AS appointment_type,
        a.status::text AS appointment_status,
        NULL::text AS vaccine_name,
        NULL::text AS due_status,
        NULL::text AS invoice_number,
        NULL::numeric AS balance,
        NULL::text AS currency
      FROM public.appointments a
      INNER JOIN public.owners o ON o.id = a.owner_id AND o.deleted_at IS NULL
      INNER JOIN public.patients p ON p.id = a.patient_id AND p.deleted_at IS NULL
      WHERE a.organization_id = v_org_id
        AND a.deleted_at IS NULL
        AND a.status IN ('programada', 'confirmada')
        AND a.starts_at >= now()
        AND a.starts_at < now() + interval '48 hours'
        AND (p_branch_id IS NULL OR a.branch_id = p_branch_id)
        AND NOT EXISTS (
          SELECT 1
          FROM public.reminder_logs rl
          WHERE rl.organization_id = v_org_id
            AND rl.deleted_at IS NULL
            AND rl.reminder_type = 'appointment'
            AND rl.related_id = a.id
        )
      ORDER BY a.starts_at ASC
      LIMIT 50
    ) r;
  END IF;

  IF public.has_permission('clinical:read') THEN
    SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY r.due_at ASC), '[]'::jsonb)
    INTO v_vaccinations
    FROM (
      SELECT
        latest.id AS related_id,
        'vaccination'::text AS reminder_type,
        latest.owner_id,
        latest.owner_name,
        latest.patient_id,
        latest.patient_name,
        latest.phone_whatsapp,
        latest.phone,
        latest.next_due_at::timestamptz AS due_at,
        latest.vaccine_name AS title,
        NULL::text AS appointment_type,
        NULL::text AS appointment_status,
        latest.vaccine_name,
        CASE
          WHEN latest.next_due_at < v_today THEN 'vencida'
          ELSE 'por_vencer'
        END AS due_status,
        NULL::text AS invoice_number,
        NULL::numeric AS balance,
        NULL::text AS currency
      FROM (
        SELECT DISTINCT ON (v.patient_id, lower(btrim(v.vaccine_name)))
          v.id,
          v.owner_id,
          v.patient_id,
          v.vaccine_name,
          v.next_due_at,
          p.name AS patient_name,
          o.full_name AS owner_name,
          o.phone_whatsapp,
          o.phone
        FROM public.vaccinations v
        INNER JOIN public.patients p
          ON p.id = v.patient_id
          AND p.deleted_at IS NULL
          AND p.is_deceased = false
          AND p.is_active = true
        INNER JOIN public.owners o ON o.id = v.owner_id AND o.deleted_at IS NULL
        WHERE v.organization_id = v_org_id
          AND v.deleted_at IS NULL
          AND v.next_due_at IS NOT NULL
          AND (p_branch_id IS NULL OR v.branch_id = p_branch_id)
        ORDER BY v.patient_id, lower(btrim(v.vaccine_name)), v.administered_at DESC, v.created_at DESC
      ) latest
      WHERE latest.next_due_at <= v_horizon
        AND NOT EXISTS (
          SELECT 1
          FROM public.reminder_logs rl
          WHERE rl.organization_id = v_org_id
            AND rl.deleted_at IS NULL
            AND rl.reminder_type = 'vaccination'
            AND rl.related_id = latest.id
        )
      ORDER BY latest.next_due_at ASC, latest.patient_name ASC
      LIMIT 50
    ) r;
  END IF;

  IF public.has_permission('billing:read') THEN
    SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY r.due_at ASC), '[]'::jsonb)
    INTO v_invoices
    FROM (
      SELECT
        inv.id AS related_id,
        'invoice'::text AS reminder_type,
        inv.owner_id,
        o.full_name AS owner_name,
        inv.patient_id,
        p.name AS patient_name,
        o.phone_whatsapp,
        o.phone,
        COALESCE(inv.issued_at, inv.created_at) AS due_at,
        COALESCE(inv.number, 'Factura') AS title,
        NULL::text AS appointment_type,
        NULL::text AS appointment_status,
        NULL::text AS vaccine_name,
        NULL::text AS due_status,
        inv.number AS invoice_number,
        inv.balance,
        inv.currency
      FROM public.invoices inv
      INNER JOIN public.owners o ON o.id = inv.owner_id AND o.deleted_at IS NULL
      LEFT JOIN public.patients p ON p.id = inv.patient_id AND p.deleted_at IS NULL
      WHERE inv.organization_id = v_org_id
        AND inv.deleted_at IS NULL
        AND inv.status = 'emitida'
        AND inv.balance > 0
        AND (p_branch_id IS NULL OR inv.branch_id = p_branch_id)
        AND NOT EXISTS (
          SELECT 1
          FROM public.reminder_logs rl
          WHERE rl.organization_id = v_org_id
            AND rl.deleted_at IS NULL
            AND rl.reminder_type = 'invoice'
            AND rl.related_id = inv.id
        )
      ORDER BY COALESCE(inv.issued_at, inv.created_at) ASC
      LIMIT 50
    ) r;
  END IF;

  RETURN jsonb_build_object(
    'appointments', v_appointments,
    'vaccinations', v_vaccinations,
    'invoices', v_invoices
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_reminder(
  p_reminder_type TEXT,
  p_related_id UUID,
  p_status TEXT,
  p_whatsapp_message_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_type public.reminder_type;
  v_status public.reminder_status;
  v_channel public.reminder_channel;
  v_owner_id UUID;
  v_patient_id UUID;
  v_branch_id UUID;
  v_due_on DATE;
  v_id UUID;
BEGIN
  v_org_id := public.get_user_organization_id();

  IF v_org_id IS NULL OR NOT public.has_permission('whatsapp:send') THEN
    RAISE EXCEPTION 'No tenés permisos para registrar recordatorios';
  END IF;

  IF p_reminder_type NOT IN ('appointment', 'vaccination', 'invoice') THEN
    RAISE EXCEPTION 'Tipo de recordatorio inválido';
  END IF;

  IF p_status NOT IN ('enviado', 'omitido') THEN
    RAISE EXCEPTION 'Estado de recordatorio inválido';
  END IF;

  v_type := p_reminder_type::public.reminder_type;
  v_status := p_status::public.reminder_status;
  v_channel := CASE WHEN p_status = 'enviado' THEN 'whatsapp'::public.reminder_channel ELSE 'omitido'::public.reminder_channel END;

  IF v_type = 'appointment' THEN
    SELECT a.owner_id, a.patient_id, a.branch_id, (timezone('America/Argentina/Buenos_Aires', a.starts_at))::date
    INTO v_owner_id, v_patient_id, v_branch_id, v_due_on
    FROM public.appointments a
    WHERE a.id = p_related_id
      AND a.organization_id = v_org_id
      AND a.deleted_at IS NULL;
  ELSIF v_type = 'vaccination' THEN
    SELECT v.owner_id, v.patient_id, v.branch_id, v.next_due_at
    INTO v_owner_id, v_patient_id, v_branch_id, v_due_on
    FROM public.vaccinations v
    WHERE v.id = p_related_id
      AND v.organization_id = v_org_id
      AND v.deleted_at IS NULL;
  ELSE
    SELECT inv.owner_id, inv.patient_id, inv.branch_id, COALESCE(inv.due_at, (timezone('America/Argentina/Buenos_Aires', COALESCE(inv.issued_at, inv.created_at)))::date)
    INTO v_owner_id, v_patient_id, v_branch_id, v_due_on
    FROM public.invoices inv
    WHERE inv.id = p_related_id
      AND inv.organization_id = v_org_id
      AND inv.deleted_at IS NULL;
  END IF;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Recordatorio no encontrado';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.reminder_logs rl
    WHERE rl.organization_id = v_org_id
      AND rl.deleted_at IS NULL
      AND rl.reminder_type = v_type
      AND rl.related_id = p_related_id
  ) THEN
    RAISE EXCEPTION 'Ya se registró este recordatorio';
  END IF;

  INSERT INTO public.reminder_logs (
    organization_id,
    branch_id,
    reminder_type,
    related_id,
    owner_id,
    patient_id,
    channel,
    status,
    due_on,
    whatsapp_message_id,
    sent_by
  ) VALUES (
    v_org_id,
    v_branch_id,
    v_type,
    p_related_id,
    v_owner_id,
    v_patient_id,
    v_channel,
    v_status,
    v_due_on,
    p_whatsapp_message_id,
    auth.uid()
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.count_pending_reminders TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_clinic_reminders TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_reminder TO authenticated;

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
