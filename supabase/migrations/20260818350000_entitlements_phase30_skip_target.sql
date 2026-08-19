-- Phase 30: skip only unlocks the checkout that matches the skipped webhook.
-- Phase 27 released every open intent for the org, so omitting a refund/invoice
-- could cancel an unrelated plan/add-on payment still in flight.

DROP FUNCTION IF EXISTS public.superadmin_skip_billing_event(UUID);

CREATE OR REPLACE FUNCTION public.superadmin_skip_billing_event(
  p_event_id UUID,
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
  v_released INT := 0;
  v_org UUID;
  v_kind TEXT;
  v_target TEXT;
BEGIN
  PERFORM public.require_platform_admin();

  IF p_event_id IS NULL THEN
    RAISE EXCEPTION 'event required';
  END IF;

  v_kind := NULLIF(trim(COALESCE(p_kind, '')), '');
  v_target := NULLIF(trim(COALESCE(p_target_key, '')), '');
  IF v_kind IS NOT NULL AND v_kind NOT IN ('plan', 'addon') THEN
    RAISE EXCEPTION 'invalid checkout kind';
  END IF;
  IF v_kind = 'addon' AND v_target IS NULL THEN
    v_kind := NULL;
  END IF;

  SELECT e.organization_id
  INTO v_org
  FROM public.billing_events e
  WHERE e.id = p_event_id
    AND e.applied_at IS NULL;

  UPDATE public.billing_events
  SET applied_at = timezone('utc', now())
  WHERE id = p_event_id
    AND applied_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count > 0 AND v_org IS NOT NULL AND v_kind IS NOT NULL THEN
    UPDATE public.billing_checkout_intents
    SET cancelled_at = timezone('utc', now())
    WHERE organization_id = v_org
      AND consumed_at IS NULL
      AND cancelled_at IS NULL
      AND kind = v_kind
      AND (v_kind = 'plan' OR target_key = v_target);
    GET DIAGNOSTICS v_released = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'skipped', v_count,
    'organization_id', v_org,
    'released', v_released
  );
END;
$$;

REVOKE ALL ON FUNCTION public.superadmin_skip_billing_event(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.superadmin_skip_billing_event(UUID, TEXT, TEXT) TO authenticated;

COMMENT ON FUNCTION public.superadmin_skip_billing_event(UUID, TEXT, TEXT) IS
  'Platform-admin: mark a stuck webhook applied and unlock only the matching open checkout. Does not reverse a grant.';
