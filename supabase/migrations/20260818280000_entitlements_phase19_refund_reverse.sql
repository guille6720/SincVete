-- Phase 19: reverse a paid plan/add-on when the provider refunds or chargebacks
-- after apply. Rejected/cancelled checkouts stay in phase 18 (release intent only).
-- Matching prefers metadata.external_id so a later renewal is not reversed.

CREATE OR REPLACE FUNCTION public.billing_reverse_paid_grant(
  p_organization_id UUID,
  p_kind TEXT,
  p_target_key TEXT DEFAULT NULL,
  p_provider TEXT DEFAULT NULL,
  p_external_id TEXT DEFAULT NULL,
  p_reason TEXT DEFAULT 'refunded'
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
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    RAISE EXCEPTION 'service role only';
  END IF;

  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization required';
  END IF;

  IF p_kind IS NULL OR p_kind NOT IN ('plan', 'addon') THEN
    RAISE EXCEPTION 'invalid checkout kind';
  END IF;

  v_reason := COALESCE(NULLIF(trim(p_reason), ''), 'refunded');

  IF p_kind = 'plan' THEN
    SELECT s.id, p.name
    INTO v_id, v_name
    FROM public.organization_subscriptions s
    JOIN public.plans p ON p.id = s.plan_id
    WHERE s.organization_id = p_organization_id
      AND s.status IN ('active', 'past_due')
      AND s.cancelled_at IS NULL
      AND p.key NOT IN ('legacy', 'trial')
      AND p_external_id IS NOT NULL
      AND COALESCE(s.metadata->>'external_id', '') = p_external_id
    ORDER BY s.created_at DESC
    LIMIT 1;

    IF v_id IS NULL
      AND p_target_key IS NOT NULL
      AND p_target_key NOT IN ('legacy', 'trial')
      AND NOT EXISTS (
        SELECT 1
        FROM public.organization_subscriptions s2
        WHERE s2.organization_id = p_organization_id
          AND COALESCE(s2.metadata->>'external_id', '') = COALESCE(p_external_id, '')
          AND p_external_id IS NOT NULL
      )
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
    AND p_external_id IS NOT NULL
    AND COALESCE(g.metadata->>'external_id', '') = p_external_id
  ORDER BY g.created_at DESC
  LIMIT 1;

  IF v_id IS NULL
    AND p_target_key IS NOT NULL
    AND NOT EXISTS (
      SELECT 1
      FROM public.organization_addons g2
      JOIN public.addons a2 ON a2.id = g2.addon_id
      WHERE g2.organization_id = p_organization_id
        AND COALESCE(g2.metadata->>'external_id', '') = COALESCE(p_external_id, '')
        AND p_external_id IS NOT NULL
    )
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

REVOKE ALL ON FUNCTION public.billing_reverse_paid_grant(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.billing_reverse_paid_grant(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) TO service_role;

COMMENT ON FUNCTION public.billing_reverse_paid_grant(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) IS
  'Webhook/service-role: expire the paid grant tied to a refunded or charged-back payment. Does not reverse legacy/trial.';
