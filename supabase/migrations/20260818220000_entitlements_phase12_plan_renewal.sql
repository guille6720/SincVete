-- Phase 12: paid-plan renewal after one-time Mercado Pago / Stripe payment checkout.
-- Reminder lead time is not plan duration. Open-ended (ends_at NULL) and legacy/trial are not reminded.
-- Stripe subscription invoices extend ends_at; first checkout still goes through billing_apply_paid_plan.

CREATE OR REPLACE FUNCTION public.billing_extend_paid_plan(
  p_organization_id UUID,
  p_interval TEXT DEFAULT 'monthly',
  p_provider TEXT DEFAULT NULL,
  p_external_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id UUID;
  v_ends TIMESTAMPTZ;
  v_plan_key TEXT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role only';
  END IF;

  IF p_interval = 'annual' THEN
    v_ends := timezone('utc', now()) + interval '1 year';
  ELSE
    v_ends := timezone('utc', now()) + interval '1 month';
  END IF;

  SELECT s.id, p.key
  INTO v_id, v_plan_key
  FROM public.organization_subscriptions s
  JOIN public.plans p ON p.id = s.plan_id
  WHERE s.organization_id = p_organization_id
    AND s.status IN ('active', 'past_due')
    AND s.cancelled_at IS NULL
    AND p.key NOT IN ('legacy', 'trial')
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('extended', 0);
  END IF;

  UPDATE public.organization_subscriptions
  SET
    status = 'active',
    ends_at = v_ends,
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'status_source', 'billing_extend_paid_plan',
      'provider', p_provider,
      'external_id', p_external_id,
      'interval', COALESCE(p_interval, 'monthly'),
      'extended_at', timezone('utc', now())
    )
  WHERE id = v_id;

  RETURN jsonb_build_object(
    'extended', 1,
    'subscription_id', v_id,
    'plan_key', v_plan_key,
    'ends_at', v_ends
  );
END;
$$;

REVOKE ALL ON FUNCTION public.billing_extend_paid_plan(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.billing_extend_paid_plan(UUID, TEXT, TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION public.billing_extend_paid_plan(UUID, TEXT, TEXT, TEXT) IS
  'Webhook/service-role only. Extends the current public paid plan. Never legacy/trial.';

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
  v_remind INTERVAL;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    PERFORM public.require_platform_admin();
  END IF;

  v_expired := public.expire_due_subscriptions(NULL);
  v_period_start := date_trunc('month', timezone('utc', now()))::date;
  v_remind := make_interval(days => GREATEST(COALESCE(p_trial_remind_days, 3), 1));

  FOR rec IN
    SELECT s.id, s.organization_id, p.name AS plan_name, s.trial_ends_at
    FROM public.organization_subscriptions s
    JOIN public.plans p ON p.id = s.plan_id
    WHERE s.status = 'trialing'
      AND s.cancelled_at IS NULL
      AND s.trial_ends_at IS NOT NULL
      AND s.trial_ends_at > timezone('utc', now())
      AND s.trial_ends_at <= timezone('utc', now()) + v_remind
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
    SELECT s.id, s.organization_id, p.name AS plan_name, s.ends_at
    FROM public.organization_subscriptions s
    JOIN public.plans p ON p.id = s.plan_id
    WHERE s.status IN ('active', 'past_due')
      AND s.cancelled_at IS NULL
      AND p.key NOT IN ('legacy', 'trial')
      AND s.ends_at IS NOT NULL
      AND s.ends_at > timezone('utc', now())
      AND s.ends_at <= timezone('utc', now()) + v_remind
  LOOP
    v_id := public.emit_plan_notification(
      rec.organization_id,
      'plan_ending',
      rec.id,
      'Tu plan vence pronto',
      format(
        'El plan%s vence el %s. Renovalo desde Configuración para no perder el acceso.',
        CASE WHEN rec.plan_name IS NULL THEN '' ELSE ' ' || rec.plan_name END,
        to_char(rec.ends_at AT TIME ZONE 'UTC', 'DD/MM/YYYY')
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
    SELECT g.id, g.organization_id, a.name AS addon_name, g.ends_at
    FROM public.organization_addons g
    JOIN public.addons a ON a.id = g.addon_id
    WHERE g.status = 'active'
      AND g.cancelled_at IS NULL
      AND g.ends_at IS NOT NULL
      AND g.ends_at > timezone('utc', now())
      AND g.ends_at <= timezone('utc', now()) + v_remind
  LOOP
    v_id := public.emit_plan_notification(
      rec.organization_id,
      'addon_ending',
      rec.id,
      format('El extra %s vence pronto', rec.addon_name),
      format(
        'Vence el %s. Renovalo desde Configuración para no perder el módulo.',
        to_char(rec.ends_at AT TIME ZONE 'UTC', 'DD/MM/YYYY')
      ),
      p_dedupe_hours
    );
    IF v_id IS NOT NULL THEN
      v_notices := v_notices + 1;
    END IF;
  END LOOP;

  FOR rec IN
    SELECT g.id, g.organization_id, a.name AS addon_name
    FROM public.organization_addons g
    JOIN public.addons a ON a.id = g.addon_id
    WHERE g.status = 'expired'
      AND COALESCE(g.cancelled_at, g.ends_at, g.updated_at) >= timezone('utc', now()) - interval '24 hours'
  LOOP
    v_id := public.emit_plan_notification(
      rec.organization_id,
      'addon_expired',
      rec.id,
      format('El extra %s venció', rec.addon_name),
      'Ya no está activo. Renovalo desde Configuración → Plan si lo necesitás.',
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
      CASE
        WHEN ov.enabled IS TRUE THEN ov.limit_value
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
      WHERE g.organization_id = s.organization_id
        AND g.status = 'active'
        AND g.cancelled_at IS NULL
        AND (g.starts_at IS NULL OR g.starts_at <= timezone('utc', now()))
        AND (g.ends_at IS NULL OR g.ends_at > timezone('utc', now()))
    ) ad ON true
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

REVOKE ALL ON FUNCTION public.run_commercial_lifecycle(INT, NUMERIC, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.superadmin_commercial_summary(INT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.run_commercial_lifecycle(INT, NUMERIC, INT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.superadmin_commercial_summary(INT) TO authenticated;

COMMENT ON FUNCTION public.run_commercial_lifecycle(INT, NUMERIC, INT) IS
  'Service-role/Superadmin cron: expire due plans and add-ons, emit in-app notices including paid-plan renewal. Reminder days are lead time, not duration.';
COMMENT ON FUNCTION public.superadmin_commercial_summary(INT) IS
  'Platform-admin commercial counts, including paid plans and add-ons ending within the reminder lead time.';
