-- SincVete - Módulo 13: Reportes

CREATE OR REPLACE FUNCTION public.get_clinic_report(
  p_from DATE,
  p_to DATE,
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
  v_from TIMESTAMPTZ;
  v_to TIMESTAMPTZ;
  v_operations JSONB := NULL;
  v_billing JSONB := NULL;
  v_inventory JSONB := NULL;
  v_daily JSONB := '[]'::jsonb;
BEGIN
  v_org_id := public.get_user_organization_id();

  IF v_org_id IS NULL OR NOT public.has_permission('reports:read') THEN
    RETURN '{}'::jsonb;
  END IF;

  IF p_from IS NULL OR p_to IS NULL OR p_from > p_to THEN
    RAISE EXCEPTION 'Rango de fechas inválido';
  END IF;

  IF (p_to - p_from) > 92 THEN
    RAISE EXCEPTION 'El rango no puede superar 92 días';
  END IF;

  v_from := (p_from::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires');
  v_to := ((p_to + 1)::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires');

  IF public.has_permission('patients:read')
     OR public.has_permission('appointments:read')
     OR public.has_permission('clinical:read') THEN
    v_operations := jsonb_build_object(
      'new_patients',
        CASE WHEN public.has_permission('patients:read') THEN (
          SELECT COUNT(*)
          FROM public.patients p
          WHERE p.organization_id = v_org_id
            AND p.deleted_at IS NULL
            AND p.created_at >= v_from AND p.created_at < v_to
            AND (p_branch_id IS NULL OR p.branch_id = p_branch_id)
        ) ELSE 0 END,
      'new_owners',
        CASE WHEN public.has_permission('patients:read') THEN (
          SELECT COUNT(*)
          FROM public.owners o
          WHERE o.organization_id = v_org_id
            AND o.deleted_at IS NULL
            AND o.created_at >= v_from AND o.created_at < v_to
            AND (p_branch_id IS NULL OR o.branch_id = p_branch_id)
        ) ELSE 0 END,
      'appointments_total',
        CASE WHEN public.has_permission('appointments:read') THEN (
          SELECT COUNT(*)
          FROM public.appointments a
          WHERE a.organization_id = v_org_id
            AND a.deleted_at IS NULL
            AND a.starts_at >= v_from AND a.starts_at < v_to
            AND (p_branch_id IS NULL OR a.branch_id = p_branch_id)
        ) ELSE 0 END,
      'appointments_completed',
        CASE WHEN public.has_permission('appointments:read') THEN (
          SELECT COUNT(*)
          FROM public.appointments a
          WHERE a.organization_id = v_org_id
            AND a.deleted_at IS NULL
            AND a.status = 'completada'
            AND a.starts_at >= v_from AND a.starts_at < v_to
            AND (p_branch_id IS NULL OR a.branch_id = p_branch_id)
        ) ELSE 0 END,
      'appointments_cancelled',
        CASE WHEN public.has_permission('appointments:read') THEN (
          SELECT COUNT(*)
          FROM public.appointments a
          WHERE a.organization_id = v_org_id
            AND a.deleted_at IS NULL
            AND a.status IN ('cancelada', 'ausente')
            AND a.starts_at >= v_from AND a.starts_at < v_to
            AND (p_branch_id IS NULL OR a.branch_id = p_branch_id)
        ) ELSE 0 END,
      'consultations_completed',
        CASE WHEN public.has_permission('clinical:read') THEN (
          SELECT COUNT(*)
          FROM public.consultations c
          WHERE c.organization_id = v_org_id
            AND c.deleted_at IS NULL
            AND c.status = 'completada'
            AND c.completed_at >= v_from AND c.completed_at < v_to
            AND (p_branch_id IS NULL OR c.branch_id = p_branch_id)
        ) ELSE 0 END,
      'hospitalizations_admitted',
        CASE WHEN public.has_permission('clinical:read') THEN (
          SELECT COUNT(*)
          FROM public.hospitalizations h
          WHERE h.organization_id = v_org_id
            AND h.deleted_at IS NULL
            AND h.admitted_at >= v_from AND h.admitted_at < v_to
            AND (p_branch_id IS NULL OR h.branch_id = p_branch_id)
        ) ELSE 0 END,
      'vaccinations_recorded',
        CASE WHEN public.has_permission('clinical:read') THEN (
          SELECT COUNT(*)
          FROM public.vaccinations v
          WHERE v.organization_id = v_org_id
            AND v.deleted_at IS NULL
            AND v.administered_at >= p_from AND v.administered_at <= p_to
            AND (p_branch_id IS NULL OR v.branch_id = p_branch_id)
        ) ELSE 0 END,
      'surgeries_completed',
        CASE WHEN public.has_permission('clinical:read') THEN (
          SELECT COUNT(*)
          FROM public.surgeries s
          WHERE s.organization_id = v_org_id
            AND s.deleted_at IS NULL
            AND s.status = 'completada'
            AND s.completed_at >= v_from AND s.completed_at < v_to
            AND (p_branch_id IS NULL OR s.branch_id = p_branch_id)
        ) ELSE 0 END,
      'lab_orders_completed',
        CASE WHEN public.has_permission('clinical:read') THEN (
          SELECT COUNT(*)
          FROM public.lab_orders l
          WHERE l.organization_id = v_org_id
            AND l.deleted_at IS NULL
            AND l.status = 'completada'
            AND l.completed_at >= v_from AND l.completed_at < v_to
            AND (p_branch_id IS NULL OR l.branch_id = p_branch_id)
        ) ELSE 0 END,
      'appointments_by_status',
        CASE WHEN public.has_permission('appointments:read') THEN COALESCE((
          SELECT jsonb_agg(jsonb_build_object('status', s.status, 'count', s.cnt) ORDER BY s.cnt DESC)
          FROM (
            SELECT a.status::TEXT AS status, COUNT(*) AS cnt
            FROM public.appointments a
            WHERE a.organization_id = v_org_id
              AND a.deleted_at IS NULL
              AND a.starts_at >= v_from AND a.starts_at < v_to
              AND (p_branch_id IS NULL OR a.branch_id = p_branch_id)
            GROUP BY a.status
          ) s
        ), '[]'::jsonb) ELSE '[]'::jsonb END,
      'consultations_by_species',
        CASE WHEN public.has_permission('clinical:read') THEN COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object('species', s.species, 'count', s.cnt)
            ORDER BY s.cnt DESC, s.species ASC
          )
          FROM (
            SELECT p.species::TEXT AS species, COUNT(*) AS cnt
            FROM public.consultations c
            INNER JOIN public.patients p ON p.id = c.patient_id
            WHERE c.organization_id = v_org_id
              AND c.deleted_at IS NULL
              AND c.status = 'completada'
              AND c.completed_at >= v_from AND c.completed_at < v_to
              AND (p_branch_id IS NULL OR c.branch_id = p_branch_id)
            GROUP BY p.species
          ) s
        ), '[]'::jsonb) ELSE '[]'::jsonb END
    );
  END IF;

  IF public.has_permission('billing:read') THEN
    v_billing := jsonb_build_object(
      'invoices_issued_count',
        (
          SELECT COUNT(*)
          FROM public.invoices i
          WHERE i.organization_id = v_org_id
            AND i.deleted_at IS NULL
            AND i.status IN ('emitida', 'pagada')
            AND i.issued_at >= v_from AND i.issued_at < v_to
            AND (p_branch_id IS NULL OR i.branch_id = p_branch_id)
        ),
      'invoices_issued_total',
        (
          SELECT COALESCE(SUM(i.total), 0)
          FROM public.invoices i
          WHERE i.organization_id = v_org_id
            AND i.deleted_at IS NULL
            AND i.status IN ('emitida', 'pagada')
            AND i.issued_at >= v_from AND i.issued_at < v_to
            AND (p_branch_id IS NULL OR i.branch_id = p_branch_id)
        ),
      'invoices_voided_count',
        (
          SELECT COUNT(*)
          FROM public.invoices i
          WHERE i.organization_id = v_org_id
            AND i.deleted_at IS NULL
            AND i.status = 'anulada'
            AND i.voided_at >= v_from AND i.voided_at < v_to
            AND (p_branch_id IS NULL OR i.branch_id = p_branch_id)
        ),
      'payments_count',
        (
          SELECT COUNT(*)
          FROM public.payments py
          INNER JOIN public.invoices i ON i.id = py.invoice_id
          WHERE py.organization_id = v_org_id
            AND py.deleted_at IS NULL
            AND py.paid_at >= v_from AND py.paid_at < v_to
            AND (p_branch_id IS NULL OR i.branch_id = p_branch_id)
        ),
      'payments_total',
        (
          SELECT COALESCE(SUM(py.amount), 0)
          FROM public.payments py
          INNER JOIN public.invoices i ON i.id = py.invoice_id
          WHERE py.organization_id = v_org_id
            AND py.deleted_at IS NULL
            AND py.paid_at >= v_from AND py.paid_at < v_to
            AND (p_branch_id IS NULL OR i.branch_id = p_branch_id)
        ),
      'open_balance',
        (
          SELECT COALESCE(SUM(i.balance), 0)
          FROM public.invoices i
          WHERE i.organization_id = v_org_id
            AND i.deleted_at IS NULL
            AND i.status = 'emitida'
            AND i.balance > 0
            AND (p_branch_id IS NULL OR i.branch_id = p_branch_id)
        ),
      'payments_by_method',
        COALESCE((
          SELECT jsonb_agg(
            jsonb_build_object('method', s.method, 'count', s.cnt, 'amount', s.amount)
            ORDER BY s.amount DESC
          )
          FROM (
            SELECT
              py.method::TEXT AS method,
              COUNT(*) AS cnt,
              COALESCE(SUM(py.amount), 0) AS amount
            FROM public.payments py
            INNER JOIN public.invoices i ON i.id = py.invoice_id
            WHERE py.organization_id = v_org_id
              AND py.deleted_at IS NULL
              AND py.paid_at >= v_from AND py.paid_at < v_to
              AND (p_branch_id IS NULL OR i.branch_id = p_branch_id)
            GROUP BY py.method
          ) s
        ), '[]'::jsonb)
    );
  END IF;

  IF public.has_permission('inventory:read') THEN
    v_inventory := jsonb_build_object(
      'low_stock_count',
        (
          SELECT COUNT(*)
          FROM public.inventory_products ip
          WHERE ip.organization_id = v_org_id
            AND ip.deleted_at IS NULL
            AND ip.is_active = true
            AND ip.quantity <= ip.min_quantity
            AND (p_branch_id IS NULL OR ip.branch_id = p_branch_id)
        ),
      'movements_entrada',
        (
          SELECT COUNT(*)
          FROM public.inventory_movements m
          WHERE m.organization_id = v_org_id
            AND m.deleted_at IS NULL
            AND m.movement_type = 'entrada'
            AND m.created_at >= v_from AND m.created_at < v_to
            AND (p_branch_id IS NULL OR m.branch_id = p_branch_id)
        ),
      'movements_salida',
        (
          SELECT COUNT(*)
          FROM public.inventory_movements m
          WHERE m.organization_id = v_org_id
            AND m.deleted_at IS NULL
            AND m.movement_type = 'salida'
            AND m.created_at >= v_from AND m.created_at < v_to
            AND (p_branch_id IS NULL OR m.branch_id = p_branch_id)
        ),
      'movements_ajuste',
        (
          SELECT COUNT(*)
          FROM public.inventory_movements m
          WHERE m.organization_id = v_org_id
            AND m.deleted_at IS NULL
            AND m.movement_type = 'ajuste'
            AND m.created_at >= v_from AND m.created_at < v_to
            AND (p_branch_id IS NULL OR m.branch_id = p_branch_id)
        ),
      'movements_descarte',
        (
          SELECT COUNT(*)
          FROM public.inventory_movements m
          WHERE m.organization_id = v_org_id
            AND m.deleted_at IS NULL
            AND m.movement_type = 'descarte'
            AND m.created_at >= v_from AND m.created_at < v_to
            AND (p_branch_id IS NULL OR m.branch_id = p_branch_id)
        )
    );
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(d) ORDER BY d.day), '[]'::jsonb)
  INTO v_daily
  FROM (
    SELECT
      gs::date AS day,
      CASE WHEN public.has_permission('appointments:read') THEN (
        SELECT COUNT(*)
        FROM public.appointments a
        WHERE a.organization_id = v_org_id
          AND a.deleted_at IS NULL
          AND a.starts_at >= (gs::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires')
          AND a.starts_at < ((gs + 1)::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires')
          AND (p_branch_id IS NULL OR a.branch_id = p_branch_id)
      ) ELSE 0 END AS appointments,
      CASE WHEN public.has_permission('clinical:read') THEN (
        SELECT COUNT(*)
        FROM public.consultations c
        WHERE c.organization_id = v_org_id
          AND c.deleted_at IS NULL
          AND c.status = 'completada'
          AND c.completed_at >= (gs::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires')
          AND c.completed_at < ((gs + 1)::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires')
          AND (p_branch_id IS NULL OR c.branch_id = p_branch_id)
      ) ELSE 0 END AS consultations,
      CASE WHEN public.has_permission('billing:read') THEN (
        SELECT COALESCE(SUM(py.amount), 0)
        FROM public.payments py
        INNER JOIN public.invoices i ON i.id = py.invoice_id
        WHERE py.organization_id = v_org_id
          AND py.deleted_at IS NULL
          AND py.paid_at >= (gs::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires')
          AND py.paid_at < ((gs + 1)::timestamp AT TIME ZONE 'America/Argentina/Buenos_Aires')
          AND (p_branch_id IS NULL OR i.branch_id = p_branch_id)
      ) ELSE 0 END AS payments_total
    FROM generate_series(p_from, p_to, interval '1 day') AS gs
  ) d;

  RETURN jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'operations', v_operations,
    'billing', v_billing,
    'inventory', v_inventory,
    'daily', v_daily
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_clinic_report TO authenticated;
