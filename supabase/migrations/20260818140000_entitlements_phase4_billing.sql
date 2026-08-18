-- Phase 4: commercial checkout (Mercado Pago / Stripe).
-- Superadmin remains the operator fallback. Payments never assign legacy or trial.

-- Public marketing prices live in plans.metadata.pricing (ARS, integer pesos).
-- Stripe price IDs and Mercado Pago preapproval plan IDs are optional until configured.

UPDATE public.plans
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{pricing}',
  '{
    "currency":"ARS",
    "monthly_amount":29990,
    "annual_amount":299900,
    "recommended":false,
    "cta":"register",
    "highlights":[
      "Agenda, pacientes e historia clínica",
      "Vacunación y notificaciones",
      "Hasta 3 usuarios y 1 sucursal",
      "Hasta 500 pacientes activos",
      "1 GB de almacenamiento"
    ]
  }'::jsonb
)
WHERE key = 'basic';

UPDATE public.plans
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{pricing}',
  '{
    "currency":"ARS",
    "monthly_amount":39900,
    "annual_amount":399000,
    "recommended":true,
    "cta":"checkout",
    "highlights":[
      "Todo Basic + internación, cirugías y laboratorio",
      "Inventario, farmacia, facturación y caja",
      "Reportes básicos, portal del tutor y auditoría",
      "Hasta 10 usuarios y 3 sucursales",
      "10 GB de almacenamiento"
    ]
  }'::jsonb
)
WHERE key = 'pro';

UPDATE public.plans
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{pricing}',
  '{
    "currency":"ARS",
    "monthly_amount":54900,
    "annual_amount":549000,
    "recommended":false,
    "cta":"checkout",
    "highlights":[
      "Todo Pro + IA clínica y WhatsApp",
      "Imágenes clínicas y reportes avanzados",
      "Hasta 25 usuarios y 10 sucursales",
      "Pacientes ilimitados",
      "50 GB de almacenamiento"
    ]
  }'::jsonb
)
WHERE key = 'premium';

UPDATE public.plans
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{pricing}',
  '{
    "currency":"ARS",
    "monthly_amount":null,
    "annual_amount":null,
    "recommended":false,
    "cta":"contact",
    "highlights":[
      "Todo Premium con límites a medida",
      "Multi-sucursal y cupos personalizados",
      "Acompañamiento de onboarding",
      "Facturación y contrato a medida"
    ]
  }'::jsonb
)
WHERE key = 'enterprise';

CREATE TABLE public.billing_customers (
  organization_id UUID PRIMARY KEY REFERENCES public.organizations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'mercadopago')),
  customer_id TEXT NOT NULL,
  email TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, customer_id)
);

CREATE TRIGGER trg_billing_customers_updated_at
  BEFORE UPDATE ON public.billing_customers
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'mercadopago')),
  event_id TEXT NOT NULL,
  event_type TEXT,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id)
);

ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.billing_customers FROM anon, authenticated;
REVOKE ALL ON TABLE public.billing_events FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON TABLE public.billing_customers TO service_role;
GRANT SELECT, INSERT ON TABLE public.billing_events TO service_role;
GRANT SELECT ON TABLE public.billing_customers TO authenticated;

CREATE POLICY billing_customers_select_own
  ON public.billing_customers FOR SELECT TO authenticated
  USING (organization_id = public.get_user_organization_id());

CREATE OR REPLACE FUNCTION public.list_public_plans()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'key', p.key,
        'name', p.name,
        'description', p.description,
        'display_order', p.display_order,
        'pricing', COALESCE(p.metadata->'pricing', '{}'::jsonb)
      )
      ORDER BY p.display_order, p.key
    ),
    '[]'::jsonb
  )
  FROM public.plans p
  WHERE p.is_active = true
    AND p.is_public = true
    AND p.is_internal = false
    AND p.key IN ('basic', 'pro', 'premium', 'enterprise');
$$;

REVOKE ALL ON FUNCTION public.list_public_plans() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_plans() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.billing_apply_paid_plan(
  p_organization_id UUID,
  p_plan_key TEXT,
  p_provider TEXT,
  p_external_id TEXT,
  p_interval TEXT DEFAULT 'monthly',
  p_status public.subscription_status DEFAULT 'active'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_plan RECORD;
  v_meta JSONB;
  v_new_id UUID;
  v_ends TIMESTAMPTZ;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role only';
  END IF;

  IF p_provider IS NULL OR p_provider NOT IN ('stripe', 'mercadopago') THEN
    RAISE EXCEPTION 'unknown billing provider';
  END IF;

  IF p_plan_key IS NULL OR p_plan_key IN ('legacy', 'trial') THEN
    RAISE EXCEPTION 'paid checkout cannot assign legacy or trial';
  END IF;

  IF p_status IS NULL OR p_status NOT IN ('active', 'past_due') THEN
    RAISE EXCEPTION 'paid checkout status must be active or past_due';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = p_organization_id AND o.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'organization not found';
  END IF;

  SELECT id, key, is_public, is_internal, is_active
  INTO v_plan
  FROM public.plans
  WHERE key = p_plan_key
    AND is_active = true;

  IF v_plan.id IS NULL THEN
    RAISE EXCEPTION 'unknown or inactive plan: %', p_plan_key;
  END IF;

  IF v_plan.is_internal IS TRUE OR v_plan.is_public IS NOT TRUE THEN
    RAISE EXCEPTION 'plan is not publicly purchasable: %', p_plan_key;
  END IF;

  IF p_interval = 'annual' THEN
    v_ends := timezone('utc', now()) + interval '1 year';
  ELSE
    v_ends := timezone('utc', now()) + interval '1 month';
  END IF;

  v_meta := jsonb_build_object(
    'source', 'billing_checkout',
    'provider', p_provider,
    'external_id', p_external_id,
    'interval', COALESCE(p_interval, 'monthly')
  );

  UPDATE public.organization_subscriptions
  SET
    status = 'cancelled',
    cancelled_at = timezone('utc', now()),
    ends_at = timezone('utc', now())
  WHERE organization_id = p_organization_id
    AND status IN ('trialing', 'active', 'past_due')
    AND cancelled_at IS NULL;

  INSERT INTO public.organization_subscriptions (
    organization_id, plan_id, status, starts_at, ends_at, trial_ends_at, metadata
  )
  VALUES (
    p_organization_id,
    v_plan.id,
    p_status,
    timezone('utc', now()),
    v_ends,
    NULL,
    v_meta
  )
  RETURNING id INTO v_new_id;

  RETURN jsonb_build_object(
    'subscription_id', v_new_id,
    'plan_key', v_plan.key,
    'status', p_status,
    'ends_at', v_ends
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.billing_set_subscription_status(
  p_organization_id UUID,
  p_status public.subscription_status,
  p_provider TEXT DEFAULT NULL,
  p_external_id TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role only';
  END IF;

  IF p_status NOT IN ('past_due', 'cancelled', 'expired', 'active') THEN
    RAISE EXCEPTION 'invalid billing status';
  END IF;

  UPDATE public.organization_subscriptions
  SET
    status = p_status,
    cancelled_at = CASE
      WHEN p_status IN ('cancelled', 'expired') THEN COALESCE(cancelled_at, timezone('utc', now()))
      ELSE cancelled_at
    END,
    ends_at = CASE
      WHEN p_status IN ('cancelled', 'expired') THEN COALESCE(ends_at, timezone('utc', now()))
      ELSE ends_at
    END,
    metadata = CASE
      WHEN p_provider IS NULL THEN metadata
      ELSE metadata || jsonb_build_object(
        'provider', p_provider,
        'external_id', p_external_id,
        'status_source', 'billing_webhook'
      )
    END
  WHERE organization_id = p_organization_id
    AND status IN ('trialing', 'active', 'past_due')
    AND cancelled_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('updated', v_count, 'status', p_status);
END;
$$;

REVOKE ALL ON FUNCTION public.billing_apply_paid_plan(UUID, TEXT, TEXT, TEXT, TEXT, public.subscription_status) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.billing_set_subscription_status(UUID, public.subscription_status, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.billing_apply_paid_plan(UUID, TEXT, TEXT, TEXT, TEXT, public.subscription_status) TO service_role;
GRANT EXECUTE ON FUNCTION public.billing_set_subscription_status(UUID, public.subscription_status, TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION public.list_public_plans() IS
  'Public commercial catalog (no secrets). Used by marketing and checkout.';
COMMENT ON FUNCTION public.billing_apply_paid_plan(UUID, TEXT, TEXT, TEXT, TEXT, public.subscription_status) IS
  'Webhook/service-role only. Activates a public paid plan. Never legacy/trial.';
