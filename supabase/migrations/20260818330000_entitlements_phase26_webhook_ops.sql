-- Phase 26: Superadmin can replay or skip unapplied billing webhooks.
-- Phase 21 listed them; Phase 18 could release checkouts. Apply still needed
-- a provider retry. Skip only sets applied_at; it does not change the grant.

CREATE OR REPLACE FUNCTION public.superadmin_get_unapplied_billing_event(p_event_id UUID)
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  provider TEXT,
  event_id TEXT,
  event_type TEXT,
  payload JSONB,
  processed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.require_platform_admin();

  IF p_event_id IS NULL THEN
    RAISE EXCEPTION 'event required';
  END IF;

  RETURN QUERY
  SELECT
    e.id,
    e.organization_id,
    e.provider,
    e.event_id,
    e.event_type,
    e.payload,
    e.processed_at
  FROM public.billing_events e
  WHERE e.id = p_event_id
    AND e.applied_at IS NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.superadmin_skip_billing_event(p_event_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INT;
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
  RETURN jsonb_build_object('skipped', v_count, 'organization_id', v_org);
END;
$$;

REVOKE ALL ON FUNCTION public.superadmin_get_unapplied_billing_event(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.superadmin_skip_billing_event(UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.superadmin_get_unapplied_billing_event(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.superadmin_skip_billing_event(UUID) TO authenticated;

COMMENT ON FUNCTION public.superadmin_get_unapplied_billing_event(UUID) IS
  'Platform-admin load of one claimed webhook that still needs apply. Payload stays off the clinic list.';
COMMENT ON FUNCTION public.superadmin_skip_billing_event(UUID) IS
  'Platform-admin marks a stuck webhook applied without changing the paid grant.';
