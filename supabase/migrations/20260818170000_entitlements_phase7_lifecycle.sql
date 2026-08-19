-- Phase 7: commercial lifecycle job, in-app plan notices, clinic self-serve cancel.
-- Does not invent a trial duration. Open-ended trials (trial_ends_at NULL) are not reminded.
-- Reminder lead time (3 days) is not the same as trial length.

ALTER TYPE public.notification_kind ADD VALUE IF NOT EXISTS 'plan';

CREATE OR REPLACE FUNCTION public.emit_plan_notification(
  p_organization_id UUID,
  p_related_type TEXT,
  p_related_id UUID,
  p_title TEXT,
  p_body TEXT,
  p_dedupe_hours INT DEFAULT 20
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF p_organization_id IS NULL
    OR p_related_type IS NULL
    OR p_title IS NULL
    OR btrim(p_title) = ''
  THEN
    RETURN NULL;
  END IF;

  IF p_dedupe_hours IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.notifications n
      WHERE n.organization_id = p_organization_id
        AND n.deleted_at IS NULL
        AND n.kind = 'plan'
        AND n.related_type = p_related_type
        AND n.related_id IS NOT DISTINCT FROM p_related_id
        AND n.created_at >= timezone('utc', now()) - make_interval(hours => p_dedupe_hours)
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
    NULL,
    'plan',
    left(btrim(p_title), 160),
    NULLIF(left(btrim(COALESCE(p_body, '')), 500), ''),
    '/configuracion?tab=plan',
    left(btrim(p_related_type), 40),
    p_related_id
  )
  RETURNING id INTO v_id;

  RETURN v_id;
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
    RAISE EXCEPTION 'service role only';
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

CREATE OR REPLACE FUNCTION public.billing_cancel_own_subscription()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org UUID;
  v_plan_key TEXT;
  v_id UUID;
  v_status public.subscription_status;
BEGIN
  IF NOT public.has_permission('org:manage') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  v_org := public.get_user_organization_id();
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT s.id, s.status, p.key
  INTO v_id, v_status, v_plan_key
  FROM public.organization_subscriptions s
  JOIN public.plans p ON p.id = s.plan_id
  WHERE s.organization_id = v_org
    AND s.status IN ('trialing', 'active', 'past_due')
    AND s.cancelled_at IS NULL
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'no active subscription';
  END IF;

  IF v_plan_key = 'legacy' THEN
    RAISE EXCEPTION 'legacy plans cannot be self-cancelled';
  END IF;

  UPDATE public.organization_subscriptions
  SET
    status = 'cancelled',
    cancelled_at = timezone('utc', now()),
    ends_at = COALESCE(ends_at, timezone('utc', now())),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'status_source', 'clinic_self_cancel',
      'cancelled_at', timezone('utc', now())
    )
  WHERE id = v_id;

  RETURN jsonb_build_object(
    'subscription_id', v_id,
    'previous_status', v_status,
    'status', 'cancelled'
  );
END;
$$;

REVOKE ALL ON FUNCTION public.emit_plan_notification(UUID, TEXT, UUID, TEXT, TEXT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.run_commercial_lifecycle(INT, NUMERIC, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.billing_cancel_own_subscription() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.emit_plan_notification(UUID, TEXT, UUID, TEXT, TEXT, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.run_commercial_lifecycle(INT, NUMERIC, INT) TO service_role;
GRANT EXECUTE ON FUNCTION public.billing_cancel_own_subscription() TO authenticated;

COMMENT ON FUNCTION public.run_commercial_lifecycle(INT, NUMERIC, INT) IS
  'Service-role cron: expire due subscriptions and emit in-app plan notices. Does not invent trial length.';
COMMENT ON FUNCTION public.billing_cancel_own_subscription() IS
  'Clinic org:manage may cancel the current non-legacy subscription. Immediate cancel.';
