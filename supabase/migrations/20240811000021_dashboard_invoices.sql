-- SincVete - Dashboard: facturas abiertas

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
    CASE
      WHEN al.entity_type = 'patients' AND al.action = 'INSERT' THEN
        'Paciente registrado: ' || COALESCE(al.new_data->>'name', '—')
      WHEN al.entity_type = 'patients' AND al.action = 'UPDATE' AND al.new_data->>'deleted_at' IS NOT NULL THEN
        'Paciente eliminado: ' || COALESCE(al.old_data->>'name', al.new_data->>'name', '—')
      WHEN al.entity_type = 'patients' AND al.action = 'UPDATE' THEN
        'Paciente actualizado: ' || COALESCE(al.new_data->>'name', al.old_data->>'name', '—')
      WHEN al.entity_type = 'owners' AND al.action = 'INSERT' THEN
        'Propietario registrado: ' || COALESCE(al.new_data->>'full_name', '—')
      WHEN al.entity_type = 'owners' AND al.action = 'UPDATE' AND al.new_data->>'deleted_at' IS NOT NULL THEN
        'Propietario eliminado: ' || COALESCE(al.old_data->>'full_name', al.new_data->>'full_name', '—')
      WHEN al.entity_type = 'owners' AND al.action = 'UPDATE' THEN
        'Propietario actualizado: ' || COALESCE(al.new_data->>'full_name', al.old_data->>'full_name', '—')
      WHEN al.entity_type = 'appointments' AND al.action = 'INSERT' THEN
        'Cita programada: ' || COALESCE(al.new_data->>'title', 'Consulta')
      WHEN al.entity_type = 'appointments' AND al.action = 'UPDATE' AND al.new_data->>'deleted_at' IS NOT NULL THEN
        'Cita eliminada'
      WHEN al.entity_type = 'appointments' AND al.action = 'UPDATE' THEN
        'Cita actualizada: ' || COALESCE(al.new_data->>'title', al.old_data->>'title', 'Consulta')
      WHEN al.entity_type = 'consultations' AND al.action = 'INSERT' THEN
        'Consulta iniciada'
      WHEN al.entity_type = 'consultations' AND al.action = 'UPDATE' AND al.new_data->>'status' = 'completada' THEN
        'Consulta completada: ' || COALESCE(al.new_data->>'title', 'Atención')
      WHEN al.entity_type = 'consultations' AND al.action = 'UPDATE' THEN
        'Consulta actualizada'
      WHEN al.entity_type = 'hospitalizations' AND al.action = 'INSERT' THEN
        'Internación iniciada'
      WHEN al.entity_type = 'hospitalizations' AND al.action = 'UPDATE' AND al.new_data->>'status' = 'alta' THEN
        'Alta de internación'
      WHEN al.entity_type = 'hospitalizations' AND al.action = 'UPDATE' AND al.new_data->>'status' = 'fallecido' THEN
        'Internación — fallecimiento'
      WHEN al.entity_type = 'hospitalizations' AND al.action = 'UPDATE' THEN
        'Internación actualizada'
      WHEN al.entity_type = 'vaccinations' AND al.action = 'INSERT' THEN
        'Vacuna aplicada: ' || COALESCE(al.new_data->>'vaccine_name', '—')
      WHEN al.entity_type = 'vaccinations' AND al.action = 'UPDATE' THEN
        'Vacunación actualizada'
      WHEN al.entity_type = 'surgeries' AND al.action = 'INSERT' THEN
        'Cirugía programada: ' || COALESCE(al.new_data->>'procedure_name', '—')
      WHEN al.entity_type = 'surgeries' AND al.action = 'UPDATE' AND al.new_data->>'status' = 'completada' THEN
        'Cirugía completada: ' || COALESCE(al.new_data->>'procedure_name', '—')
      WHEN al.entity_type = 'surgeries' AND al.action = 'UPDATE' THEN
        'Cirugía actualizada'
      WHEN al.entity_type = 'lab_orders' AND al.action = 'INSERT' THEN
        'Lab solicitado: ' || COALESCE(al.new_data->>'title', '—')
      WHEN al.entity_type = 'lab_orders' AND al.action = 'UPDATE' AND al.new_data->>'status' = 'completada' THEN
        'Lab completado: ' || COALESCE(al.new_data->>'title', '—')
      WHEN al.entity_type = 'lab_orders' AND al.action = 'UPDATE' THEN
        'Lab actualizado'
      WHEN al.entity_type = 'inventory_products' AND al.action = 'INSERT' THEN
        'Producto de inventario: ' || COALESCE(al.new_data->>'name', '—')
      WHEN al.entity_type = 'inventory_products' AND al.action = 'UPDATE' AND al.new_data->>'deleted_at' IS NOT NULL THEN
        'Producto eliminado: ' || COALESCE(al.old_data->>'name', al.new_data->>'name', '—')
      WHEN al.entity_type = 'inventory_products' AND al.action = 'UPDATE' THEN
        'Producto actualizado: ' || COALESCE(al.new_data->>'name', al.old_data->>'name', '—')
      WHEN al.entity_type = 'inventory_movements' AND al.action = 'INSERT' THEN
        'Movimiento de stock: ' || COALESCE(al.new_data->>'movement_type', '—')
      WHEN al.entity_type = 'invoices' AND al.action = 'INSERT' THEN
        'Factura creada'
      WHEN al.entity_type = 'invoices' AND al.action = 'UPDATE' AND al.new_data->>'status' = 'emitida' THEN
        'Factura emitida: ' || COALESCE(al.new_data->>'number', '—')
      WHEN al.entity_type = 'invoices' AND al.action = 'UPDATE' AND al.new_data->>'status' = 'pagada' THEN
        'Factura cobrada: ' || COALESCE(al.new_data->>'number', '—')
      WHEN al.entity_type = 'invoices' AND al.action = 'UPDATE' AND al.new_data->>'status' = 'anulada' THEN
        'Factura anulada: ' || COALESCE(al.new_data->>'number', al.old_data->>'number', '—')
      WHEN al.entity_type = 'invoices' AND al.action = 'UPDATE' THEN
        'Factura actualizada'
      WHEN al.entity_type = 'payments' AND al.action = 'INSERT' THEN
        'Pago registrado'
      ELSE
        al.action || ' en ' || al.entity_type
    END AS summary,
    al.created_at
  FROM public.audit_logs al
  LEFT JOIN public.profiles pr ON pr.id = al.user_id
  WHERE al.organization_id = v_org_id
    AND al.entity_type IN (
      'patients',
      'owners',
      'appointments',
      'consultations',
      'hospitalizations',
      'vaccinations',
      'surgeries',
      'lab_orders',
      'inventory_products',
      'inventory_movements',
      'invoices',
      'payments'
    )
  ORDER BY al.created_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 50);
END;
$$;
