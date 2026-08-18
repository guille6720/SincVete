-- Phase 6: expire trials and paid periods whose dates already passed.
-- Does not invent a trial duration: open-ended trialing (trial_ends_at NULL) stays open.
-- Legacy/active with ends_at NULL stays open.

CREATE OR REPLACE FUNCTION public.expire_due_subscriptions(
  p_organization_id UUID DEFAULT NULL
)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count INT;
  v_org UUID;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role' THEN
    v_org := public.get_user_organization_id();
    IF v_org IS NULL THEN
      RAISE EXCEPTION 'not authorized';
    END IF;
    IF p_organization_id IS NOT NULL AND p_organization_id IS DISTINCT FROM v_org THEN
      RAISE EXCEPTION 'not authorized';
    END IF;
    p_organization_id := v_org;
  END IF;

  UPDATE public.organization_subscriptions
  SET
    status = 'expired',
    cancelled_at = COALESCE(cancelled_at, timezone('utc', now())),
    ends_at = COALESCE(ends_at, timezone('utc', now())),
    metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
      'status_source', 'expire_due_subscriptions',
      'expired_at', timezone('utc', now())
    )
  WHERE cancelled_at IS NULL
    AND status IN ('trialing', 'active', 'past_due')
    AND (p_organization_id IS NULL OR organization_id = p_organization_id)
    AND (
      (status = 'trialing' AND trial_ends_at IS NOT NULL AND trial_ends_at <= timezone('utc', now()))
      OR (
        status IN ('active', 'past_due')
        AND ends_at IS NOT NULL
        AND ends_at <= timezone('utc', now())
      )
    );

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.expire_due_subscriptions(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.expire_due_subscriptions(UUID) TO authenticated, service_role;

COMMENT ON FUNCTION public.expire_due_subscriptions(UUID) IS
  'Marks trialing/active/past_due rows expired when trial_ends_at or ends_at has passed. Authenticated callers may only expire their own org.';
