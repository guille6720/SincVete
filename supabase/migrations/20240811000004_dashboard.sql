-- SincVete - Módulo 1: Dashboard operativo

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
BEGIN
  v_org_id := public.get_user_organization_id();

  IF v_org_id IS NULL OR NOT public.has_permission('patients:read') THEN
    RETURN '{}'::jsonb;
  END IF;

  v_month_start := date_trunc(
    'month',
    timezone('America/Argentina/Buenos_Aires', now())
  ) AT TIME ZONE 'America/Argentina/Buenos_Aires';

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

GRANT EXECUTE ON FUNCTION public.get_dashboard_summary TO authenticated;

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
      ELSE
        al.action || ' en ' || al.entity_type
    END AS summary,
    al.created_at
  FROM public.audit_logs al
  LEFT JOIN public.profiles pr ON pr.id = al.user_id
  WHERE al.organization_id = v_org_id
    AND al.entity_type IN ('patients', 'owners')
  ORDER BY al.created_at DESC
  LIMIT LEAST(GREATEST(p_limit, 1), 50);
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_dashboard_activity TO authenticated;
