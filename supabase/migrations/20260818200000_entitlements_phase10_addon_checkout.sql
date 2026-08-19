-- Phase 10: self-serve add-on checkout (Mercado Pago / Stripe).
-- Superadmin grant remains the operator fallback. Payments never assign add-ons to legacy.
-- Add-on Stripe checkout is one-time (not a Stripe subscription) so plan webhooks stay on the plan.

UPDATE public.addons
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{pricing}',
  '{
    "currency":"ARS",
    "monthly_amount":12900,
    "annual_amount":129000,
    "recommended":true,
    "cta":"checkout",
    "highlights":["SOAP, resumen e indicaciones","100 requests de IA por mes"]
  }'::jsonb
)
WHERE key = 'addon.ai';

UPDATE public.addons
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{pricing}',
  '{
    "currency":"ARS",
    "monthly_amount":9900,
    "annual_amount":99000,
    "recommended":false,
    "cta":"checkout",
    "highlights":["Mensajes y recordatorios","500 mensajes por mes"]
  }'::jsonb
)
WHERE key = 'addon.whatsapp';

UPDATE public.addons
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{pricing}',
  '{
    "currency":"ARS",
    "monthly_amount":5900,
    "annual_amount":59000,
    "recommended":false,
    "cta":"checkout",
    "highlights":["Portal del propietario"]
  }'::jsonb
)
WHERE key = 'addon.portal';

UPDATE public.addons
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{pricing}',
  '{
    "currency":"ARS",
    "monthly_amount":4900,
    "annual_amount":49000,
    "recommended":false,
    "cta":"checkout",
    "highlights":["Galería de estudios","Hasta 5 GB extra de almacenamiento"]
  }'::jsonb
)
WHERE key = 'addon.images';

UPDATE public.addons
SET metadata = jsonb_set(
  COALESCE(metadata, '{}'::jsonb),
  '{pricing}',
  '{
    "currency":"ARS",
    "monthly_amount":3900,
    "annual_amount":39000,
    "recommended":false,
    "cta":"checkout",
    "highlights":["Reportes de caja e inventario"]
  }'::jsonb
)
WHERE key = 'addon.reports';

CREATE OR REPLACE FUNCTION public.list_public_addons()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'key', a.key,
        'name', a.name,
        'description', a.description,
        'display_order', a.display_order,
        'pricing', COALESCE(a.metadata->'pricing', '{}'::jsonb)
      )
      ORDER BY a.display_order, a.key
    ),
    '[]'::jsonb
  )
  FROM public.addons a
  WHERE a.is_active = true
    AND a.is_public = true;
$$;

CREATE OR REPLACE FUNCTION public.billing_apply_paid_addon(
  p_organization_id UUID,
  p_addon_key TEXT,
  p_provider TEXT,
  p_external_id TEXT,
  p_interval TEXT DEFAULT 'monthly'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_addon RECORD;
  v_plan_key TEXT;
  v_id UUID;
  v_ends TIMESTAMPTZ;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role only';
  END IF;

  IF p_provider IS NULL OR p_provider NOT IN ('stripe', 'mercadopago') THEN
    RAISE EXCEPTION 'unknown billing provider';
  END IF;

  IF p_addon_key IS NULL OR p_addon_key NOT LIKE 'addon.%' THEN
    RAISE EXCEPTION 'paid checkout cannot assign that add-on';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.organizations o
    WHERE o.id = p_organization_id AND o.deleted_at IS NULL
  ) THEN
    RAISE EXCEPTION 'organization not found';
  END IF;

  SELECT p.key
  INTO v_plan_key
  FROM public.organization_subscriptions s
  JOIN public.plans p ON p.id = s.plan_id
  WHERE s.organization_id = p_organization_id
    AND s.status IN ('trialing', 'active', 'past_due')
    AND s.cancelled_at IS NULL
  ORDER BY s.created_at DESC
  LIMIT 1;

  IF v_plan_key IS NULL THEN
    RAISE EXCEPTION 'active subscription required';
  END IF;

  IF v_plan_key = 'legacy' THEN
    RAISE EXCEPTION 'legacy already includes add-ons';
  END IF;

  SELECT id, key, is_active, is_public
  INTO v_addon
  FROM public.addons
  WHERE key = p_addon_key
    AND is_active = true;

  IF v_addon.id IS NULL THEN
    RAISE EXCEPTION 'unknown or inactive add-on: %', p_addon_key;
  END IF;

  IF v_addon.is_public IS NOT TRUE THEN
    RAISE EXCEPTION 'add-on is not publicly purchasable: %', p_addon_key;
  END IF;

  IF p_interval = 'annual' THEN
    v_ends := timezone('utc', now()) + interval '1 year';
  ELSE
    v_ends := timezone('utc', now()) + interval '1 month';
  END IF;

  UPDATE public.organization_addons g
  SET
    status = 'cancelled',
    cancelled_at = timezone('utc', now()),
    metadata = COALESCE(g.metadata, '{}'::jsonb) || jsonb_build_object(
      'replaced_by_checkout', true,
      'replaced_at', timezone('utc', now())
    )
  WHERE g.organization_id = p_organization_id
    AND g.addon_id = v_addon.id
    AND g.status = 'active'
    AND g.cancelled_at IS NULL;

  INSERT INTO public.organization_addons (
    organization_id, addon_id, status, starts_at, ends_at, reason, metadata
  )
  VALUES (
    p_organization_id,
    v_addon.id,
    'active',
    timezone('utc', now()),
    v_ends,
    'checkout',
    jsonb_build_object(
      'source', 'billing_addon_checkout',
      'provider', p_provider,
      'external_id', p_external_id,
      'interval', COALESCE(p_interval, 'monthly')
    )
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'organization_addon_id', v_id,
    'addon_key', v_addon.key,
    'ends_at', v_ends
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.billing_cancel_own_addon(p_addon_key TEXT)
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
  IF p_addon_key IS NULL OR p_addon_key NOT LIKE 'addon.%' THEN
    RAISE EXCEPTION 'unknown add-on';
  END IF;

  UPDATE public.organization_addons g
  SET
    status = 'cancelled',
    cancelled_at = timezone('utc', now()),
    metadata = COALESCE(g.metadata, '{}'::jsonb) || jsonb_build_object(
      'status_source', 'clinic_self_cancel_addon',
      'cancelled_at', timezone('utc', now())
    )
  FROM public.addons a
  WHERE g.addon_id = a.id
    AND g.organization_id = v_org
    AND a.key = p_addon_key
    AND g.status = 'active'
    AND g.cancelled_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'no active add-on';
  END IF;

  RETURN jsonb_build_object('revoked', v_count, 'addon_key', p_addon_key);
END;
$$;

REVOKE ALL ON FUNCTION public.list_public_addons() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.billing_apply_paid_addon(UUID, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.billing_cancel_own_addon(TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.list_public_addons() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.billing_apply_paid_addon(UUID, TEXT, TEXT, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.billing_cancel_own_addon(TEXT) TO authenticated;
