-- Phase 1 (hardened): commercial entitlements
-- Depends on: organizations, set_updated_at(), get_user_organization_id() (foundation).
-- NEVER applied yet — this file replaces the previous incorrect 00040 draft.
--
-- Onboarding policy:
--   Existing orgs at migration time → legacy (migration-only, full access)
--   New orgs after migration → trial (NOT legacy)
-- Trial duration is NOT hardcoded as a business constant here.
--   plans.metadata.default_trial_days may be set later by Superadmin/product.
--   Until then trial_ends_at stays NULL (open-ended trialing status).

CREATE TYPE public.subscription_status AS ENUM (
  'trialing',
  'active',
  'past_due',
  'cancelled',
  'expired'
);

CREATE TYPE public.feature_value_type AS ENUM (
  'boolean',
  'limit'
);

-- ---------------------------------------------------------------------------
-- Catalog
-- ---------------------------------------------------------------------------

CREATE TABLE public.plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE CHECK (char_length(key) BETWEEN 2 AND 64),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 100),
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_public BOOLEAN NOT NULL DEFAULT true,
  -- Internal/migration plans must never appear in public selectors.
  is_internal BOOLEAN NOT NULL DEFAULT false,
  display_order INT NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE CHECK (char_length(key) BETWEEN 2 AND 120),
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 2 AND 120),
  description TEXT,
  feature_type public.feature_value_type NOT NULL DEFAULT 'boolean',
  default_enabled BOOLEAN NOT NULL DEFAULT false,
  default_limit NUMERIC,
  is_active BOOLEAN NOT NULL DEFAULT true,
  -- When true, feature may be used with increment_feature_usage / try_consume_feature_usage.
  usage_metered BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.plan_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  feature_id UUID NOT NULL REFERENCES public.features(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  limit_value NUMERIC,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_id, feature_id)
);

CREATE TABLE public.organization_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE RESTRICT,
  status public.subscription_status NOT NULL DEFAULT 'active',
  starts_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ends_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX organization_subscriptions_one_current
  ON public.organization_subscriptions (organization_id)
  WHERE status IN ('trialing', 'active') AND cancelled_at IS NULL;

CREATE INDEX idx_organization_subscriptions_org
  ON public.organization_subscriptions (organization_id);

CREATE INDEX idx_organization_subscriptions_plan
  ON public.organization_subscriptions (plan_id);

CREATE TABLE public.organization_feature_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  feature_id UUID NOT NULL REFERENCES public.features(id) ON DELETE CASCADE,
  enabled BOOLEAN,
  limit_value NUMERIC,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  reason TEXT,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_org_feature_overrides_org
  ON public.organization_feature_overrides (organization_id);

CREATE INDEX idx_org_feature_overrides_feature
  ON public.organization_feature_overrides (feature_id);

CREATE INDEX idx_org_feature_overrides_window
  ON public.organization_feature_overrides (organization_id, feature_id, starts_at, ends_at);

CREATE TABLE public.feature_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  feature_id UUID NOT NULL REFERENCES public.features(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  usage_count BIGINT NOT NULL DEFAULT 0 CHECK (usage_count >= 0),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, feature_id, period_start, period_end),
  CONSTRAINT feature_usage_period_valid CHECK (period_end >= period_start)
);

CREATE INDEX idx_feature_usage_org_period
  ON public.feature_usage (organization_id, period_start DESC);

CREATE TRIGGER trg_plans_updated_at
  BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_features_updated_at
  BEFORE UPDATE ON public.features
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_plan_features_updated_at
  BEFORE UPDATE ON public.plan_features
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_organization_subscriptions_updated_at
  BEFORE UPDATE ON public.organization_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_organization_feature_overrides_updated_at
  BEFORE UPDATE ON public.organization_feature_overrides
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER trg_feature_usage_updated_at
  BEFORE UPDATE ON public.feature_usage
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plan_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_feature_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY plans_select_authenticated
  ON public.plans FOR SELECT TO authenticated
  USING (true);

CREATE POLICY features_select_authenticated
  ON public.features FOR SELECT TO authenticated
  USING (true);

CREATE POLICY plan_features_select_authenticated
  ON public.plan_features FOR SELECT TO authenticated
  USING (true);

CREATE POLICY organization_subscriptions_select_own
  ON public.organization_subscriptions FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY organization_feature_overrides_select_own
  ON public.organization_feature_overrides FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());

CREATE POLICY feature_usage_select_own
  ON public.feature_usage FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());

-- ---------------------------------------------------------------------------
-- Usage metering (SECURITY DEFINER + explicit org isolation)
-- Organization id is NEVER taken from the client.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.increment_feature_usage(
  p_feature_key TEXT,
  p_amount BIGINT DEFAULT 1,
  p_period_start DATE DEFAULT (date_trunc('month', timezone('utc', now())))::date,
  p_period_end DATE DEFAULT ((date_trunc('month', timezone('utc', now())) + interval '1 month - 1 day'))::date
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org_id UUID;
  v_feature_id UUID;
  v_metered BOOLEAN;
  v_count BIGINT;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be a positive integer';
  END IF;

  IF p_period_start IS NULL OR p_period_end IS NULL OR p_period_end < p_period_start THEN
    RAISE EXCEPTION 'invalid usage period';
  END IF;

  -- Trusted tenant context only (never accept client organization_id).
  v_org_id := public.get_user_organization_id();
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated to an organization';
  END IF;

  SELECT f.id, f.usage_metered
  INTO v_feature_id, v_metered
  FROM public.features f
  WHERE f.key = p_feature_key
    AND f.is_active = true;

  IF v_feature_id IS NULL THEN
    RAISE EXCEPTION 'unknown or inactive feature: %', p_feature_key;
  END IF;

  IF COALESCE(v_metered, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'feature is not usage-metered: %', p_feature_key;
  END IF;

  INSERT INTO public.feature_usage AS fu (
    organization_id, feature_id, period_start, period_end, usage_count
  )
  VALUES (v_org_id, v_feature_id, p_period_start, p_period_end, p_amount)
  ON CONFLICT (organization_id, feature_id, period_start, period_end)
  DO UPDATE SET
    usage_count = fu.usage_count + EXCLUDED.usage_count,
    updated_at = now()
  RETURNING fu.usage_count INTO v_count;

  RETURN v_count;
END;
$$;

COMMENT ON FUNCTION public.increment_feature_usage IS
  'Atomically increments usage for the caller organization only. Rejects non-positive amounts and non-metered features. Does not accept organization_id from the client.';

-- Future-safe helper: check limit then consume in one statement.
-- p_limit NULL = unlimited. Returns NULL if rejected (would exceed), else new usage_count.
-- Race note: callers that check then call increment separately can still race;
-- prefer this function when enforcing quotas.
CREATE OR REPLACE FUNCTION public.try_consume_feature_usage(
  p_feature_key TEXT,
  p_amount BIGINT,
  p_limit NUMERIC,
  p_period_start DATE DEFAULT (date_trunc('month', timezone('utc', now())))::date,
  p_period_end DATE DEFAULT ((date_trunc('month', timezone('utc', now())) + interval '1 month - 1 day'))::date
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org_id UUID;
  v_feature_id UUID;
  v_metered BOOLEAN;
  v_count BIGINT;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be a positive integer';
  END IF;

  IF p_period_start IS NULL OR p_period_end IS NULL OR p_period_end < p_period_start THEN
    RAISE EXCEPTION 'invalid usage period';
  END IF;

  v_org_id := public.get_user_organization_id();
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated to an organization';
  END IF;

  SELECT f.id, f.usage_metered
  INTO v_feature_id, v_metered
  FROM public.features f
  WHERE f.key = p_feature_key
    AND f.is_active = true;

  IF v_feature_id IS NULL THEN
    RAISE EXCEPTION 'unknown or inactive feature: %', p_feature_key;
  END IF;

  IF COALESCE(v_metered, false) IS NOT TRUE THEN
    RAISE EXCEPTION 'feature is not usage-metered: %', p_feature_key;
  END IF;

  -- Unlimited
  IF p_limit IS NULL THEN
    RETURN public.increment_feature_usage(p_feature_key, p_amount, p_period_start, p_period_end);
  END IF;

  IF p_limit < 0 THEN
    RAISE EXCEPTION 'limit must be null or >= 0';
  END IF;

  IF p_limit = 0 THEN
    RETURN NULL; -- unavailable
  END IF;

  INSERT INTO public.feature_usage AS fu (
    organization_id, feature_id, period_start, period_end, usage_count
  )
  VALUES (v_org_id, v_feature_id, p_period_start, p_period_end, p_amount)
  ON CONFLICT (organization_id, feature_id, period_start, period_end)
  DO UPDATE SET
    usage_count = fu.usage_count + EXCLUDED.usage_count,
    updated_at = now()
  WHERE fu.usage_count + EXCLUDED.usage_count <= p_limit
  RETURNING fu.usage_count INTO v_count;

  -- If WHERE failed, no row returned → quota exceeded
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_feature_usage(TEXT, BIGINT, DATE, DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.try_consume_feature_usage(TEXT, BIGINT, NUMERIC, DATE, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_feature_usage(TEXT, BIGINT, DATE, DATE) TO authenticated;
GRANT EXECUTE ON FUNCTION public.try_consume_feature_usage(TEXT, BIGINT, NUMERIC, DATE, DATE) TO authenticated;

-- ---------------------------------------------------------------------------
-- Seed catalog
-- ---------------------------------------------------------------------------

INSERT INTO public.plans (key, name, description, is_active, is_public, is_internal, display_order, metadata) VALUES
  (
    'legacy',
    'Legacy (migración)',
    'SOLO para organizaciones existentes al momento de la migración. No comercializar. No asignar a altas nuevas.',
    true,
    false,
    true,
    -1,
    '{"internal": true, "migration_only": true, "assignable_only_by_superadmin": true}'::jsonb
  ),
  (
    'trial',
    'Trial',
    'Plan de onboarding para organizaciones nuevas. Duración de trial configurable vía metadata.default_trial_days (null = sin vencimiento automático hasta Phase 2).',
    true,
    false,
    false,
    0,
    '{"onboarding_default": true, "default_trial_days": null}'::jsonb
  ),
  ('basic', 'Basic', 'Operación clínica esencial', true, true, false, 10, '{}'::jsonb),
  ('pro', 'Pro', 'Clínica completa con facturación e inventario', true, true, false, 20, '{}'::jsonb),
  ('premium', 'Premium', 'Pro + IA, WhatsApp y automatizaciones', true, true, false, 30, '{}'::jsonb),
  ('enterprise', 'Enterprise', 'Todo disponible + límites personalizados', true, true, false, 40, '{}'::jsonb);

INSERT INTO public.features (key, name, description, feature_type, default_enabled, usage_metered) VALUES
  ('core.dashboard', 'Dashboard', 'Panel principal', 'boolean', false, false),
  ('owners.enabled', 'Propietarios', 'Módulo de propietarios', 'boolean', false, false),
  ('patients.enabled', 'Pacientes', 'Módulo de pacientes', 'boolean', false, false),
  ('appointments.enabled', 'Agenda', 'Módulo de citas', 'boolean', false, false),
  ('clinical.history', 'Historia clínica', 'Historia clínica', 'boolean', false, false),
  ('clinical.consultations', 'Consultas', 'Consultas', 'boolean', false, false),
  ('clinical.hospitalization', 'Internación', 'Internación', 'boolean', false, false),
  ('clinical.vaccination', 'Vacunación', 'Vacunación', 'boolean', false, false),
  ('clinical.surgery', 'Cirugías', 'Cirugías', 'boolean', false, false),
  ('laboratory.enabled', 'Laboratorio', 'Laboratorio', 'boolean', false, false),
  ('inventory.enabled', 'Inventario', 'Inventario', 'boolean', false, false),
  ('pharmacy.enabled', 'Farmacia', 'Farmacia / recetas', 'boolean', false, false),
  ('billing.enabled', 'Facturación', 'Facturación clínica', 'boolean', false, false),
  ('cash_register.enabled', 'Caja', 'Caja', 'boolean', false, false),
  ('reports.basic', 'Reportes básicos', 'Reportes básicos', 'boolean', false, false),
  ('reports.advanced', 'Reportes avanzados', 'Reportes avanzados', 'boolean', false, false),
  ('owner_portal.enabled', 'Portal del tutor', 'Portal del propietario', 'boolean', false, false),
  ('whatsapp.enabled', 'WhatsApp', 'Mensajería WhatsApp', 'boolean', false, false),
  ('whatsapp.reminders', 'Recordatorios WhatsApp', 'Recordatorios por WhatsApp', 'boolean', false, false),
  ('notifications.enabled', 'Notificaciones', 'Notificaciones in-app', 'boolean', false, false),
  ('clinical_images.enabled', 'Imágenes clínicas', 'Galería de imágenes', 'boolean', false, false),
  ('audit.enabled', 'Auditoría', 'Auditoría', 'boolean', false, false),
  ('ai.enabled', 'IA clínica', 'Módulo IA', 'boolean', false, false),
  ('ai.patient_summary', 'IA resumen paciente', 'Resumen de paciente', 'boolean', false, false),
  ('ai.soap_assistant', 'IA SOAP', 'Asistente SOAP', 'boolean', false, false),
  ('ai.owner_instructions', 'IA indicaciones tutor', 'Indicaciones para tutor', 'boolean', false, false),
  ('automation.enabled', 'Automatizaciones', 'Automatizaciones', 'boolean', false, false);

INSERT INTO public.features (key, name, description, feature_type, default_enabled, default_limit, usage_metered) VALUES
  ('users.max', 'Máx. usuarios', 'Límite de usuarios de equipo', 'limit', true, 0, false),
  ('branches.max', 'Máx. sucursales', 'Límite de sucursales', 'limit', true, 0, false),
  ('professionals.max', 'Máx. profesionales', 'Límite de profesionales', 'limit', true, 0, false),
  ('patients.max', 'Máx. pacientes', 'Límite de pacientes activos', 'limit', true, 0, false),
  ('ai.monthly_requests', 'IA requests/mes', 'Requests de IA por mes', 'limit', true, 0, true),
  ('whatsapp.monthly_messages', 'WhatsApp msgs/mes', 'Mensajes WhatsApp por mes', 'limit', true, 0, true),
  ('storage.max_mb', 'Storage MB', 'Almacenamiento máximo en MB', 'limit', true, 0, true),
  ('automations.max_active', 'Automatizaciones activas', 'Máximo de automatizaciones activas', 'limit', true, 0, false);

CREATE OR REPLACE FUNCTION public._seed_plan_feature(
  p_plan_key TEXT,
  p_feature_key TEXT,
  p_enabled BOOLEAN,
  p_limit NUMERIC DEFAULT NULL
) RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO public.plan_features (plan_id, feature_id, enabled, limit_value)
  SELECT p.id, f.id, p_enabled, p_limit
  FROM public.plans p
  CROSS JOIN public.features f
  WHERE p.key = p_plan_key AND f.key = p_feature_key
  ON CONFLICT (plan_id, feature_id) DO UPDATE
    SET enabled = EXCLUDED.enabled,
        limit_value = EXCLUDED.limit_value,
        updated_at = now();
END;
$$;

-- LEGACY: full access, unlimited limits
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT key FROM public.features WHERE is_active LOOP
    PERFORM public._seed_plan_feature('legacy', r.key, true, NULL);
  END LOOP;
END $$;

-- TRIAL ≈ BASIC (onboarding commercial baseline; NOT legacy)
SELECT public._seed_plan_feature('trial', 'core.dashboard', true);
SELECT public._seed_plan_feature('trial', 'owners.enabled', true);
SELECT public._seed_plan_feature('trial', 'patients.enabled', true);
SELECT public._seed_plan_feature('trial', 'appointments.enabled', true);
SELECT public._seed_plan_feature('trial', 'clinical.history', true);
SELECT public._seed_plan_feature('trial', 'clinical.consultations', true);
SELECT public._seed_plan_feature('trial', 'clinical.vaccination', true);
SELECT public._seed_plan_feature('trial', 'notifications.enabled', true);
SELECT public._seed_plan_feature('trial', 'users.max', true, 3);
SELECT public._seed_plan_feature('trial', 'branches.max', true, 1);
SELECT public._seed_plan_feature('trial', 'professionals.max', true, 3);
SELECT public._seed_plan_feature('trial', 'patients.max', true, 500);
SELECT public._seed_plan_feature('trial', 'storage.max_mb', true, 1024);

-- BASIC
SELECT public._seed_plan_feature('basic', 'core.dashboard', true);
SELECT public._seed_plan_feature('basic', 'owners.enabled', true);
SELECT public._seed_plan_feature('basic', 'patients.enabled', true);
SELECT public._seed_plan_feature('basic', 'appointments.enabled', true);
SELECT public._seed_plan_feature('basic', 'clinical.history', true);
SELECT public._seed_plan_feature('basic', 'clinical.consultations', true);
SELECT public._seed_plan_feature('basic', 'clinical.vaccination', true);
SELECT public._seed_plan_feature('basic', 'notifications.enabled', true);
SELECT public._seed_plan_feature('basic', 'users.max', true, 3);
SELECT public._seed_plan_feature('basic', 'branches.max', true, 1);
SELECT public._seed_plan_feature('basic', 'professionals.max', true, 3);
SELECT public._seed_plan_feature('basic', 'patients.max', true, 500);
SELECT public._seed_plan_feature('basic', 'storage.max_mb', true, 1024);

-- PRO
SELECT public._seed_plan_feature('pro', f.key, true)
FROM (VALUES
  ('core.dashboard'),('owners.enabled'),('patients.enabled'),('appointments.enabled'),
  ('clinical.history'),('clinical.consultations'),('clinical.vaccination'),
  ('clinical.hospitalization'),('clinical.surgery'),('laboratory.enabled'),
  ('inventory.enabled'),('pharmacy.enabled'),('billing.enabled'),('cash_register.enabled'),
  ('reports.basic'),('owner_portal.enabled'),('notifications.enabled'),('audit.enabled')
) AS t(key)
JOIN public.features f ON f.key = t.key;

SELECT public._seed_plan_feature('pro', 'users.max', true, 10);
SELECT public._seed_plan_feature('pro', 'branches.max', true, 3);
SELECT public._seed_plan_feature('pro', 'professionals.max', true, 10);
SELECT public._seed_plan_feature('pro', 'patients.max', true, 5000);
SELECT public._seed_plan_feature('pro', 'storage.max_mb', true, 10240);

-- PREMIUM
SELECT public._seed_plan_feature('premium', f.key, true)
FROM (VALUES
  ('core.dashboard'),('owners.enabled'),('patients.enabled'),('appointments.enabled'),
  ('clinical.history'),('clinical.consultations'),('clinical.vaccination'),
  ('clinical.hospitalization'),('clinical.surgery'),('laboratory.enabled'),
  ('inventory.enabled'),('pharmacy.enabled'),('billing.enabled'),('cash_register.enabled'),
  ('reports.basic'),('reports.advanced'),('owner_portal.enabled'),
  ('whatsapp.enabled'),('whatsapp.reminders'),('notifications.enabled'),
  ('clinical_images.enabled'),('audit.enabled'),
  ('ai.enabled'),('ai.patient_summary'),('ai.soap_assistant'),('ai.owner_instructions'),
  ('automation.enabled')
) AS t(key)
JOIN public.features f ON f.key = t.key;

SELECT public._seed_plan_feature('premium', 'users.max', true, 25);
SELECT public._seed_plan_feature('premium', 'branches.max', true, 10);
SELECT public._seed_plan_feature('premium', 'professionals.max', true, 25);
SELECT public._seed_plan_feature('premium', 'patients.max', true, NULL);
SELECT public._seed_plan_feature('premium', 'ai.monthly_requests', true, 500);
SELECT public._seed_plan_feature('premium', 'whatsapp.monthly_messages', true, 2000);
SELECT public._seed_plan_feature('premium', 'storage.max_mb', true, 51200);
SELECT public._seed_plan_feature('premium', 'automations.max_active', true, 20);

-- ENTERPRISE
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT key FROM public.features WHERE is_active LOOP
    PERFORM public._seed_plan_feature('enterprise', r.key, true, NULL);
  END LOOP;
END $$;

DROP FUNCTION public._seed_plan_feature(TEXT, TEXT, BOOLEAN, NUMERIC);

-- ---------------------------------------------------------------------------
-- ONE-TIME backfill: existing organizations only → legacy
-- ---------------------------------------------------------------------------

INSERT INTO public.organization_subscriptions (organization_id, plan_id, status, starts_at, metadata)
SELECT o.id, p.id, 'active', now(), jsonb_build_object(
  'source', 'phase1_legacy_backfill',
  'note', 'Assigned once at entitlements migration; not for new signups'
)
FROM public.organizations o
CROSS JOIN public.plans p
WHERE p.key = 'legacy'
  AND o.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM public.organization_subscriptions s
    WHERE s.organization_id = o.id
      AND s.status IN ('trialing', 'active')
      AND s.cancelled_at IS NULL
  );

-- ---------------------------------------------------------------------------
-- New organizations → trial (NEVER legacy)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.ensure_default_organization_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_plan RECORD;
  v_trial_days INT;
  v_trial_ends TIMESTAMPTZ;
BEGIN
  -- Refuse undefined commercial state: onboarding plan must exist.
  SELECT id, key, is_internal, metadata
  INTO v_plan
  FROM public.plans
  WHERE key = 'trial'
    AND is_active = true
  LIMIT 1;

  IF v_plan.id IS NULL THEN
    RAISE EXCEPTION 'onboarding plan "trial" is missing; cannot create organization subscription';
  END IF;

  -- Hard guard: never auto-assign internal/migration plans (including legacy).
  IF v_plan.is_internal IS TRUE OR v_plan.key = 'legacy' THEN
    RAISE EXCEPTION 'refusing to auto-assign internal/legacy plan on organization create';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.organization_subscriptions s
    WHERE s.organization_id = NEW.id
      AND s.status IN ('trialing', 'active')
      AND s.cancelled_at IS NULL
  ) THEN
    RETURN NEW;
  END IF;

  -- Optional configurable trial length (product must set plans.metadata.default_trial_days).
  BEGIN
    v_trial_days := NULLIF(v_plan.metadata->>'default_trial_days', '')::INT;
  EXCEPTION WHEN others THEN
    v_trial_days := NULL;
  END;

  IF v_trial_days IS NOT NULL AND v_trial_days > 0 THEN
    v_trial_ends := timezone('utc', now()) + make_interval(days => v_trial_days);
  ELSE
    v_trial_ends := NULL; -- open-ended trialing until Superadmin/product sets duration
  END IF;

  INSERT INTO public.organization_subscriptions (
    organization_id, plan_id, status, starts_at, trial_ends_at, metadata
  )
  VALUES (
    NEW.id,
    v_plan.id,
    'trialing',
    timezone('utc', now()),
    v_trial_ends,
    jsonb_build_object(
      'source', 'signup_default_trial',
      'plan_key', 'trial',
      'trial_days_applied', v_trial_days
    )
  );

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.ensure_default_organization_subscription IS
  'Assigns trial (never legacy) to newly created organizations. Legacy is migration-only via one-time backfill.';

CREATE TRIGGER trg_organizations_default_subscription
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_default_organization_subscription();
