-- Fix: PL/pgSQL output column "expires_at" shadowed table column in UPDATE.
-- Symptom: Superadmin page error "column reference expires_at is ambiguous".

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

COMMENT ON FUNCTION public.superadmin_list_open_checkout_intents(INT) IS
  'Platform-admin queue of checkouts still waiting for the provider webhook.';
