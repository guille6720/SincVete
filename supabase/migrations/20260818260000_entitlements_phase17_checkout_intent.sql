-- Phase 17: remember a checkout in flight so the clinic is not asked to pay twice
-- while Mercado Pago / Stripe confirm the webhook. TTL is a pending-payment window,
-- not plan or add-on duration.
-- billing_interval is named that way because INTERVAL is reserved in Postgres.

DROP FUNCTION IF EXISTS public.billing_consume_checkout_intents(UUID, TEXT, TEXT);
DROP FUNCTION IF EXISTS public.billing_cancel_own_checkout_intents();
DROP FUNCTION IF EXISTS public.billing_set_own_checkout_intent_url(UUID, TEXT);
DROP FUNCTION IF EXISTS public.billing_begin_own_checkout_intent(TEXT, TEXT, TEXT, TEXT, INT);
DROP FUNCTION IF EXISTS public.list_own_open_checkout_intents();
DROP FUNCTION IF EXISTS public._billing_expire_checkout_intents(UUID);
DROP TABLE IF EXISTS public.billing_checkout_intents;

CREATE TABLE public.billing_checkout_intents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('plan', 'addon')),
  target_key TEXT NOT NULL,
  billing_interval TEXT NOT NULL CHECK (billing_interval IN ('monthly', 'annual')),
  provider TEXT NOT NULL CHECK (provider IN ('stripe', 'mercadopago')),
  checkout_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now()),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  CONSTRAINT billing_checkout_intents_terminal_state CHECK (
    consumed_at IS NULL OR cancelled_at IS NULL
  )
);

CREATE INDEX billing_checkout_intents_org_open_idx
  ON public.billing_checkout_intents (organization_id, expires_at)
  WHERE consumed_at IS NULL AND cancelled_at IS NULL;

CREATE UNIQUE INDEX billing_checkout_intents_one_open_plan
  ON public.billing_checkout_intents (organization_id)
  WHERE kind = 'plan' AND consumed_at IS NULL AND cancelled_at IS NULL;

CREATE UNIQUE INDEX billing_checkout_intents_one_open_addon
  ON public.billing_checkout_intents (organization_id, target_key)
  WHERE kind = 'addon' AND consumed_at IS NULL AND cancelled_at IS NULL;

ALTER TABLE public.billing_checkout_intents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE public.billing_checkout_intents FROM anon, authenticated, PUBLIC;
GRANT SELECT, INSERT, UPDATE ON TABLE public.billing_checkout_intents TO service_role;

CREATE OR REPLACE FUNCTION public._billing_expire_checkout_intents(p_organization_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  UPDATE public.billing_checkout_intents
  SET cancelled_at = timezone('utc', now())
  WHERE organization_id = p_organization_id
    AND consumed_at IS NULL
    AND cancelled_at IS NULL
    AND expires_at <= timezone('utc', now());
$$;

CREATE OR REPLACE FUNCTION public.list_own_open_checkout_intents()
RETURNS TABLE (
  id UUID,
  kind TEXT,
  target_key TEXT,
  billing_interval TEXT,
  provider TEXT,
  checkout_url TEXT,
  expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
VOLATILE
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

  PERFORM public._billing_expire_checkout_intents(v_org);

  RETURN QUERY
  SELECT
    i.id,
    i.kind,
    i.target_key,
    i.billing_interval,
    i.provider,
    i.checkout_url,
    i.expires_at
  FROM public.billing_checkout_intents i
  WHERE i.organization_id = v_org
    AND i.consumed_at IS NULL
    AND i.cancelled_at IS NULL
    AND i.expires_at > timezone('utc', now())
  ORDER BY i.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.billing_begin_own_checkout_intent(
  p_kind TEXT,
  p_target_key TEXT,
  p_interval TEXT,
  p_provider TEXT,
  p_ttl_hours INT DEFAULT 48
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org UUID;
  v_id UUID;
  v_url TEXT;
  v_interval TEXT;
  v_ttl INT;
BEGIN
  IF NOT public.has_permission('org:manage') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  v_org := public.get_user_organization_id();
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_kind IS NULL OR p_kind NOT IN ('plan', 'addon') THEN
    RAISE EXCEPTION 'invalid checkout kind';
  END IF;

  IF p_kind = 'plan' AND p_target_key IN ('legacy', 'trial') THEN
    RAISE EXCEPTION 'paid checkout cannot assign legacy or trial';
  END IF;

  IF p_kind = 'addon' AND (p_target_key IS NULL OR p_target_key NOT LIKE 'addon.%') THEN
    RAISE EXCEPTION 'invalid add-on checkout';
  END IF;

  IF p_interval IS NULL OR p_interval NOT IN ('monthly', 'annual') THEN
    RAISE EXCEPTION 'invalid billing interval';
  END IF;

  IF p_provider IS NULL OR p_provider NOT IN ('stripe', 'mercadopago') THEN
    RAISE EXCEPTION 'unknown billing provider';
  END IF;

  v_ttl := GREATEST(LEAST(COALESCE(p_ttl_hours, 48), 168), 1);
  PERFORM public._billing_expire_checkout_intents(v_org);

  SELECT i.id, i.checkout_url, i.billing_interval
  INTO v_id, v_url, v_interval
  FROM public.billing_checkout_intents i
  WHERE i.organization_id = v_org
    AND i.kind = p_kind
    AND i.target_key = p_target_key
    AND i.consumed_at IS NULL
    AND i.cancelled_at IS NULL
    AND i.expires_at > timezone('utc', now())
  ORDER BY i.created_at DESC
  LIMIT 1;

  IF v_id IS NOT NULL AND v_interval = p_interval THEN
    RETURN jsonb_build_object(
      'id', v_id,
      'checkout_url', v_url,
      'reused', true
    );
  END IF;

  IF v_id IS NOT NULL THEN
    UPDATE public.billing_checkout_intents
    SET cancelled_at = timezone('utc', now())
    WHERE id = v_id;
  END IF;

  IF p_kind = 'plan' THEN
    UPDATE public.billing_checkout_intents
    SET cancelled_at = timezone('utc', now())
    WHERE organization_id = v_org
      AND kind = 'plan'
      AND consumed_at IS NULL
      AND cancelled_at IS NULL;
  END IF;

  INSERT INTO public.billing_checkout_intents (
    organization_id, kind, target_key, billing_interval, provider, expires_at
  )
  VALUES (
    v_org,
    p_kind,
    p_target_key,
    p_interval,
    p_provider,
    timezone('utc', now()) + make_interval(hours => v_ttl)
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'id', v_id,
    'checkout_url', NULL,
    'reused', false
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.billing_set_own_checkout_intent_url(
  p_id UUID,
  p_checkout_url TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org UUID;
  v_count INT;
BEGIN
  IF NOT public.has_permission('org:manage') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  v_org := public.get_user_organization_id();
  IF v_org IS NULL OR p_id IS NULL THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  IF p_checkout_url IS NULL OR p_checkout_url !~ '^https://' THEN
    RAISE EXCEPTION 'invalid checkout url';
  END IF;

  UPDATE public.billing_checkout_intents
  SET checkout_url = p_checkout_url
  WHERE id = p_id
    AND organization_id = v_org
    AND consumed_at IS NULL
    AND cancelled_at IS NULL
    AND expires_at > timezone('utc', now());

  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'checkout intent not open';
  END IF;

  RETURN jsonb_build_object('id', p_id, 'updated', v_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.billing_cancel_own_checkout_intents()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_org UUID;
  v_count INT;
BEGIN
  IF NOT public.has_permission('org:manage') THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  v_org := public.get_user_organization_id();
  IF v_org IS NULL THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  UPDATE public.billing_checkout_intents
  SET cancelled_at = timezone('utc', now())
  WHERE organization_id = v_org
    AND consumed_at IS NULL
    AND cancelled_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('cancelled', v_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.billing_consume_checkout_intents(
  p_organization_id UUID,
  p_kind TEXT,
  p_target_key TEXT DEFAULT NULL
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

  IF p_kind IS NULL OR p_kind NOT IN ('plan', 'addon') THEN
    RAISE EXCEPTION 'invalid checkout kind';
  END IF;

  UPDATE public.billing_checkout_intents
  SET consumed_at = timezone('utc', now())
  WHERE organization_id = p_organization_id
    AND kind = p_kind
    AND (p_target_key IS NULL OR target_key = p_target_key OR p_kind = 'plan')
    AND consumed_at IS NULL
    AND cancelled_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('consumed', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public._billing_expire_checkout_intents(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.list_own_open_checkout_intents() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.billing_begin_own_checkout_intent(TEXT, TEXT, TEXT, TEXT, INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.billing_set_own_checkout_intent_url(UUID, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.billing_cancel_own_checkout_intents() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.billing_consume_checkout_intents(UUID, TEXT, TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public._billing_expire_checkout_intents(UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_own_open_checkout_intents() TO authenticated;
GRANT EXECUTE ON FUNCTION public.billing_begin_own_checkout_intent(TEXT, TEXT, TEXT, TEXT, INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.billing_set_own_checkout_intent_url(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.billing_cancel_own_checkout_intents() TO authenticated;
GRANT EXECUTE ON FUNCTION public.billing_consume_checkout_intents(UUID, TEXT, TEXT) TO service_role;

COMMENT ON TABLE public.billing_checkout_intents IS
  'Open clinic checkout sessions. Prevents a second charge while the provider webhook is still applying. Expiry is pending-payment lead time, not plan duration.';
COMMENT ON FUNCTION public.billing_begin_own_checkout_intent(TEXT, TEXT, TEXT, TEXT, INT) IS
  'Clinic org:manage starts or reuses a checkout intent. One open plan intent per clinic.';
COMMENT ON FUNCTION public.billing_consume_checkout_intents(UUID, TEXT, TEXT) IS
  'Webhook/service-role: clear open intents after a paid plan or add-on is applied.';
