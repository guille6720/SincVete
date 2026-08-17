-- Phase 1: commercial entitlements (plans, features, limits, overrides, usage)
-- Additive only. Does not restrict existing orgs (legacy plan grants full access).

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
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT features_limit_null_for_boolean CHECK (
    feature_type <> 'limit' OR true
  )
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

-- At most one "current" subscription row per org (active or trialing).
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

-- updated_at triggers
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
-- Catalog: authenticated read; writes only via service role (no write policies).
-- Tenant tables: own-org read only.
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
-- Atomic usage increment (org-scoped)
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
SET search_path = public
AS $$
DECLARE
  v_org_id UUID;
  v_feature_id UUID;
  v_count BIGINT;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'amount must be positive';
  END IF;

  v_org_id := public.get_user_organization_id();
  IF v_org_id IS NULL THEN
    RAISE EXCEPTION 'not authenticated to an organization';
  END IF;

  SELECT id INTO v_feature_id
  FROM public.features
  WHERE key = p_feature_key AND is_active = true;

  IF v_feature_id IS NULL THEN
    RAISE EXCEPTION 'unknown feature %', p_feature_key;
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

GRANT EXECUTE ON FUNCTION public.increment_feature_usage TO authenticated;

-- ---------------------------------------------------------------------------
-- Seed catalog
-- ---------------------------------------------------------------------------

INSERT INTO public.plans (key, name, description, is_active, is_public, display_order, metadata) VALUES
  ('legacy', 'Legacy (migración)', 'Acceso completo temporal para organizaciones existentes. No comercializar.', true, false, -1, '{"internal": true}'::jsonb),
  ('basic', 'Basic', 'Operación clínica esencial', true, true, 10, '{}'::jsonb),
  ('pro', 'Pro', 'Clínica completa con facturación e inventario', true, true, 20, '{}'::jsonb),
  ('premium', 'Premium', 'Pro + IA, WhatsApp y automatizaciones', true, true, 30, '{}'::jsonb),
  ('enterprise', 'Enterprise', 'Todo disponible + límites personalizados', true, true, 40, '{}'::jsonb);

-- Boolean features
INSERT INTO public.features (key, name, description, feature_type, default_enabled) VALUES
  ('core.dashboard', 'Dashboard', 'Panel principal', 'boolean', false),
  ('owners.enabled', 'Propietarios', 'Módulo de propietarios', 'boolean', false),
  ('patients.enabled', 'Pacientes', 'Módulo de pacientes', 'boolean', false),
  ('appointments.enabled', 'Agenda', 'Módulo de citas', 'boolean', false),
  ('clinical.history', 'Historia clínica', 'Historia clínica', 'boolean', false),
  ('clinical.consultations', 'Consultas', 'Consultas', 'boolean', false),
  ('clinical.hospitalization', 'Internación', 'Internación', 'boolean', false),
  ('clinical.vaccination', 'Vacunación', 'Vacunación', 'boolean', false),
  ('clinical.surgery', 'Cirugías', 'Cirugías', 'boolean', false),
  ('laboratory.enabled', 'Laboratorio', 'Laboratorio', 'boolean', false),
  ('inventory.enabled', 'Inventario', 'Inventario', 'boolean', false),
  ('pharmacy.enabled', 'Farmacia', 'Farmacia / recetas', 'boolean', false),
  ('billing.enabled', 'Facturación', 'Facturación clínica', 'boolean', false),
  ('cash_register.enabled', 'Caja', 'Caja', 'boolean', false),
  ('reports.basic', 'Reportes básicos', 'Reportes básicos', 'boolean', false),
  ('reports.advanced', 'Reportes avanzados', 'Reportes avanzados', 'boolean', false),
  ('owner_portal.enabled', 'Portal del tutor', 'Portal del propietario', 'boolean', false),
  ('whatsapp.enabled', 'WhatsApp', 'Mensajería WhatsApp', 'boolean', false),
  ('whatsapp.reminders', 'Recordatorios WhatsApp', 'Recordatorios por WhatsApp', 'boolean', false),
  ('notifications.enabled', 'Notificaciones', 'Notificaciones in-app', 'boolean', false),
  ('clinical_images.enabled', 'Imágenes clínicas', 'Galería de imágenes', 'boolean', false),
  ('audit.enabled', 'Auditoría', 'Auditoría', 'boolean', false),
  ('ai.enabled', 'IA clínica', 'Módulo IA', 'boolean', false),
  ('ai.patient_summary', 'IA resumen paciente', 'Resumen de paciente', 'boolean', false),
  ('ai.soap_assistant', 'IA SOAP', 'Asistente SOAP', 'boolean', false),
  ('ai.owner_instructions', 'IA indicaciones tutor', 'Indicaciones para tutor', 'boolean', false),
  ('automation.enabled', 'Automatizaciones', 'Automatizaciones', 'boolean', false);

-- Limit features (default unavailable = enabled false + limit 0 conceptually via defaults)
INSERT INTO public.features (key, name, description, feature_type, default_enabled, default_limit) VALUES
  ('users.max', 'Máx. usuarios', 'Límite de usuarios de equipo', 'limit', true, 0),
  ('branches.max', 'Máx. sucursales', 'Límite de sucursales', 'limit', true, 0),
  ('professionals.max', 'Máx. profesionales', 'Límite de profesionales', 'limit', true, 0),
  ('patients.max', 'Máx. pacientes', 'Límite de pacientes activos', 'limit', true, 0),
  ('ai.monthly_requests', 'IA requests/mes', 'Requests de IA por mes', 'limit', true, 0),
  ('whatsapp.monthly_messages', 'WhatsApp msgs/mes', 'Mensajes WhatsApp por mes', 'limit', true, 0),
  ('storage.max_mb', 'Storage MB', 'Almacenamiento máximo en MB', 'limit', true, 0),
  ('automations.max_active', 'Automatizaciones activas', 'Máximo de automatizaciones activas', 'limit', true, 0);

-- Helper: assign plan feature by keys
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

-- LEGACY: all boolean features enabled; all limits unlimited (NULL)
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT key, feature_type FROM public.features WHERE is_active LOOP
    IF r.feature_type = 'boolean' THEN
      PERFORM public._seed_plan_feature('legacy', r.key, true, NULL);
    ELSE
      PERFORM public._seed_plan_feature('legacy', r.key, true, NULL); -- NULL limit = unlimited
    END IF;
  END LOOP;
END $$;

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

-- PRO = basic + clinical ops + commerce
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

-- PREMIUM = pro + AI/WhatsApp/images/advanced
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

-- ENTERPRISE = all features, unlimited limits
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT key, feature_type FROM public.features WHERE is_active LOOP
    PERFORM public._seed_plan_feature('enterprise', r.key, true, NULL);
  END LOOP;
END $$;

-- ---------------------------------------------------------------------------
-- Backward compatibility: every existing org gets legacy subscription
-- ---------------------------------------------------------------------------

INSERT INTO public.organization_subscriptions (organization_id, plan_id, status, starts_at, metadata)
SELECT o.id, p.id, 'active', now(), '{"source":"phase1_legacy_backfill"}'::jsonb
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

-- New organizations automatically receive legacy until commercial onboarding
CREATE OR REPLACE FUNCTION public.ensure_default_organization_subscription()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plan_id UUID;
BEGIN
  SELECT id INTO v_plan_id FROM public.plans WHERE key = 'legacy' LIMIT 1;
  IF v_plan_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.organization_subscriptions s
    WHERE s.organization_id = NEW.id
      AND s.status IN ('trialing', 'active')
      AND s.cancelled_at IS NULL
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.organization_subscriptions (organization_id, plan_id, status, starts_at, metadata)
  VALUES (NEW.id, v_plan_id, 'active', now(), '{"source":"signup_default_legacy"}'::jsonb);

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_organizations_default_subscription
  AFTER INSERT ON public.organizations
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_default_organization_subscription();

-- Drop helper seeder (keep catalog clean; optional to keep for admin scripts)
DROP FUNCTION public._seed_plan_feature(TEXT, TEXT, BOOLEAN, NUMERIC);
