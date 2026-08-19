-- Phase 2: Superadmin commercial control (no payments).
-- Depends on: 20260817180000 + 20260818114500 entitlements.
-- Platform admins are stored in public.platform_admins.
-- First admin is bootstrapped from SUPERADMIN_EMAILS in the app (service upsert),
-- then every mutation is authorized in-DB via require_platform_admin().

CREATE TABLE public.platform_admins (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_platform_admins_email ON public.platform_admins (lower(email));

CREATE TRIGGER trg_platform_admins_updated_at
  BEFORE UPDATE ON public.platform_admins
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.platform_admins ENABLE ROW LEVEL SECURITY;
-- No policies for authenticated: default deny. Access only via SECURITY DEFINER helpers.
REVOKE ALL ON TABLE public.platform_admins FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.platform_admins TO service_role;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.platform_admins a
    WHERE a.user_id = auth.uid()
      AND a.is_active = true
  );
$$;

CREATE OR REPLACE FUNCTION public.require_platform_admin()
RETURNS UUID
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid UUID;
BEGIN
  v_uid := auth.uid();
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not a platform admin';
  END IF;
  RETURN v_uid;
END;
$$;

REVOKE ALL ON FUNCTION public.is_platform_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.require_platform_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.require_platform_admin() TO authenticated;

-- Audit commercial writes (tables have organization_id).
DROP TRIGGER IF EXISTS trg_audit_organization_subscriptions ON public.organization_subscriptions;
CREATE TRIGGER trg_audit_organization_subscriptions
  AFTER INSERT OR UPDATE OR DELETE ON public.organization_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

DROP TRIGGER IF EXISTS trg_audit_organization_feature_overrides ON public.organization_feature_overrides;
CREATE TRIGGER trg_audit_organization_feature_overrides
  AFTER INSERT OR UPDATE OR DELETE ON public.organization_feature_overrides
  FOR EACH ROW EXECUTE FUNCTION public.audit_log_changes();

-- ---------------------------------------------------------------------------
-- List organizations + current subscription
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.superadmin_list_organizations(
  p_search TEXT DEFAULT NULL,
  p_page INT DEFAULT 1,
  p_page_size INT DEFAULT 25
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
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_page INT;
  v_size INT;
  v_q TEXT;
BEGIN
  PERFORM public.require_platform_admin();
  v_page := GREATEST(COALESCE(p_page, 1), 1);
  v_size := LEAST(GREATEST(COALESCE(p_page_size, 25), 1), 100);
  v_q := NULLIF(btrim(COALESCE(p_search, '')), '');

  RETURN QUERY
  WITH current_sub AS (
    SELECT DISTINCT ON (s.organization_id)
      s.organization_id,
      s.status,
      s.trial_ends_at,
      s.starts_at,
      p.key AS plan_key,
      p.name AS plan_name
    FROM public.organization_subscriptions s
    JOIN public.plans p ON p.id = s.plan_id
    WHERE s.status IN ('trialing', 'active', 'past_due')
      AND s.cancelled_at IS NULL
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
    LEFT JOIN current_sub cs ON cs.organization_id = o.id
    WHERE o.deleted_at IS NULL
      AND (
        v_q IS NULL
        OR o.name ILIKE '%' || v_q || '%'
        OR o.slug ILIKE '%' || v_q || '%'
      )
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

-- ---------------------------------------------------------------------------
-- Bundle for one organization (raw inputs; app resolves entitlements)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.superadmin_get_org_commercial(p_organization_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org JSONB;
BEGIN
  PERFORM public.require_platform_admin();

  SELECT to_jsonb(o)
  INTO v_org
  FROM public.organizations o
  WHERE o.id = p_organization_id
    AND o.deleted_at IS NULL;

  IF v_org IS NULL THEN
    RAISE EXCEPTION 'organization not found';
  END IF;

  RETURN jsonb_build_object(
    'organization', jsonb_build_object(
      'id', v_org->>'id',
      'name', v_org->>'name',
      'slug', v_org->>'slug',
      'created_at', v_org->>'created_at'
    ),
    'subscription', (
      SELECT to_jsonb(x)
      FROM (
        SELECT
          s.id,
          s.plan_id,
          s.status,
          s.starts_at,
          s.ends_at,
          s.trial_ends_at,
          s.cancelled_at,
          s.metadata,
          p.key AS plan_key,
          p.name AS plan_name,
          p.is_internal,
          p.is_public
        FROM public.organization_subscriptions s
        JOIN public.plans p ON p.id = s.plan_id
        WHERE s.organization_id = p_organization_id
          AND s.status IN ('trialing', 'active', 'past_due')
          AND s.cancelled_at IS NULL
        ORDER BY s.created_at DESC
        LIMIT 1
      ) x
    ),
    'plans', (
      SELECT COALESCE(jsonb_agg(to_jsonb(p) ORDER BY p.display_order, p.key), '[]'::jsonb)
      FROM (
        SELECT id, key, name, is_active, is_public, is_internal, display_order
        FROM public.plans
        WHERE is_active = true
      ) p
    ),
    'catalog', (
      SELECT COALESCE(jsonb_agg(to_jsonb(f) ORDER BY f.key), '[]'::jsonb)
      FROM (
        SELECT key, name, feature_type, default_enabled, default_limit, is_active, usage_metered
        FROM public.features
        WHERE is_active = true
      ) f
    ),
    'plan_features', (
      SELECT COALESCE(jsonb_agg(to_jsonb(pf)), '[]'::jsonb)
      FROM (
        SELECT f.key AS feature_key, pf.enabled, pf.limit_value
        FROM public.organization_subscriptions s
        JOIN public.plan_features pf ON pf.plan_id = s.plan_id
        JOIN public.features f ON f.id = pf.feature_id
        WHERE s.organization_id = p_organization_id
          AND s.status IN ('trialing', 'active', 'past_due')
          AND s.cancelled_at IS NULL
      ) pf
    ),
    'overrides', (
      SELECT COALESCE(jsonb_agg(to_jsonb(ov) ORDER BY ov.updated_at DESC), '[]'::jsonb)
      FROM (
        SELECT
          ovr.id,
          f.key AS feature_key,
          ovr.enabled,
          ovr.limit_value,
          ovr.reason,
          ovr.starts_at,
          ovr.ends_at,
          ovr.updated_at
        FROM public.organization_feature_overrides ovr
        JOIN public.features f ON f.id = ovr.feature_id
        WHERE ovr.organization_id = p_organization_id
      ) ov
    ),
    'usage', (
      SELECT COALESCE(jsonb_agg(to_jsonb(u) ORDER BY u.period_start DESC), '[]'::jsonb)
      FROM (
        SELECT f.key AS feature_key, fu.period_start, fu.period_end, fu.usage_count
        FROM public.feature_usage fu
        JOIN public.features f ON f.id = fu.feature_id
        WHERE fu.organization_id = p_organization_id
        ORDER BY fu.period_start DESC
        LIMIT 50
      ) u
    )
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Change plan (never auto-assigns legacy)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.superadmin_change_plan(
  p_organization_id UUID,
  p_plan_key TEXT,
  p_reason TEXT DEFAULT NULL,
  p_allow_legacy BOOLEAN DEFAULT false,
  p_trial_days INT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin UUID;
  v_plan RECORD;
  v_status public.subscription_status;
  v_trial_ends TIMESTAMPTZ;
  v_meta JSONB;
  v_new_id UUID;
BEGIN
  v_admin := public.require_platform_admin();

  IF NOT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = p_organization_id AND o.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'organization not found';
  END IF;

  SELECT id, key, is_internal, is_active, metadata
  INTO v_plan
  FROM public.plans
  WHERE key = p_plan_key
    AND is_active = true;

  IF v_plan.id IS NULL THEN
    RAISE EXCEPTION 'unknown or inactive plan: %', p_plan_key;
  END IF;

  IF v_plan.key = 'legacy' AND COALESCE(p_allow_legacy, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'legacy plan is migration-only; assignment requires explicit Superadmin confirmation';
  END IF;

  IF v_plan.key = 'legacy' THEN
    v_status := 'active';
    v_trial_ends := NULL;
    v_meta := jsonb_build_object(
      'source', 'superadmin_change_plan',
      'assign_legacy_explicit', true,
      'reason', p_reason,
      'changed_by', v_admin
    );
  ELSIF v_plan.key = 'trial' THEN
    v_status := 'trialing';
    IF p_trial_days IS NOT NULL AND p_trial_days > 0 THEN
      v_trial_ends := timezone('utc', now()) + make_interval(days => p_trial_days);
    ELSE
      BEGIN
        IF NULLIF(v_plan.metadata->>'default_trial_days', '')::INT > 0 THEN
          v_trial_ends := timezone('utc', now())
            + make_interval(days => (v_plan.metadata->>'default_trial_days')::INT);
        ELSE
          v_trial_ends := NULL;
        END IF;
      EXCEPTION WHEN others THEN
        v_trial_ends := NULL;
      END;
    END IF;
    v_meta := jsonb_build_object(
      'source', 'superadmin_change_plan',
      'plan_key', 'trial',
      'reason', p_reason,
      'trial_days_applied', p_trial_days,
      'changed_by', v_admin
    );
  ELSE
    v_status := 'active';
    v_trial_ends := NULL;
    v_meta := jsonb_build_object(
      'source', 'superadmin_change_plan',
      'reason', p_reason,
      'changed_by', v_admin
    );
  END IF;

  UPDATE public.organization_subscriptions
  SET
    status = 'cancelled',
    cancelled_at = timezone('utc', now()),
    ends_at = timezone('utc', now())
  WHERE organization_id = p_organization_id
    AND status IN ('trialing', 'active', 'past_due')
    AND cancelled_at IS NULL;

  INSERT INTO public.organization_subscriptions (
    organization_id, plan_id, status, starts_at, trial_ends_at, metadata
  )
  VALUES (
    p_organization_id,
    v_plan.id,
    v_status,
    timezone('utc', now()),
    v_trial_ends,
    v_meta
  )
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object(
    'subscription_id', v_new_id,
    'plan_key', v_plan.key,
    'status', v_status,
    'trial_ends_at', v_trial_ends
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.superadmin_start_trial(
  p_organization_id UUID,
  p_trial_days INT DEFAULT NULL,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  RETURN public.superadmin_change_plan(
    p_organization_id, 'trial', p_reason, false, p_trial_days
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.superadmin_end_trial(
  p_organization_id UUID,
  p_plan_key TEXT DEFAULT 'basic',
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_plan_key IS NULL OR btrim(p_plan_key) = '' THEN
    p_plan_key := 'basic';
  END IF;
  IF p_plan_key = 'trial' THEN
    RAISE EXCEPTION 'end trial requires a commercial plan, not trial';
  END IF;
  RETURN public.superadmin_change_plan(
    p_organization_id, p_plan_key, COALESCE(p_reason, 'end trial'), false, NULL
  );
END;
$$;

-- ---------------------------------------------------------------------------
-- Overrides
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.superadmin_set_feature_override(
  p_organization_id UUID,
  p_feature_key TEXT,
  p_enabled BOOLEAN DEFAULT true,
  p_limit_value NUMERIC DEFAULT NULL,
  p_reason TEXT DEFAULT NULL,
  p_starts_at TIMESTAMPTZ DEFAULT NULL,
  p_ends_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_admin UUID;
  v_feature_id UUID;
  v_id UUID;
BEGIN
  v_admin := public.require_platform_admin();

  IF NOT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = p_organization_id AND o.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'organization not found';
  END IF;

  SELECT f.id INTO v_feature_id
  FROM public.features f
  WHERE f.key = p_feature_key
    AND f.is_active = true;

  IF v_feature_id IS NULL THEN
    RAISE EXCEPTION 'unknown or inactive feature: %', p_feature_key;
  END IF;

  IF p_ends_at IS NOT NULL AND p_starts_at IS NOT NULL AND p_ends_at <= p_starts_at THEN
    RAISE EXCEPTION 'override ends_at must be after starts_at';
  END IF;

  -- Close currently effective overrides for this feature so the new one wins.
  UPDATE public.organization_feature_overrides ovr
  SET ends_at = timezone('utc', now())
  WHERE ovr.organization_id = p_organization_id
    AND ovr.feature_id = v_feature_id
    AND (ovr.ends_at IS NULL OR ovr.ends_at > timezone('utc', now()));

  INSERT INTO public.organization_feature_overrides (
    organization_id, feature_id, enabled, limit_value, reason,
    starts_at, ends_at, created_by
  )
  VALUES (
    p_organization_id,
    v_feature_id,
    p_enabled,
    p_limit_value,
    p_reason,
    p_starts_at,
    p_ends_at,
    v_admin
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('override_id', v_id, 'feature_key', p_feature_key);
END;
$$;

CREATE OR REPLACE FUNCTION public.superadmin_clear_feature_override(
  p_organization_id UUID,
  p_feature_key TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_feature_id UUID;
  v_count INT;
BEGIN
  PERFORM public.require_platform_admin();

  SELECT f.id INTO v_feature_id
  FROM public.features f
  WHERE f.key = p_feature_key;

  IF v_feature_id IS NULL THEN
    RAISE EXCEPTION 'unknown feature: %', p_feature_key;
  END IF;

  UPDATE public.organization_feature_overrides ovr
  SET
    ends_at = timezone('utc', now()),
    reason = COALESCE(p_reason, ovr.reason)
  WHERE ovr.organization_id = p_organization_id
    AND ovr.feature_id = v_feature_id
    AND (ovr.ends_at IS NULL OR ovr.ends_at > timezone('utc', now()));

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('cleared', v_count, 'feature_key', p_feature_key);
END;
$$;

REVOKE ALL ON FUNCTION public.superadmin_list_organizations(TEXT, INT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.superadmin_get_org_commercial(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.superadmin_change_plan(UUID, TEXT, TEXT, BOOLEAN, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.superadmin_start_trial(UUID, INT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.superadmin_end_trial(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.superadmin_set_feature_override(UUID, TEXT, BOOLEAN, NUMERIC, TEXT, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.superadmin_clear_feature_override(UUID, TEXT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.superadmin_list_organizations(TEXT, INT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.superadmin_get_org_commercial(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.superadmin_change_plan(UUID, TEXT, TEXT, BOOLEAN, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.superadmin_start_trial(UUID, INT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.superadmin_end_trial(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.superadmin_set_feature_override(UUID, TEXT, BOOLEAN, NUMERIC, TEXT, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.superadmin_clear_feature_override(UUID, TEXT, TEXT) TO authenticated;

COMMENT ON TABLE public.platform_admins IS
  'Platform operators for Superadmin. Clinic users cannot self-insert; bootstrap via SUPERADMIN_EMAILS.';
COMMENT ON FUNCTION public.superadmin_change_plan(UUID, TEXT, TEXT, BOOLEAN, INT) IS
  'Cancels the current subscription and inserts a new one. Legacy requires p_allow_legacy=true.';
