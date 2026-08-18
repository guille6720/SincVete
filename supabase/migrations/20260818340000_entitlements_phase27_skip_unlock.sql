-- Phase 27: skipping a stuck webhook also unlocks the clinic checkout.
-- Phase 26 marked applied_at without touching intents, so Superadmin "won't complete"
-- still left checkout_pending. Skip does not reverse a paid grant.

CREATE OR REPLACE FUNCTION public.superadmin_skip_billing_event(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INT;
  v_released INT := 0;
  v_org UUID;
BEGIN
  PERFORM public.require_platform_admin();

  IF p_event_id IS NULL THEN
    RAISE EXCEPTION 'event required';
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

  IF v_count > 0 AND v_org IS NOT NULL THEN
    UPDATE public.billing_checkout_intents
    SET cancelled_at = timezone('utc', now())
    WHERE organization_id = v_org
      AND consumed_at IS NULL
      AND cancelled_at IS NULL;
    GET DIAGNOSTICS v_released = ROW_COUNT;
  END IF;

  RETURN jsonb_build_object(
    'skipped', v_count,
    'organization_id', v_org,
    'released', v_released
  );
END;
$$;

REVOKE ALL ON FUNCTION public.superadmin_skip_billing_event(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.superadmin_skip_billing_event(UUID) TO authenticated;

COMMENT ON FUNCTION public.superadmin_skip_billing_event(UUID) IS
  'Platform-admin: mark a stuck webhook applied and unlock that clinic''s open checkouts. Does not reverse a grant.';
