-- Phase 13: seat usage on the Plan page and downgrade guards.
-- Seat counts are current occupancy, not monthly meters. Open-ended/unlimited limits stay NULL.

CREATE OR REPLACE FUNCTION public.list_own_seat_usage()
RETURNS TABLE (
  feature_key TEXT,
  used BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org UUID;
BEGIN
  v_org := public.get_user_organization_id();
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT 'users.max'::TEXT, (
    (
      SELECT COUNT(*)::BIGINT
      FROM public.profiles p
      WHERE p.organization_id = v_org
        AND p.deleted_at IS NULL
        AND p.is_active = true
    ) + (
      SELECT COUNT(*)::BIGINT
      FROM public.organization_invitations i
      WHERE i.organization_id = v_org
        AND i.status = 'pending'
        AND i.deleted_at IS NULL
    )
  )
  UNION ALL
  SELECT 'branches.max'::TEXT, (
    SELECT COUNT(*)::BIGINT
    FROM public.branches b
    WHERE b.organization_id = v_org
      AND b.deleted_at IS NULL
  )
  UNION ALL
  SELECT 'professionals.max'::TEXT, (
    (
      SELECT COUNT(DISTINCT bm.user_id)::BIGINT
      FROM public.branch_members bm
      WHERE bm.organization_id = v_org
        AND bm.role = 'veterinarian'
        AND bm.is_active = true
        AND bm.deleted_at IS NULL
    ) + (
      SELECT COUNT(*)::BIGINT
      FROM public.organization_invitations i
      WHERE i.organization_id = v_org
        AND i.status = 'pending'
        AND i.deleted_at IS NULL
        AND i.role = 'veterinarian'
    )
  )
  UNION ALL
  SELECT 'patients.max'::TEXT, (
    SELECT COUNT(*)::BIGINT
    FROM public.patients pt
    WHERE pt.organization_id = v_org
      AND pt.deleted_at IS NULL
      AND pt.is_active = true
      AND pt.is_deceased = false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.list_public_plan_limits(p_plan_key TEXT)
RETURNS TABLE (
  feature_key TEXT,
  enabled BOOLEAN,
  limit_value NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_plan_key IS NULL OR p_plan_key NOT IN ('basic', 'pro', 'premium', 'enterprise') THEN
    RAISE EXCEPTION 'plan is not publicly purchasable';
  END IF;

  RETURN QUERY
  SELECT f.key, pf.enabled, pf.limit_value
  FROM public.plans p
  JOIN public.plan_features pf ON pf.plan_id = p.id
  JOIN public.features f ON f.id = pf.feature_id
  WHERE p.key = p_plan_key
    AND p.is_active = true
    AND p.is_public = true
    AND p.is_internal = false
    AND f.is_active = true
    AND f.feature_type = 'limit'
    AND f.key IN ('users.max', 'branches.max', 'professionals.max', 'patients.max');
END;
$$;

REVOKE ALL ON FUNCTION public.list_own_seat_usage() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_public_plan_limits(TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.list_own_seat_usage() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_public_plan_limits(TEXT) TO authenticated;

COMMENT ON FUNCTION public.list_own_seat_usage() IS
  'Clinic occupancy for seat limits: users, branches, veterinarians, active patients.';
COMMENT ON FUNCTION public.list_public_plan_limits(TEXT) IS
  'Seat limits of a public commercial plan. Used to block downgrades that would exceed the target plan.';
