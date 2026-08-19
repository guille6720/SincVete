-- Phase 20: match a Stripe refund to the paid grant even when the charge id
-- is not the checkout session id stored as metadata.external_id.
-- Partial charge.refunded events stay in the app layer (isFullProviderRefund).
-- Superadmin can reverse a checkout-sourced grant when the webhook never arrives.

CREATE OR REPLACE FUNCTION public._billing_grant_ids_match(p_metadata JSONB, p_ids TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_ids IS NOT NULL AND cardinality(p_ids) > 0 AND (
    COALESCE(p_metadata->>'external_id', '') = ANY(p_ids)
    OR COALESCE(p_metadata->>'payment_intent_id', '') = ANY(p_ids)
    OR COALESCE(p_metadata->>'charge_id', '') = ANY(p_ids)
    OR COALESCE(p_metadata->>'invoice_id', '') = ANY(p_ids)
    OR COALESCE(p_metadata->>'checkout_session_id', '') = ANY(p_ids)
    OR COALESCE(p_metadata->>'stripe_subscription_id', '') = ANY(p_ids)
  );
$$;

CREATE OR REPLACE FUNCTION public._billing_payload_has_ids(p_payload JSONB, p_ids TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT p_ids IS NOT NULL AND cardinality(p_ids) > 0 AND (
    COALESCE(p_payload->'data'->'object'->>'id', '') = ANY(p_ids)
    OR COALESCE(p_payload->'data'->'object'->>'payment_intent', '') = ANY(p_ids)
    OR COALESCE(p_payload->'data'->'object'->'payment_intent'->>'id', '') = ANY(p_ids)
    OR COALESCE(p_payload->'data'->'object'->>'invoice', '') = ANY(p_ids)
    OR COALESCE(p_payload->'data'->'object'->'invoice'->>'id', '') = ANY(p_ids)
    OR COALESCE(p_payload->'data'->'object'->>'subscription', '') = ANY(p_ids)
    OR COALESCE(p_payload->'data'->'object'->'subscription'->>'id', '') = ANY(p_ids)
    OR COALESCE(p_payload->'data'->'object'->>'charge', '') = ANY(p_ids)
    OR COALESCE(p_payload->'data'->'object'->'charge'->>'id', '') = ANY(p_ids)
    OR COALESCE(p_payload->>'paymentId', '') = ANY(p_ids)
  );
$$;

CREATE OR REPLACE FUNCTION public._billing_normalize_id_list(p_ids TEXT[], p_external_id TEXT)
RETURNS TEXT[]
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT COALESCE(
    ARRAY(
      SELECT DISTINCT trimmed
      FROM unnest(COALESCE(p_ids, ARRAY[]::TEXT[]) || ARRAY[p_external_id]) AS raw
      CROSS JOIN LATERAL (SELECT NULLIF(trim(raw), '')) AS t(trimmed)
      WHERE trimmed IS NOT NULL
    ),
    ARRAY[]::TEXT[]
  );
$$;

CREATE OR REPLACE FUNCTION public.billing_lookup_paid_grant_from_provider_ids(
  p_provider TEXT,
  p_ids TEXT[]
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ids TEXT[];
  v_event RECORD;
  v_obj JSONB;
  v_meta JSONB;
  v_org UUID;
  v_kind TEXT;
  v_target TEXT;
  v_matched TEXT;
  v_ref TEXT;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role only';
  END IF;

  IF p_provider IS NULL OR p_provider NOT IN ('stripe', 'mercadopago') THEN
    RAISE EXCEPTION 'unknown billing provider';
  END IF;

  v_ids := public._billing_normalize_id_list(p_ids, NULL);
  IF cardinality(v_ids) = 0 THEN
    RETURN jsonb_build_object('found', 0);
  END IF;

  SELECT
    s.organization_id,
    'plan'::TEXT AS kind,
    p.key AS target_key,
    COALESCE(s.metadata->>'external_id', s.metadata->>'checkout_session_id') AS matched_external_id
  INTO v_org, v_kind, v_target, v_matched
  FROM public.organization_subscriptions s
  JOIN public.plans p ON p.id = s.plan_id
  WHERE public._billing_grant_ids_match(s.metadata, v_ids)
    AND p.key NOT IN ('legacy', 'trial')
  ORDER BY
    CASE WHEN s.status IN ('active', 'past_due') AND s.cancelled_at IS NULL THEN 0 ELSE 1 END,
    s.created_at DESC
  LIMIT 1;

  IF v_org IS NOT NULL THEN
    RETURN jsonb_build_object(
      'found', 1,
      'organization_id', v_org,
      'kind', v_kind,
      'target_key', v_target,
      'matched_external_id', v_matched
    );
  END IF;

  SELECT
    g.organization_id,
    'addon'::TEXT AS kind,
    a.key AS target_key,
    COALESCE(g.metadata->>'external_id', g.metadata->>'checkout_session_id') AS matched_external_id
  INTO v_org, v_kind, v_target, v_matched
  FROM public.organization_addons g
  JOIN public.addons a ON a.id = g.addon_id
  WHERE public._billing_grant_ids_match(g.metadata, v_ids)
  ORDER BY
    CASE WHEN g.status = 'active' AND g.cancelled_at IS NULL THEN 0 ELSE 1 END,
    g.created_at DESC
  LIMIT 1;

  IF v_org IS NOT NULL THEN
    RETURN jsonb_build_object(
      'found', 1,
      'organization_id', v_org,
      'kind', v_kind,
      'target_key', v_target,
      'matched_external_id', v_matched
    );
  END IF;

  SELECT e.organization_id, e.event_type, e.payload
  INTO v_event
  FROM public.billing_events e
  WHERE e.provider = p_provider
    AND public._billing_payload_has_ids(e.payload, v_ids)
  ORDER BY e.processed_at DESC
  LIMIT 1;

  IF v_event.payload IS NULL THEN
    RETURN jsonb_build_object('found', 0);
  END IF;

  v_obj := COALESCE(v_event.payload->'data'->'object', '{}'::jsonb);
  v_meta := COALESCE(v_obj->'metadata', '{}'::jsonb);
  v_ref := COALESCE(v_meta->>'reference', v_obj->>'client_reference_id');
  v_matched := NULLIF(v_obj->>'id', '');

  BEGIN
    v_org := COALESCE(
      v_event.organization_id,
      NULLIF(v_meta->>'organization_id', '')::UUID,
      NULLIF(v_obj->>'client_reference_id', '')::UUID
    );
  EXCEPTION WHEN invalid_text_representation THEN
    v_org := v_event.organization_id;
  END;

  IF COALESCE(v_meta->>'kind', '') = 'addon' OR NULLIF(v_meta->>'addon_key', '') IS NOT NULL THEN
    v_kind := 'addon';
    v_target := NULLIF(v_meta->>'addon_key', '');
  ELSIF NULLIF(v_meta->>'plan_key', '') IS NOT NULL THEN
    v_kind := 'plan';
    v_target := NULLIF(v_meta->>'plan_key', '');
  ELSIF v_ref IS NOT NULL AND split_part(v_ref, ':', 2) = 'addon' THEN
    v_kind := 'addon';
    v_target := NULLIF(split_part(v_ref, ':', 3), '');
    BEGIN
      v_org := COALESCE(v_org, NULLIF(split_part(v_ref, ':', 1), '')::UUID);
    EXCEPTION WHEN invalid_text_representation THEN
      NULL;
    END;
  ELSIF v_ref IS NOT NULL AND NULLIF(split_part(v_ref, ':', 2), '') IS NOT NULL THEN
    v_kind := 'plan';
    v_target := NULLIF(split_part(v_ref, ':', 2), '');
    BEGIN
      v_org := COALESCE(v_org, NULLIF(split_part(v_ref, ':', 1), '')::UUID);
    EXCEPTION WHEN invalid_text_representation THEN
      NULL;
    END;
  END IF;

  IF v_org IS NULL OR v_kind IS NULL THEN
    RETURN jsonb_build_object('found', 0);
  END IF;

  RETURN jsonb_build_object(
    'found', 1,
    'organization_id', v_org,
    'kind', v_kind,
    'target_key', v_target,
    'matched_external_id', v_matched
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.billing_attach_paid_grant_ids(
  p_organization_id UUID,
  p_kind TEXT,
  p_target_key TEXT,
  p_ids JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id UUID;
  v_patch JSONB;
  v_count INT := 0;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role only';
  END IF;

  IF p_kind IS NULL OR p_kind NOT IN ('plan', 'addon') THEN
    RAISE EXCEPTION 'invalid checkout kind';
  END IF;

  v_patch := jsonb_strip_nulls(COALESCE(p_ids, '{}'::jsonb));
  IF v_patch = '{}'::jsonb THEN
    RETURN jsonb_build_object('attached', 0);
  END IF;

  IF p_kind = 'plan' THEN
    SELECT s.id
    INTO v_id
    FROM public.organization_subscriptions s
    JOIN public.plans p ON p.id = s.plan_id
    WHERE s.organization_id = p_organization_id
      AND s.status IN ('active', 'past_due')
      AND s.cancelled_at IS NULL
      AND p.key = COALESCE(NULLIF(trim(p_target_key), ''), p.key)
      AND p.key NOT IN ('legacy', 'trial')
    ORDER BY s.created_at DESC
    LIMIT 1;

    IF v_id IS NULL THEN
      RETURN jsonb_build_object('attached', 0);
    END IF;

    UPDATE public.organization_subscriptions
    SET metadata = COALESCE(metadata, '{}'::jsonb) || v_patch
    WHERE id = v_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN jsonb_build_object('attached', v_count, 'subscription_id', v_id);
  END IF;

  SELECT g.id
  INTO v_id
  FROM public.organization_addons g
  JOIN public.addons a ON a.id = g.addon_id
  WHERE g.organization_id = p_organization_id
    AND g.status = 'active'
    AND g.cancelled_at IS NULL
    AND a.key = p_target_key
  ORDER BY g.created_at DESC
  LIMIT 1;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('attached', 0);
  END IF;

  UPDATE public.organization_addons
  SET metadata = COALESCE(metadata, '{}'::jsonb) || v_patch
  WHERE id = v_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('attached', v_count, 'organization_addon_id', v_id);
END;
$$;

DROP FUNCTION IF EXISTS public.billing_reverse_paid_grant(UUID, TEXT, TEXT, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.billing_reverse_paid_grant(
  p_organization_id UUID,
  p_kind TEXT,
  p_target_key TEXT DEFAULT NULL,
  p_provider TEXT DEFAULT NULL,
  p_external_id TEXT DEFAULT NULL,
  p_reason TEXT DEFAULT 'refunded',
  p_provider_ids TEXT[] DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id UUID;
  v_name TEXT;
  v_reason TEXT;
  v_notice UUID;
  v_ids TEXT[];
  v_lookup JSONB;
  v_matched TEXT;
BEGIN
  IF auth.role() = 'service_role' THEN
    NULL;
  ELSIF auth.role() = 'authenticated' THEN
    PERFORM public.require_platform_admin();
  ELSE
    RAISE EXCEPTION 'service role only';
  END IF;

  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization required';
  END IF;

  IF p_kind IS NULL OR p_kind NOT IN ('plan', 'addon') THEN
    RAISE EXCEPTION 'invalid checkout kind';
  END IF;

  v_reason := COALESCE(NULLIF(trim(p_reason), ''), 'refunded');
  v_ids := public._billing_normalize_id_list(p_provider_ids, p_external_id);

  IF p_provider IS NOT NULL AND cardinality(v_ids) > 0 THEN
    v_lookup := public.billing_lookup_paid_grant_from_provider_ids(p_provider, v_ids);
    IF COALESCE(v_lookup->>'found', '0') = '1' THEN
      v_matched := NULLIF(v_lookup->>'matched_external_id', '');
      IF v_matched IS NOT NULL THEN
        v_ids := public._billing_normalize_id_list(v_ids, v_matched);
      END IF;
    END IF;
  END IF;

  IF p_kind = 'plan' THEN
    SELECT s.id, p.name
    INTO v_id, v_name
    FROM public.organization_subscriptions s
    JOIN public.plans p ON p.id = s.plan_id
    WHERE s.organization_id = p_organization_id
      AND s.status IN ('active', 'past_due')
      AND s.cancelled_at IS NULL
      AND p.key NOT IN ('legacy', 'trial')
      AND public._billing_grant_ids_match(s.metadata, v_ids)
    ORDER BY s.created_at DESC
    LIMIT 1;

    IF v_id IS NULL
      AND EXISTS (
        SELECT 1
        FROM public.organization_subscriptions s2
        WHERE s2.organization_id = p_organization_id
          AND public._billing_grant_ids_match(s2.metadata, v_ids)
      )
    THEN
      RETURN jsonb_build_object('reversed', 0, 'kind', 'plan', 'already_closed', true);
    END IF;

    IF v_id IS NULL
      AND p_target_key IS NOT NULL
      AND p_target_key NOT IN ('legacy', 'trial')
      AND cardinality(v_ids) = 0
    THEN
      SELECT s.id, p.name
      INTO v_id, v_name
      FROM public.organization_subscriptions s
      JOIN public.plans p ON p.id = s.plan_id
      WHERE s.organization_id = p_organization_id
        AND s.status IN ('active', 'past_due')
        AND s.cancelled_at IS NULL
        AND p.key = p_target_key
        AND (
          COALESCE(s.metadata->>'source', '') IN ('billing_checkout', 'billing_extend_paid_plan')
          OR COALESCE(s.metadata->>'external_id', '') <> ''
        )
      ORDER BY s.created_at DESC
      LIMIT 1;
    END IF;

    IF v_id IS NULL
      AND p_target_key IS NOT NULL
      AND p_target_key NOT IN ('legacy', 'trial')
      AND cardinality(v_ids) > 0
      AND NOT EXISTS (
        SELECT 1
        FROM public.organization_subscriptions s2
        WHERE s2.organization_id = p_organization_id
          AND public._billing_grant_ids_match(s2.metadata, v_ids)
      )
      AND (v_lookup IS NULL OR COALESCE(v_lookup->>'found', '0') <> '1')
    THEN
      SELECT s.id, p.name
      INTO v_id, v_name
      FROM public.organization_subscriptions s
      JOIN public.plans p ON p.id = s.plan_id
      WHERE s.organization_id = p_organization_id
        AND s.status IN ('active', 'past_due')
        AND s.cancelled_at IS NULL
        AND p.key = p_target_key
      ORDER BY s.created_at DESC
      LIMIT 1;
    END IF;

    IF v_id IS NULL THEN
      RETURN jsonb_build_object('reversed', 0, 'kind', 'plan');
    END IF;

    UPDATE public.organization_subscriptions
    SET
      status = 'expired',
      cancelled_at = COALESCE(cancelled_at, timezone('utc', now())),
      ends_at = timezone('utc', now()),
      metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
        'status_source', 'billing_reverse_paid_grant',
        'reverse_reason', v_reason,
        'provider', p_provider,
        'reversed_at', timezone('utc', now())
      )
    WHERE id = v_id;

    v_notice := public.emit_plan_notification(
      p_organization_id,
      'plan_refunded',
      v_id,
      'El pago del plan fue revertido',
      format(
        'El proveedor reembolsó o contracargó el plan%s. Elegí uno para seguir usando los módulos.',
        CASE WHEN v_name IS NULL THEN '' ELSE ' ' || v_name END
      ),
      20
    );

    RETURN jsonb_build_object(
      'reversed', 1,
      'kind', 'plan',
      'subscription_id', v_id,
      'notice_id', v_notice
    );
  END IF;

  SELECT g.id, a.name
  INTO v_id, v_name
  FROM public.organization_addons g
  JOIN public.addons a ON a.id = g.addon_id
  WHERE g.organization_id = p_organization_id
    AND g.status = 'active'
    AND g.cancelled_at IS NULL
    AND public._billing_grant_ids_match(g.metadata, v_ids)
  ORDER BY g.created_at DESC
  LIMIT 1;

  IF v_id IS NULL
    AND EXISTS (
      SELECT 1
      FROM public.organization_addons g2
      WHERE g2.organization_id = p_organization_id
        AND public._billing_grant_ids_match(g2.metadata, v_ids)
    )
  THEN
    RETURN jsonb_build_object('reversed', 0, 'kind', 'addon', 'already_closed', true);
  END IF;

  IF v_id IS NULL
    AND p_target_key IS NOT NULL
    AND cardinality(v_ids) = 0
  THEN
    SELECT g.id, a.name
    INTO v_id, v_name
    FROM public.organization_addons g
    JOIN public.addons a ON a.id = g.addon_id
    WHERE g.organization_id = p_organization_id
      AND g.status = 'active'
      AND g.cancelled_at IS NULL
      AND a.key = p_target_key
      AND (
        COALESCE(g.metadata->>'source', '') = 'billing_addon_checkout'
        OR COALESCE(g.metadata->>'external_id', '') <> ''
        OR g.reason = 'checkout'
      )
    ORDER BY g.created_at DESC
    LIMIT 1;
  END IF;

  IF v_id IS NULL
    AND p_target_key IS NOT NULL
    AND cardinality(v_ids) > 0
    AND NOT EXISTS (
      SELECT 1
      FROM public.organization_addons g2
      WHERE g2.organization_id = p_organization_id
        AND public._billing_grant_ids_match(g2.metadata, v_ids)
    )
    AND (v_lookup IS NULL OR COALESCE(v_lookup->>'found', '0') <> '1')
  THEN
    SELECT g.id, a.name
    INTO v_id, v_name
    FROM public.organization_addons g
    JOIN public.addons a ON a.id = g.addon_id
    WHERE g.organization_id = p_organization_id
      AND g.status = 'active'
      AND g.cancelled_at IS NULL
      AND a.key = p_target_key
    ORDER BY g.created_at DESC
    LIMIT 1;
  END IF;

  IF v_id IS NULL THEN
    RETURN jsonb_build_object('reversed', 0, 'kind', 'addon');
  END IF;

  UPDATE public.organization_addons
  SET
    status = 'expired',
    cancelled_at = COALESCE(cancelled_at, timezone('utc', now())),
    ends_at = timezone('utc', now()),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'status_source', 'billing_reverse_paid_grant',
      'reverse_reason', v_reason,
      'provider', p_provider,
      'reversed_at', timezone('utc', now())
    )
  WHERE id = v_id;

  v_notice := public.emit_plan_notification(
    p_organization_id,
    'addon_refunded',
    v_id,
    format('El pago del extra%s fue revertido', CASE WHEN v_name IS NULL THEN '' ELSE ' ' || v_name END),
    'El proveedor reembolsó o contracargó el extra. Renovalo desde Configuración si lo necesitás.',
    20
  );

  RETURN jsonb_build_object(
    'reversed', 1,
    'kind', 'addon',
    'organization_addon_id', v_id,
    'notice_id', v_notice
  );
END;
$$;

REVOKE ALL ON FUNCTION public._billing_grant_ids_match(JSONB, TEXT[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._billing_payload_has_ids(JSONB, TEXT[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public._billing_normalize_id_list(TEXT[], TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.billing_lookup_paid_grant_from_provider_ids(TEXT, TEXT[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.billing_attach_paid_grant_ids(UUID, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.billing_reverse_paid_grant(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[]) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.billing_lookup_paid_grant_from_provider_ids(TEXT, TEXT[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.billing_attach_paid_grant_ids(UUID, TEXT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.billing_reverse_paid_grant(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.billing_reverse_paid_grant(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[]) TO authenticated;

COMMENT ON FUNCTION public.billing_lookup_paid_grant_from_provider_ids(TEXT, TEXT[]) IS
  'Webhook/service-role: map Stripe charge/payment_intent/invoice ids to the checkout grant.';
COMMENT ON FUNCTION public.billing_attach_paid_grant_ids(UUID, TEXT, TEXT, JSONB) IS
  'Webhook/service-role: persist Stripe session/payment_intent/invoice ids on the open grant.';
COMMENT ON FUNCTION public.billing_reverse_paid_grant(UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT[]) IS
  'Expire the paid grant tied to a refund/chargeback. Matches any stored provider id. Superadmin may call without ids for a missed webhook.';
