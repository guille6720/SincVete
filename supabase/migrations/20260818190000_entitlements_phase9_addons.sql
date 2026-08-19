-- Phase 9: commercial add-ons (Superadmin grant; no public checkout).
-- Resolution: override → add-on → plan → default → deny.
-- Add-ons only grant or raise limits; they never revoke a plan feature.

CREATE TABLE public.addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE CHECK (char_length(key) BETWEEN 2 AND 64),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 100),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_public BOOLEAN NOT NULL DEFAULT true,
  display_order INT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.addon_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  addon_id UUID NOT NULL REFERENCES public.addons(id) ON DELETE CASCADE,
  feature_id UUID NOT NULL REFERENCES public.features(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  limit_value NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (addon_id, feature_id)
);

CREATE TABLE public.organization_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  addon_id UUID NOT NULL REFERENCES public.addons(id) ON DELETE RESTRICT,
  status public.subscription_status NOT NULL DEFAULT 'active',
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  reason TEXT,
  granted_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX organization_addons_one_current
  ON public.organization_addons (organization_id, addon_id)
  WHERE status = 'active' AND cancelled_at IS NULL;

CREATE INDEX idx_organization_addons_org
  ON public.organization_addons (organization_id);

CREATE INDEX idx_organization_addons_due
  ON public.organization_addons (ends_at)
  WHERE status = 'active' AND cancelled_at IS NULL AND ends_at IS NOT NULL;

CREATE INDEX idx_addon_features_addon
  ON public.addon_features (addon_id);

CREATE TRIGGER trg_addons_updated_at
  BEFORE UPDATE ON public.addons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_addon_features_updated_at
  BEFORE UPDATE ON public.addon_features
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_organization_addons_updated_at
  BEFORE UPDATE ON public.organization_addons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.addon_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_addons ENABLE ROW LEVEL SECURITY;

CREATE POLICY addons_select_authenticated
  ON public.addons FOR SELECT TO authenticated
  USING (true);

CREATE POLICY addon_features_select_authenticated
  ON public.addon_features FOR SELECT TO authenticated
  USING (true);

CREATE POLICY organization_addons_select_own
  ON public.organization_addons FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());

GRANT SELECT ON public.addons TO authenticated;
GRANT SELECT ON public.addon_features TO authenticated;
GRANT SELECT ON public.organization_addons TO authenticated;

-- ---------------------------------------------------------------------------
-- Seed: extras that Premium includes, so Superadmin can sell them on Basic/Pro.
-- ---------------------------------------------------------------------------

INSERT INTO public.addons (key, name, description, display_order, metadata) VALUES
  (
    'addon.ai',
    'IA clínica',
    'SOAP, resumen e indicaciones para el tutor, con cupo mensual.',
    10,
    '{"source":"phase9_seed"}'::jsonb
  ),
  (
    'addon.whatsapp',
    'WhatsApp',
    'Mensajes y recordatorios por WhatsApp, con cupo mensual.',
    20,
    '{"source":"phase9_seed"}'::jsonb
  ),
  (
    'addon.portal',
    'Portal del tutor',
    'Acceso del propietario a turnos e historia desde el portal.',
    30,
    '{"source":"phase9_seed"}'::jsonb
  ),
  (
    'addon.images',
    'Imágenes clínicas',
    'Galería de estudios e imágenes, con más almacenamiento.',
    40,
    '{"source":"phase9_seed"}'::jsonb
  ),
  (
    'addon.reports',
    'Reportes avanzados',
    'Reportes de caja e inventario.',
    50,
    '{"source":"phase9_seed"}'::jsonb
  );

CREATE OR REPLACE FUNCTION public._seed_addon_feature(
  p_addon_key TEXT,
  p_feature_key TEXT,
  p_enabled BOOLEAN,
  p_limit NUMERIC DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.addon_features (addon_id, feature_id, enabled, limit_value)
  SELECT a.id, f.id, p_enabled, p_limit
  FROM public.addons a
  CROSS JOIN public.features f
  WHERE a.key = p_addon_key AND f.key = p_feature_key
  ON CONFLICT (addon_id, feature_id) DO UPDATE
    SET enabled = EXCLUDED.enabled,
        limit_value = EXCLUDED.limit_value,
        updated_at = now();
END;
$$;

SELECT public._seed_addon_feature('addon.ai', 'ai.enabled', true);
SELECT public._seed_addon_feature('addon.ai', 'ai.patient_summary', true);
SELECT public._seed_addon_feature('addon.ai', 'ai.soap_assistant', true);
SELECT public._seed_addon_feature('addon.ai', 'ai.owner_instructions', true);
SELECT public._seed_addon_feature('addon.ai', 'ai.monthly_requests', true, 100);

SELECT public._seed_addon_feature('addon.whatsapp', 'whatsapp.enabled', true);
SELECT public._seed_addon_feature('addon.whatsapp', 'whatsapp.reminders', true);
SELECT public._seed_addon_feature('addon.whatsapp', 'whatsapp.monthly_messages', true, 500);

SELECT public._seed_addon_feature('addon.portal', 'owner_portal.enabled', true);

SELECT public._seed_addon_feature('addon.images', 'clinical_images.enabled', true);
SELECT public._seed_addon_feature('addon.images', 'storage.max_mb', true, 5120);

SELECT public._seed_addon_feature('addon.reports', 'reports.basic', true);
SELECT public._seed_addon_feature('addon.reports', 'reports.advanced', true);

DROP FUNCTION public._seed_addon_feature(TEXT, TEXT, BOOLEAN, NUMERIC);

-- ---------------------------------------------------------------------------
-- Expire add-ons whose ends_at already passed (same auth as subscriptions).
-- ---------------------------------------------------------------------------

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

  UPDATE public.organization_addons
  SET
    status = 'expired',
    cancelled_at = COALESCE(cancelled_at, timezone('utc', now())),
    ends_at = COALESCE(ends_at, timezone('utc', now())),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'status_source', 'expire_due_subscriptions',
      'expired_at', timezone('utc', now())
    )
  WHERE cancelled_at IS NULL
    AND status = 'active'
    AND (p_organization_id IS NULL OR organization_id = p_organization_id)
    AND ends_at IS NOT NULL
    AND ends_at <= timezone('utc', now());

  RETURN v_count;
END;
$$;

-- ---------------------------------------------------------------------------
-- Superadmin org bundle includes add-on catalog, grants and effective features.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.superadmin_get_org_commercial(p_organization_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org JSONB;
BEGIN
  PERFORM public.require_platform_admin();
  PERFORM public.expire_due_subscriptions(p_organization_id);

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
    'addon_catalog', (
      SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.display_order, a.key), '[]'::jsonb)
      FROM (
        SELECT key, name, description, is_active, is_public, display_order
        FROM public.addons
        WHERE is_active = true
      ) a
    ),
    'organization_addons', (
      SELECT COALESCE(jsonb_agg(to_jsonb(oa) ORDER BY oa.created_at DESC), '[]'::jsonb)
      FROM (
        SELECT
          g.id,
          a.key AS addon_key,
          a.name AS addon_name,
          g.status,
          g.starts_at,
          g.ends_at,
          g.cancelled_at,
          g.reason,
          g.created_at
        FROM public.organization_addons g
        JOIN public.addons a ON a.id = g.addon_id
        WHERE g.organization_id = p_organization_id
      ) oa
    ),
    'addon_features', (
      SELECT COALESCE(jsonb_agg(to_jsonb(af)), '[]'::jsonb)
      FROM (
        SELECT f.key AS feature_key, af.enabled, af.limit_value
        FROM public.organization_addons g
        JOIN public.addons a ON a.id = g.addon_id AND a.is_active = true
        JOIN public.addon_features af ON af.addon_id = g.addon_id
        JOIN public.features f ON f.id = af.feature_id
        WHERE g.organization_id = p_organization_id
          AND g.status = 'active'
          AND g.cancelled_at IS NULL
          AND (g.starts_at IS NULL OR g.starts_at <= timezone('utc', now()))
          AND (g.ends_at IS NULL OR g.ends_at > timezone('utc', now()))
      ) af
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

CREATE OR REPLACE FUNCTION public.superadmin_grant_addon(
  p_organization_id UUID,
  p_addon_key TEXT,
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
  v_addon RECORD;
  v_id UUID;
BEGIN
  v_admin := public.require_platform_admin();

  IF NOT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = p_organization_id AND o.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'organization not found';
  END IF;

  SELECT id, key, is_active
  INTO v_addon
  FROM public.addons
  WHERE key = p_addon_key;

  IF v_addon.id IS NULL THEN
    RAISE EXCEPTION 'unknown add-on: %', p_addon_key;
  END IF;

  IF v_addon.is_active IS NOT TRUE THEN
    RAISE EXCEPTION 'inactive add-on: %', p_addon_key;
  END IF;

  IF p_ends_at IS NOT NULL AND p_starts_at IS NOT NULL AND p_ends_at <= p_starts_at THEN
    RAISE EXCEPTION 'addon ends_at must be after starts_at';
  END IF;

  UPDATE public.organization_addons g
  SET
    status = 'cancelled',
    cancelled_at = timezone('utc', now()),
    reason = COALESCE(p_reason, g.reason),
    metadata = COALESCE(g.metadata, '{}'::jsonb) || jsonb_build_object(
      'replaced_by_grant', true,
      'replaced_at', timezone('utc', now())
    )
  WHERE g.organization_id = p_organization_id
    AND g.addon_id = v_addon.id
    AND g.status = 'active'
    AND g.cancelled_at IS NULL;

  INSERT INTO public.organization_addons (
    organization_id, addon_id, status, starts_at, ends_at, reason, granted_by, metadata
  )
  VALUES (
    p_organization_id,
    v_addon.id,
    'active',
    COALESCE(p_starts_at, timezone('utc', now())),
    p_ends_at,
    p_reason,
    v_admin,
    jsonb_build_object('source', 'superadmin_grant_addon')
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object('organization_addon_id', v_id, 'addon_key', p_addon_key);
END;
$$;

CREATE OR REPLACE FUNCTION public.superadmin_revoke_addon(
  p_organization_id UUID,
  p_addon_key TEXT,
  p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_addon_id UUID;
  v_count INT;
BEGIN
  PERFORM public.require_platform_admin();

  SELECT a.id INTO v_addon_id
  FROM public.addons a
  WHERE a.key = p_addon_key;

  IF v_addon_id IS NULL THEN
    RAISE EXCEPTION 'unknown add-on: %', p_addon_key;
  END IF;

  UPDATE public.organization_addons g
  SET
    status = 'cancelled',
    cancelled_at = timezone('utc', now()),
    reason = COALESCE(p_reason, g.reason),
    metadata = COALESCE(g.metadata, '{}'::jsonb) || jsonb_build_object(
      'revoked_at', timezone('utc', now())
    )
  WHERE g.organization_id = p_organization_id
    AND g.addon_id = v_addon_id
    AND g.status = 'active'
    AND g.cancelled_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('revoked', v_count, 'addon_key', p_addon_key);
END;
$$;

CREATE OR REPLACE FUNCTION public.list_own_addons()
RETURNS TABLE (
  addon_key TEXT,
  addon_name TEXT,
  description TEXT,
  status public.subscription_status,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ
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
  SELECT a.key, a.name, a.description, g.status, g.starts_at, g.ends_at
  FROM public.organization_addons g
  JOIN public.addons a ON a.id = g.addon_id
  WHERE g.organization_id = v_org
    AND g.status = 'active'
    AND g.cancelled_at IS NULL
    AND (g.starts_at IS NULL OR g.starts_at <= timezone('utc', now()))
    AND (g.ends_at IS NULL OR g.ends_at > timezone('utc', now()))
  ORDER BY a.display_order, a.key;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_own_addon_features()
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
DECLARE
  v_org UUID;
BEGIN
  v_org := public.get_user_organization_id();
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  RETURN QUERY
  SELECT f.key, af.enabled, af.limit_value
  FROM public.organization_addons g
  JOIN public.addons a ON a.id = g.addon_id AND a.is_active = true
  JOIN public.addon_features af ON af.addon_id = g.addon_id
  JOIN public.features f ON f.id = af.feature_id
  WHERE g.organization_id = v_org
    AND g.status = 'active'
    AND g.cancelled_at IS NULL
    AND (g.starts_at IS NULL OR g.starts_at <= timezone('utc', now()))
    AND (g.ends_at IS NULL OR g.ends_at > timezone('utc', now()));
END;
$$;

REVOKE ALL ON FUNCTION public.superadmin_grant_addon(UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.superadmin_revoke_addon(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_own_addons() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_own_addon_features() FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.superadmin_grant_addon(UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION public.superadmin_revoke_addon(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_own_addons() TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_own_addon_features() TO authenticated;
