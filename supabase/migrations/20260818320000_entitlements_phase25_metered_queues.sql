-- Phase 25: Superadmin over-quota queue includes current-month meters.
-- Phase 24 showed IA / WhatsApp / storage in the clinic banner; the operator
-- list was still occupancy-only. Legacy is ignored. Add-on limits count.

CREATE OR REPLACE FUNCTION public.organization_metered_overages(p_organization_id UUID)
RETURNS TABLE (
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
  v_plan_id UUID;
  v_period_start DATE;
BEGIN
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization required';
  END IF;

  SELECT s.plan_id
  INTO v_plan_id
  FROM public.organization_subscriptions s
  WHERE s.organization_id = p_organization_id
    AND s.status IN ('trialing', 'active', 'past_due')
    AND s.cancelled_at IS NULL
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF v_plan_id IS NULL THEN
    RETURN;
  END IF;

  v_period_start := date_trunc('month', timezone('utc', now()))::date;

  RETURN QUERY
  SELECT
    q.feature_key,
    q.used,
    q.limit_value
  FROM (
    SELECT
      f.key AS feature_key,
      fu.usage_count AS used,
      CASE
        WHEN ovr.enabled IS TRUE THEN ovr.limit_value
        WHEN COALESCE(pf.enabled, false) OR COALESCE(ad.enabled, false) THEN
          CASE
            WHEN (COALESCE(pf.enabled, false) AND pf.limit_value IS NULL)
              OR (COALESCE(ad.enabled, false) AND ad.limit_value IS NULL)
            THEN NULL
            ELSE GREATEST(
              CASE WHEN COALESCE(pf.enabled, false) THEN COALESCE(pf.limit_value, 0) ELSE 0 END,
              CASE WHEN COALESCE(ad.enabled, false) THEN COALESCE(ad.limit_value, 0) ELSE 0 END
            )
          END
        ELSE f.default_limit
      END AS limit_value
    FROM public.features f
    JOIN public.feature_usage fu
      ON fu.feature_id = f.id
     AND fu.organization_id = p_organization_id
     AND fu.period_start = v_period_start
    LEFT JOIN public.plan_features pf
      ON pf.plan_id = v_plan_id
     AND pf.feature_id = f.id
    LEFT JOIN LATERAL (
      SELECT ov.limit_value, ov.enabled
      FROM public.organization_feature_overrides ov
      WHERE ov.organization_id = p_organization_id
        AND ov.feature_id = f.id
        AND (ov.starts_at IS NULL OR ov.starts_at <= timezone('utc', now()))
        AND (ov.ends_at IS NULL OR ov.ends_at > timezone('utc', now()))
      ORDER BY ov.created_at DESC
      LIMIT 1
    ) ovr ON true
    LEFT JOIN LATERAL (
      SELECT
        bool_or(af.enabled) AS enabled,
        CASE
          WHEN bool_or(af.enabled AND af.limit_value IS NULL) THEN NULL
          ELSE MAX(af.limit_value) FILTER (WHERE af.enabled)
        END AS limit_value
      FROM public.organization_addons g
      JOIN public.addons a ON a.id = g.addon_id AND a.is_active = true
      JOIN public.addon_features af ON af.addon_id = g.addon_id AND af.feature_id = f.id
      WHERE g.organization_id = p_organization_id
        AND g.status = 'active'
        AND g.cancelled_at IS NULL
        AND (g.starts_at IS NULL OR g.starts_at <= timezone('utc', now()))
        AND (g.ends_at IS NULL OR g.ends_at > timezone('utc', now()))
    ) ad ON true
    WHERE f.usage_metered = true
      AND f.is_active = true
      AND f.feature_type = 'limit'
      AND (ovr.enabled IS NULL OR ovr.enabled IS TRUE)
  ) q
  WHERE q.limit_value IS NOT NULL
    AND q.limit_value > 0
    AND q.used > q.limit_value;
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
    q.organization_id,
    q.organization_name,
    q.organization_slug,
    q.plan_key,
    q.plan_name,
    q.feature_key,
    q.used,
    q.limit_value
  FROM (
    SELECT
      o.id AS organization_id,
      o.name AS organization_name,
      o.slug AS organization_slug,
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

    UNION ALL

    SELECT
      o.id,
      o.name,
      o.slug,
      cs.plan_key,
      cs.plan_name,
      m.feature_key,
      m.used,
      m.limit_value
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
    JOIN public.organization_metered_overages(o.id) m ON true
    WHERE o.deleted_at IS NULL
      AND cs.plan_key IS DISTINCT FROM 'legacy'
  ) q
  ORDER BY q.organization_name ASC, q.feature_key ASC
  LIMIT v_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.superadmin_commercial_summary(
  p_remind_days INT DEFAULT 3
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_remind INTERVAL;
BEGIN
  PERFORM public.require_platform_admin();
  PERFORM public.expire_due_subscriptions(NULL);
  v_remind := make_interval(days => GREATEST(COALESCE(p_remind_days, 3), 1));

  RETURN (
    SELECT jsonb_build_object(
      'organizations', COUNT(*) FILTER (WHERE o.deleted_at IS NULL),
      'trialing', COUNT(*) FILTER (WHERE ls.status = 'trialing'),
      'active', COUNT(*) FILTER (WHERE ls.status = 'active'),
      'past_due', COUNT(*) FILTER (WHERE ls.status = 'past_due'),
      'expired', COUNT(*) FILTER (WHERE ls.status = 'expired'),
      'cancelled', COUNT(*) FILTER (WHERE ls.status = 'cancelled'),
      'plans_ending_soon', COUNT(*) FILTER (
        WHERE ls.status IN ('active', 'past_due')
          AND ls.plan_key NOT IN ('legacy', 'trial')
          AND ls.ends_at IS NOT NULL
          AND ls.ends_at > timezone('utc', now())
          AND ls.ends_at <= timezone('utc', now()) + v_remind
      ),
      'addons_active', (
        SELECT COUNT(*)
        FROM public.organization_addons g
        WHERE g.status = 'active'
          AND g.cancelled_at IS NULL
          AND (g.starts_at IS NULL OR g.starts_at <= timezone('utc', now()))
          AND (g.ends_at IS NULL OR g.ends_at > timezone('utc', now()))
      ),
      'addons_ending_soon', (
        SELECT COUNT(*)
        FROM public.organization_addons g
        WHERE g.status = 'active'
          AND g.cancelled_at IS NULL
          AND g.ends_at IS NOT NULL
          AND g.ends_at > timezone('utc', now())
          AND g.ends_at <= timezone('utc', now()) + v_remind
      ),
      'orgs_over_seats', (
        SELECT COUNT(*)::INT
        FROM public.organizations o2
        JOIN LATERAL (
          SELECT s.plan_id, p.key AS plan_key
          FROM public.organization_subscriptions s
          JOIN public.plans p ON p.id = s.plan_id
          WHERE s.organization_id = o2.id
            AND s.status IN ('trialing', 'active', 'past_due')
            AND s.cancelled_at IS NULL
          ORDER BY s.created_at DESC
          LIMIT 1
        ) cs ON true
        WHERE o2.deleted_at IS NULL
          AND cs.plan_key IS DISTINCT FROM 'legacy'
          AND (
            EXISTS (
              SELECT 1
              FROM public.organization_seat_usage(o2.id) u
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
                WHERE ov.organization_id = o2.id
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
            )
            OR EXISTS (
              SELECT 1
              FROM public.organization_metered_overages(o2.id)
            )
          )
      )
    )
    FROM public.organizations o
    LEFT JOIN LATERAL (
      SELECT s.status, s.ends_at, p.key AS plan_key
      FROM public.organization_subscriptions s
      JOIN public.plans p ON p.id = s.plan_id
      WHERE s.organization_id = o.id
      ORDER BY s.created_at DESC
      LIMIT 1
    ) ls ON true
    WHERE o.deleted_at IS NULL
  );
END;
$$;

REVOKE ALL ON FUNCTION public.organization_metered_overages(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.superadmin_list_orgs_over_seats(INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.superadmin_commercial_summary(INT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.superadmin_list_orgs_over_seats(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.superadmin_commercial_summary(INT) TO authenticated;

COMMENT ON FUNCTION public.organization_metered_overages(UUID) IS
  'Internal current-month meter overages. Add-on and override limits count; unlimited and zero are skipped.';
COMMENT ON FUNCTION public.superadmin_list_orgs_over_seats(INT) IS
  'Platform-admin queue of clinics over a finite seat or current-month meter. Legacy is ignored.';
COMMENT ON FUNCTION public.superadmin_commercial_summary(INT) IS
  'Platform-admin commercial counts, including orgs over current seats or monthly meters.';
