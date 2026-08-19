-- Phase 22: Superadmin can see which clinics are ending soon or over seat limits.
-- Phase 21 listed stuck checkouts and unapplied webhooks; the other commercial
-- counts stayed numbers-only. Reminder days are lead time, not plan duration.

CREATE OR REPLACE FUNCTION public.superadmin_list_plans_ending_soon(
  p_remind_days INT DEFAULT 3,
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  organization_id UUID,
  organization_name TEXT,
  organization_slug TEXT,
  plan_key TEXT,
  plan_name TEXT,
  status TEXT,
  ends_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_remind INTERVAL;
  v_limit INT;
BEGIN
  PERFORM public.require_platform_admin();
  v_remind := make_interval(days => GREATEST(COALESCE(p_remind_days, 3), 1));
  v_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);

  RETURN QUERY
  SELECT
    o.id,
    o.name,
    o.slug,
    p.key,
    p.name,
    s.status::TEXT,
    s.ends_at
  FROM public.organizations o
  JOIN LATERAL (
    SELECT s2.plan_id, s2.status, s2.ends_at
    FROM public.organization_subscriptions s2
    WHERE s2.organization_id = o.id
      AND s2.status IN ('active', 'past_due')
      AND s2.cancelled_at IS NULL
    ORDER BY s2.created_at DESC
    LIMIT 1
  ) s ON true
  JOIN public.plans p ON p.id = s.plan_id
  WHERE o.deleted_at IS NULL
    AND p.key NOT IN ('legacy', 'trial')
    AND s.ends_at IS NOT NULL
    AND s.ends_at > timezone('utc', now())
    AND s.ends_at <= timezone('utc', now()) + v_remind
  ORDER BY s.ends_at ASC
  LIMIT v_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.superadmin_list_addons_ending_soon(
  p_remind_days INT DEFAULT 3,
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  organization_id UUID,
  organization_name TEXT,
  organization_slug TEXT,
  addon_key TEXT,
  addon_name TEXT,
  ends_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_remind INTERVAL;
  v_limit INT;
BEGIN
  PERFORM public.require_platform_admin();
  v_remind := make_interval(days => GREATEST(COALESCE(p_remind_days, 3), 1));
  v_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);

  RETURN QUERY
  SELECT
    o.id,
    o.name,
    o.slug,
    a.key,
    a.name,
    g.ends_at
  FROM public.organization_addons g
  JOIN public.addons a ON a.id = g.addon_id
  JOIN public.organizations o ON o.id = g.organization_id
  WHERE o.deleted_at IS NULL
    AND g.status = 'active'
    AND g.cancelled_at IS NULL
    AND g.ends_at IS NOT NULL
    AND g.ends_at > timezone('utc', now())
    AND g.ends_at <= timezone('utc', now()) + v_remind
  ORDER BY g.ends_at ASC
  LIMIT v_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.superadmin_list_orgs_over_seats(
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  organization_id UUID,
  organization_name TEXT,
  organization_slug TEXT,
  plan_key TEXT,
  plan_name TEXT,
  feature_key TEXT,
  used BIGINT,
  limit_value NUMERIC
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limit INT;
BEGIN
  PERFORM public.require_platform_admin();
  v_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);

  RETURN QUERY
  SELECT
    o.id,
    o.name,
    o.slug,
    cs.plan_key,
    cs.plan_name,
    overage.feature_key,
    overage.used,
    overage.limit_value
  FROM public.organizations o
  JOIN LATERAL (
    SELECT s.plan_id, p.key AS plan_key, p.name AS plan_name
    FROM public.organization_subscriptions s
    JOIN public.plans p ON p.id = s.plan_id
    WHERE s.organization_id = o.id
      AND s.status IN ('trialing', 'active', 'past_due')
      AND s.cancelled_at IS NULL
    ORDER BY s.created_at DESC
    LIMIT 1
  ) cs ON true
  JOIN LATERAL (
    SELECT
      u.feature_key,
      u.used,
      (
        CASE
          WHEN ovr.enabled IS TRUE THEN ovr.limit_value
          WHEN pf.enabled IS TRUE THEN pf.limit_value
          ELSE f.default_limit
        END
      ) AS limit_value
    FROM public.organization_seat_usage(o.id) u
    JOIN public.features f
      ON f.key = u.feature_key
     AND f.is_active = true
     AND f.feature_type = 'limit'
    LEFT JOIN public.plan_features pf
      ON pf.plan_id = cs.plan_id
     AND pf.feature_id = f.id
    LEFT JOIN LATERAL (
      SELECT ov.limit_value, ov.enabled
      FROM public.organization_feature_overrides ov
      WHERE ov.organization_id = o.id
        AND ov.feature_id = f.id
        AND (ov.starts_at IS NULL OR ov.starts_at <= timezone('utc', now()))
        AND (ov.ends_at IS NULL OR ov.ends_at > timezone('utc', now()))
      ORDER BY ov.created_at DESC
      LIMIT 1
    ) ovr ON true
    WHERE (ovr.enabled IS NULL OR ovr.enabled IS TRUE)
      AND (
        CASE
          WHEN ovr.enabled IS TRUE THEN ovr.limit_value
          WHEN pf.enabled IS TRUE THEN pf.limit_value
          ELSE f.default_limit
        END
      ) IS NOT NULL
      AND (
        CASE
          WHEN ovr.enabled IS TRUE THEN ovr.limit_value
          WHEN pf.enabled IS TRUE THEN pf.limit_value
          ELSE f.default_limit
        END
      ) > 0
      AND u.used > (
        CASE
          WHEN ovr.enabled IS TRUE THEN ovr.limit_value
          WHEN pf.enabled IS TRUE THEN pf.limit_value
          ELSE f.default_limit
        END
      )
  ) overage ON true
  WHERE o.deleted_at IS NULL
    AND cs.plan_key IS DISTINCT FROM 'legacy'
  ORDER BY o.name ASC, overage.feature_key ASC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.superadmin_list_plans_ending_soon(INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.superadmin_list_addons_ending_soon(INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.superadmin_list_orgs_over_seats(INT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.superadmin_list_plans_ending_soon(INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.superadmin_list_addons_ending_soon(INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.superadmin_list_orgs_over_seats(INT) TO authenticated;

COMMENT ON FUNCTION public.superadmin_list_plans_ending_soon(INT, INT) IS
  'Platform-admin queue of public paid plans in the reminder window. Days are lead time, not duration.';
COMMENT ON FUNCTION public.superadmin_list_addons_ending_soon(INT, INT) IS
  'Platform-admin queue of active extras in the reminder window. Days are lead time, not duration.';
COMMENT ON FUNCTION public.superadmin_list_orgs_over_seats(INT) IS
  'Platform-admin queue of clinics whose occupancy exceeds a finite seat limit. Legacy is ignored.';
