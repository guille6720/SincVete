-- Phase 8: Superadmin commercial ops, billing event history, platform-admin lifecycle.
-- Clinic org:manage may list own billing events (no webhook payloads).

CREATE OR REPLACE FUNCTION public.expire_due_subscriptions(
  p_organization_id UUID DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INT;
  v_org UUID;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    IF public.is_platform_admin() THEN
      NULL;
    ELSE
      v_org := public.get_user_organization_id();
      IF v_org IS NULL THEN
        RAISE EXCEPTION 'not authorized';
      END IF;
      IF p_organization_id IS NOT NULL AND p_organization_id IS DISTINCT FROM v_org THEN
        RAISE EXCEPTION 'not authorized';
      END IF;
      p_organization_id := v_org;
    END IF;
  END IF;

  UPDATE public.organization_subscriptions
  SET
    status = 'expired',
    cancelled_at = COALESCE(cancelled_at, timezone('utc', now())),
    ends_at = COALESCE(ends_at, timezone('utc', now())),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'status_source', 'expire_due_subscriptions',
      'expired_at', timezone('utc', now())
    )
  WHERE cancelled_at IS NULL
    AND status IN ('trialing', 'active', 'past_due')
    AND (p_organization_id IS NULL OR organization_id = p_organization_id)
    AND (
      (status = 'trialing' AND trial_ends_at IS NOT NULL AND trial_ends_at <= timezone('utc', now()))
      OR (
        status IN ('active', 'past_due')
        AND ends_at IS NOT NULL
        AND ends_at <= timezone('utc', now())
      )
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.run_commercial_lifecycle(
  p_trial_remind_days INT DEFAULT 3,
  p_quota_warn_ratio NUMERIC DEFAULT 0.8,
  p_dedupe_hours INT DEFAULT 20
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_expired INT := 0;
  v_notices INT := 0;
  v_id UUID;
  rec RECORD;
  v_limit NUMERIC;
  v_period_start DATE;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    PERFORM public.require_platform_admin();
  END IF;

  v_expired := public.expire_due_subscriptions(NULL);
  v_period_start := date_trunc('month', timezone('utc', now()))::date;

  FOR rec IN
    SELECT s.id, s.organization_id, p.name AS plan_name, s.trial_ends_at
    FROM public.organization_subscriptions s
    JOIN public.plans p ON p.id = s.plan_id
    WHERE s.status = 'trialing'
      AND s.cancelled_at IS NULL
      AND s.trial_ends_at IS NOT NULL
      AND s.trial_ends_at > timezone('utc', now())
      AND s.trial_ends_at <= timezone('utc', now())
        + make_interval(days => GREATEST(COALESCE(p_trial_remind_days, 3), 1))
  LOOP
    v_id := public.emit_plan_notification(
      rec.organization_id,
      'plan_trial_ending',
      rec.id,
      'Tu trial vence pronto',
      format(
        'El trial%s vence el %s. Elegí un plan para no perder el acceso.',
        CASE WHEN rec.plan_name IS NULL THEN '' ELSE ' de ' || rec.plan_name END,
        to_char(rec.trial_ends_at AT TIME ZONE 'UTC', 'DD/MM/YYYY')
      ),
      p_dedupe_hours
    );
    IF v_id IS NOT NULL THEN
      v_notices := v_notices + 1;
    END IF;
  END LOOP;

  FOR rec IN
    SELECT s.id, s.organization_id, p.name AS plan_name
    FROM public.organization_subscriptions s
    JOIN public.plans p ON p.id = s.plan_id
    WHERE s.status = 'expired'
      AND COALESCE(s.cancelled_at, s.ends_at, s.updated_at) >= timezone('utc', now()) - interval '24 hours'
  LOOP
    v_id := public.emit_plan_notification(
      rec.organization_id,
      'plan_expired',
      rec.id,
      'Tu plan venció',
      format(
        'El plan%s ya no está activo. Elegí uno para seguir usando los módulos.',
        CASE WHEN rec.plan_name IS NULL THEN '' ELSE ' ' || rec.plan_name END
      ),
      p_dedupe_hours
    );
    IF v_id IS NOT NULL THEN
      v_notices := v_notices + 1;
    END IF;
  END LOOP;

  FOR rec IN
    SELECT s.id, s.organization_id, p.name AS plan_name
    FROM public.organization_subscriptions s
    JOIN public.plans p ON p.id = s.plan_id
    WHERE s.status = 'past_due'
      AND s.cancelled_at IS NULL
  LOOP
    v_id := public.emit_plan_notification(
      rec.organization_id,
      'plan_past_due',
      rec.id,
      'Hay un pago pendiente',
      format(
        'El plan%s sigue operativo, pero el pago no se acreditó. Actualizá la facturación.',
        CASE WHEN rec.plan_name IS NULL THEN '' ELSE ' ' || rec.plan_name END
      ),
      p_dedupe_hours
    );
    IF v_id IS NOT NULL THEN
      v_notices := v_notices + 1;
    END IF;
  END LOOP;

  FOR rec IN
    SELECT
      s.organization_id,
      f.id AS feature_id,
      f.name AS feature_name,
      fu.usage_count,
      COALESCE(ov.limit_value, pf.limit_value, f.default_limit) AS limit_value
    FROM public.organization_subscriptions s
    JOIN public.features f
      ON f.usage_metered = true
     AND f.is_active = true
     AND f.feature_type = 'limit'
    JOIN public.feature_usage fu
      ON fu.organization_id = s.organization_id
     AND fu.feature_id = f.id
     AND fu.period_start = v_period_start
    LEFT JOIN public.plan_features pf
      ON pf.plan_id = s.plan_id
     AND pf.feature_id = f.id
    LEFT JOIN LATERAL (
      SELECT o.limit_value, o.enabled
      FROM public.organization_feature_overrides o
      WHERE o.organization_id = s.organization_id
        AND o.feature_id = f.id
        AND (o.starts_at IS NULL OR o.starts_at <= timezone('utc', now()))
        AND (o.ends_at IS NULL OR o.ends_at > timezone('utc', now()))
      ORDER BY o.created_at DESC
      LIMIT 1
    ) ov ON true
    WHERE s.status IN ('trialing', 'active', 'past_due')
      AND s.cancelled_at IS NULL
      AND (ov.enabled IS NULL OR ov.enabled IS TRUE)
  LOOP
    v_limit := rec.limit_value;
    IF v_limit IS NULL OR v_limit <= 0 THEN
      CONTINUE;
    END IF;
    IF rec.usage_count < ceil(v_limit * GREATEST(COALESCE(p_quota_warn_ratio, 0.8), 0.5)) THEN
      CONTINUE;
    END IF;

    v_id := public.emit_plan_notification(
      rec.organization_id,
      'plan_quota',
      rec.feature_id,
      format('Cupo de %s cerca del límite', rec.feature_name),
      'Usaste el 80% o más del cupo mensual. Revisá el plan o esperá al próximo mes.',
      p_dedupe_hours
    );
    IF v_id IS NOT NULL THEN
      v_notices := v_notices + 1;
    END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'expired', v_expired,
    'notices', v_notices
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.run_commercial_lifecycle(INT, NUMERIC, INT) TO authenticated, service_role;

DROP FUNCTION IF EXISTS public.superadmin_list_organizations(TEXT, INT, INT);

CREATE FUNCTION public.superadmin_list_organizations(
  p_search TEXT DEFAULT NULL,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 25,
  p_plan_key TEXT DEFAULT NULL,
  p_status TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  name TEXT,
  slug TEXT,
  plan_key TEXT,
  plan_name TEXT,
  status public.subscription_status,
  trial_ends_at TIMESTAMPTZ,
  starts_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ,
  total_count BIGINT
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_page INT;
  v_size INT;
  v_q TEXT;
  v_plan TEXT;
  v_status public.subscription_status;
BEGIN
  PERFORM public.require_platform_admin();
  PERFORM public.expire_due_subscriptions(NULL);
  v_page := GREATEST(COALESCE(p_page, 1), 1);
  v_size := LEAST(GREATEST(COALESCE(p_page_size, 25), 1), 100);
  v_q := NULLIF(btrim(COALESCE(p_search, '')), '');
  v_plan := NULLIF(btrim(COALESCE(p_plan_key, '')), '');
  IF p_status IS NULL OR btrim(p_status) = '' THEN
    v_status := NULL;
  ELSIF p_status IN ('trialing', 'active', 'past_due', 'cancelled', 'expired') THEN
    v_status := p_status::public.subscription_status;
  ELSE
    RAISE EXCEPTION 'invalid subscription status';
  END IF;

  RETURN QUERY
  WITH latest_sub AS (
    SELECT DISTINCT ON (s.organization_id)
      s.organization_id,
      s.status,
      s.trial_ends_at,
      s.starts_at,
      p.key AS plan_key,
      p.name AS plan_name
    FROM public.organization_subscriptions s
    JOIN public.plans p ON p.id = s.plan_id
    ORDER BY s.organization_id, s.created_at DESC
  ),
  filtered AS (
    SELECT
      o.id,
      o.name,
      o.slug,
      cs.plan_key,
      cs.plan_name,
      cs.status,
      cs.trial_ends_at,
      cs.starts_at,
      o.created_at,
      COUNT(*) OVER () AS total_count
    FROM public.organizations o
    LEFT JOIN latest_sub cs ON cs.organization_id = o.id
    WHERE o.deleted_at IS NULL
      AND (
        v_q IS NULL
        OR o.name ILIKE '%' || v_q || '%'
        OR o.slug ILIKE '%' || v_q || '%'
      )
      AND (v_plan IS NULL OR cs.plan_key = v_plan)
      AND (v_status IS NULL OR cs.status = v_status)
  )
  SELECT
    f.id, f.name, f.slug, f.plan_key, f.plan_name, f.status,
    f.trial_ends_at, f.starts_at, f.created_at, f.total_count
  FROM filtered f
  ORDER BY f.created_at DESC
  OFFSET (v_page - 1) * v_size
  LIMIT v_size;
END;
$$;

REVOKE ALL ON FUNCTION public.superadmin_list_organizations(TEXT, INT, INT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.superadmin_list_organizations(TEXT, INT, INT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.superadmin_commercial_summary()
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.require_platform_admin();
  PERFORM public.expire_due_subscriptions(NULL);

  RETURN (
    SELECT jsonb_build_object(
      'organizations', COUNT(*) FILTER (WHERE o.deleted_at IS NULL),
      'trialing', COUNT(*) FILTER (WHERE ls.status = 'trialing'),
      'active', COUNT(*) FILTER (WHERE ls.status = 'active'),
      'past_due', COUNT(*) FILTER (WHERE ls.status = 'past_due'),
      'expired', COUNT(*) FILTER (WHERE ls.status = 'expired'),
      'cancelled', COUNT(*) FILTER (WHERE ls.status = 'cancelled')
    )
    FROM public.organizations o
    LEFT JOIN LATERAL (
      SELECT s.status
      FROM public.organization_subscriptions s
      WHERE s.organization_id = o.id
      ORDER BY s.created_at DESC
      LIMIT 1
    ) ls ON true
    WHERE o.deleted_at IS NULL
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.superadmin_list_billing_events(
  p_organization_id UUID,
  p_limit INT DEFAULT 25
)
RETURNS TABLE (
  id UUID,
  provider TEXT,
  event_id TEXT,
  event_type TEXT,
  processed_at TIMESTAMPTZ
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
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization required';
  END IF;
  v_limit := LEAST(GREATEST(COALESCE(p_limit, 25), 1), 100);

  RETURN QUERY
  SELECT e.id, e.provider, e.event_id, e.event_type, e.processed_at
  FROM public.billing_events e
  WHERE e.organization_id = p_organization_id
  ORDER BY e.processed_at DESC
  LIMIT v_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_own_billing_events(
  p_limit INT DEFAULT 25
)
RETURNS TABLE (
  id UUID,
  provider TEXT,
  event_type TEXT,
  processed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org UUID;
  v_limit INT;
BEGIN
  IF NOT public.has_permission('org:manage') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  v_org := public.get_user_organization_id();
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'not authorized';
  END IF;
  v_limit := LEAST(GREATEST(COALESCE(p_limit, 25), 1), 50);

  RETURN QUERY
  SELECT e.id, e.provider, e.event_type, e.processed_at
  FROM public.billing_events e
  WHERE e.organization_id = v_org
  ORDER BY e.processed_at DESC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.superadmin_commercial_summary() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.superadmin_list_billing_events(UUID, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_own_billing_events(INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.superadmin_commercial_summary() TO authenticated;
GRANT EXECUTE ON FUNCTION public.superadmin_list_billing_events(UUID, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_own_billing_events(INT) TO authenticated;
