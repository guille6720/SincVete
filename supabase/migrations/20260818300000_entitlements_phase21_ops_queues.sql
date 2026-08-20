-- Phase 21: Superadmin can see which clinics have stuck checkouts or unapplied webhooks.
-- Counts from phases 15 and 18 stayed numbers-only; a refund/apply failure was invisible
-- until someone opened every org.

CREATE OR REPLACE FUNCTION public.superadmin_list_open_checkout_intents(
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  organization_name TEXT,
  organization_slug TEXT,
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
DECLARE
  v_limit INT;
BEGIN
  PERFORM public.require_platform_admin();
  v_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);

  UPDATE public.billing_checkout_intents AS bci
  SET cancelled_at = timezone('utc', now())
  WHERE bci.consumed_at IS NULL
    AND bci.cancelled_at IS NULL
    AND bci.expires_at <= timezone('utc', now());

  RETURN QUERY
  SELECT
    i.id,
    i.organization_id,
    o.name,
    o.slug,
    i.kind,
    i.target_key,
    i.billing_interval,
    i.provider,
    i.expires_at,
    i.created_at
  FROM public.billing_checkout_intents i
  JOIN public.organizations o ON o.id = i.organization_id
  WHERE i.consumed_at IS NULL
    AND i.cancelled_at IS NULL
    AND i.expires_at > timezone('utc', now())
    AND o.deleted_at IS NULL
  ORDER BY i.created_at ASC
  LIMIT v_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.superadmin_list_unapplied_billing_events(
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  organization_id UUID,
  organization_name TEXT,
  organization_slug TEXT,
  provider TEXT,
  event_id TEXT,
  event_type TEXT,
  processed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limit INT;
BEGIN
  PERFORM public.require_platform_admin();
  v_limit := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 100);

  RETURN QUERY
  SELECT
    e.id,
    e.organization_id,
    o.name,
    o.slug,
    e.provider,
    e.event_id,
    e.event_type,
    e.processed_at
  FROM public.billing_events e
  LEFT JOIN public.organizations o ON o.id = e.organization_id
  WHERE e.applied_at IS NULL
  ORDER BY e.processed_at ASC
  LIMIT v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.superadmin_list_open_checkout_intents(INT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.superadmin_list_unapplied_billing_events(INT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.superadmin_list_open_checkout_intents(INT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.superadmin_list_unapplied_billing_events(INT) TO authenticated;

COMMENT ON FUNCTION public.superadmin_list_open_checkout_intents(INT) IS
  'Platform-admin queue of checkouts still waiting for the provider webhook.';
COMMENT ON FUNCTION public.superadmin_list_unapplied_billing_events(INT) IS
  'Platform-admin queue of billing webhooks claimed but not applied or skipped.';
