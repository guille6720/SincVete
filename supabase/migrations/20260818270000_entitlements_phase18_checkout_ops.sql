-- Phase 18: Superadmin can see and release stuck checkout intents.
-- Rejected/expired provider payments must not leave the clinic locked on "confirming".
-- billing_interval stays named that way because INTERVAL is reserved.

CREATE OR REPLACE FUNCTION public.billing_release_checkout_intents(
  p_organization_id UUID,
  p_kind TEXT DEFAULT NULL,
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

  IF p_kind IS NOT NULL AND p_kind NOT IN ('plan', 'addon') THEN
    RAISE EXCEPTION 'invalid checkout kind';
  END IF;

  UPDATE public.billing_checkout_intents
  SET cancelled_at = timezone('utc', now())
  WHERE organization_id = p_organization_id
    AND consumed_at IS NULL
    AND cancelled_at IS NULL
    AND (p_kind IS NULL OR kind = p_kind)
    AND (
      p_target_key IS NULL
      OR p_kind = 'plan'
      OR target_key = p_target_key
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('released', v_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.superadmin_open_checkout_intents()
RETURNS INT
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.require_platform_admin();

  UPDATE public.billing_checkout_intents
  SET cancelled_at = timezone('utc', now())
  WHERE consumed_at IS NULL
    AND cancelled_at IS NULL
    AND expires_at <= timezone('utc', now());

  RETURN (
    SELECT COUNT(*)::INT
    FROM public.billing_checkout_intents i
    WHERE i.consumed_at IS NULL
      AND i.cancelled_at IS NULL
      AND i.expires_at > timezone('utc', now())
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.superadmin_list_checkout_intents(
  p_organization_id UUID
)
RETURNS TABLE (
  id UUID,
  kind TEXT,
  target_key TEXT,
  billing_interval TEXT,
  provider TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ
)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.require_platform_admin();
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization required';
  END IF;

  PERFORM public._billing_expire_checkout_intents(p_organization_id);

  RETURN QUERY
  SELECT
    i.id,
    i.kind,
    i.target_key,
    i.billing_interval,
    i.provider,
    i.expires_at,
    i.created_at
  FROM public.billing_checkout_intents i
  WHERE i.organization_id = p_organization_id
    AND i.consumed_at IS NULL
    AND i.cancelled_at IS NULL
    AND i.expires_at > timezone('utc', now())
  ORDER BY i.created_at DESC;
END;
$$;

CREATE OR REPLACE FUNCTION public.superadmin_cancel_checkout_intents(
  p_organization_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INT;
BEGIN
  PERFORM public.require_platform_admin();
  IF p_organization_id IS NULL THEN
    RAISE EXCEPTION 'organization required';
  END IF;

  UPDATE public.billing_checkout_intents
  SET cancelled_at = timezone('utc', now())
  WHERE organization_id = p_organization_id
    AND consumed_at IS NULL
    AND cancelled_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('cancelled', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.billing_release_checkout_intents(UUID, TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.superadmin_open_checkout_intents() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.superadmin_list_checkout_intents(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.superadmin_cancel_checkout_intents(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.billing_release_checkout_intents(UUID, TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.superadmin_open_checkout_intents() TO authenticated;
GRANT EXECUTE ON FUNCTION public.superadmin_list_checkout_intents(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.superadmin_cancel_checkout_intents(UUID) TO authenticated;

COMMENT ON FUNCTION public.billing_release_checkout_intents(UUID, TEXT, TEXT) IS
  'Webhook/service-role: unlock a clinic when the provider rejects, expires, or refunds a checkout.';
COMMENT ON FUNCTION public.superadmin_cancel_checkout_intents(UUID) IS
  'Platform-admin fallback: clear stuck checkout intents so the clinic can pay again.';
